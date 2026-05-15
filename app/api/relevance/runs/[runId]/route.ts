import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { getRunStatus } from '@/lib/relevance/client'

// GET /api/relevance/runs/[runId]
// Protected — returns run status, updating from Relevance if still running.

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params

  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })

  const db = createServiceRoleClient()
  const { data: membership } = await db
    .from('business_members').select('business_id').eq('user_id', user.id).limit(1).single()
  if (!membership) return NextResponse.json({ error: 'No business found.' }, { status: 404 })

  const { data: run } = await db
    .from('agent_runs')
    .select('*, helios_agents(name, relevance_agent_id)')
    .eq('id', runId)
    .eq('business_id', membership.business_id)
    .single()

  if (!run) return NextResponse.json({ error: 'Run not found.' }, { status: 404 })
  const runRow = run as Record<string, unknown>

  // If still running, poll Relevance for status
  if (runRow.status === 'running' && runRow.provider_run_id) {
    const agent = runRow.helios_agents as { name: string; relevance_agent_id: string | null } | null
    if (agent?.relevance_agent_id) {
      const statusResult = await getRunStatus(agent.relevance_agent_id, runRow.provider_run_id as string)
      if (statusResult.ok) {
        const providerStatus = statusResult.data.status
        if (providerStatus === 'complete' || providerStatus === 'failed') {
          const newStatus = providerStatus === 'complete' ? 'completed' : 'failed'
          const outputSummary = providerStatus === 'complete'
            ? JSON.stringify(statusResult.data.output ?? {}).slice(0, 500)
            : undefined
          await db.from('agent_runs').update({
            status: newStatus,
            output_summary: outputSummary,
            completed_at: new Date().toISOString(),
          }).eq('id', runId)
          runRow.status = newStatus
          runRow.output_summary = outputSummary

          // Save output if complete
          if (providerStatus === 'complete' && statusResult.data.output) {
            await db.from('agent_outputs').insert({
              business_id:  membership.business_id,
              agent_run_id: runId,
              output_type:  'json',
              title:        `${agent.name} — Output`,
              content:      JSON.stringify(statusResult.data.output, null, 2).slice(0, 10000),
              status:       'pending_review',
            }).catch(() => undefined)
          }
        }
      }
    }
  }

  // Fetch outputs and logs
  const [outputsRes, logsRes] = await Promise.all([
    db.from('agent_outputs').select('*').eq('agent_run_id', runId).order('created_at'),
    db.from('agent_run_logs').select('*').eq('agent_run_id', runId).order('created_at'),
  ])

  return NextResponse.json({
    ok:      true,
    run:     runRow,
    outputs: outputsRes.data ?? [],
    logs:    logsRes.data ?? [],
  })
}
