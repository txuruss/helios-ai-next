import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { isRelevanceConfigured, runAgent } from '@/lib/relevance/client'
import { relevanceAgentRunSchema } from '@/lib/validation/relevance'
import { getBusinessPlan } from '@/lib/billing/limits'
import { captureApiError } from '@/lib/logging/api'

const PLAN_ORDER: Record<string, number> = { starter: 0, pro: 1, scale: 2 }

// POST /api/relevance/run-agent
// Protected dashboard route.

export async function POST(request: NextRequest) {
  // Auth: use cookie-based SSR client so the Supabase session is read correctly.
  // Never use the service role client to verify who is logged in.
  const authClient = await createClient()
  const { data: { user }, error: authErr } = await authClient.auth.getUser()
  if (!user) {
    console.error('[run-agent] auth.getUser failed — no session cookie or expired token', authErr?.message)
    return NextResponse.json({ error: 'Please sign in to run agents.' }, { status: 401 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const parsed = relevanceAgentRunSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input.' }, { status: 400 })

  // Service role bypasses RLS — safe after confirming the user identity above.
  const db = createServiceRoleClient()
  const { data: membership } = await db
    .from('business_members').select('business_id').eq('user_id', user.id).limit(1).single()
  if (!membership) {
    console.error('[run-agent] No business_members row for user:', user.id)
    return NextResponse.json({ error: 'Create a business profile first to run agents.' }, { status: 404 })
  }
  const businessId = membership.business_id as string

  const { data: agentRow } = await db
    .from('helios_agents')
    .select('id, name, relevance_agent_id, required_plan')
    .eq('id', parsed.data.agent_id)
    .single()
  if (!agentRow) return NextResponse.json({ error: 'Agent not found.' }, { status: 404 })
  const agent = agentRow as { id: string; name: string; relevance_agent_id: string | null; required_plan: string }

  const plan = await getBusinessPlan(db, businessId)
  if ((PLAN_ORDER[plan] ?? 0) < (PLAN_ORDER[agent.required_plan] ?? 0)) {
    return NextResponse.json({ error: `This agent requires the ${agent.required_plan} plan or higher.` }, { status: 402 })
  }

  const { data: runRow } = await db
    .from('agent_runs')
    .insert({ business_id: businessId, agent_id: agent.id, run_type: 'agent', status: 'pending', input_summary: parsed.data.input_summary ?? `Run ${agent.name}` })
    .select('id').single()
  const runId = (runRow as { id: string } | null)?.id
  if (!runId) return NextResponse.json({ error: 'Could not create run record.' }, { status: 500 })

  if (!isRelevanceConfigured() || !agent.relevance_agent_id) {
    await db.from('agent_runs').update({ status: 'completed', output_summary: 'Demo mode.', completed_at: new Date().toISOString() }).eq('id', runId)
    return NextResponse.json({ ok: true, run_id: runId, status: 'completed', demo: true })
  }

  await db.from('agent_runs').update({ status: 'running' }).eq('id', runId)
  try {
    const result = await runAgent({ agentId: agent.relevance_agent_id, message: parsed.data.input_summary ?? `Run ${agent.name}` })
    if (!result.ok) {
      await db.from('agent_runs').update({ status: 'failed', error_message: 'Provider error.', completed_at: new Date().toISOString() }).eq('id', runId)
      return NextResponse.json({ error: 'Agent run failed.' }, { status: 500 })
    }
    await db.from('agent_runs').update({ provider_run_id: result.data.job_id }).eq('id', runId)
    return NextResponse.json({ ok: true, run_id: runId, job_id: result.data.job_id, status: 'running' })
  } catch (err) {
    captureApiError(err, { route: '/api/relevance/run-agent', error_type: 'relevance_run_error', business_id: businessId })
    await db.from('agent_runs').update({ status: 'failed', completed_at: new Date().toISOString() }).eq('id', runId)
    return NextResponse.json({ error: 'Agent run failed.' }, { status: 500 })
  }
}
