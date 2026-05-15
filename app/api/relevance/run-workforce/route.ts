import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { isRelevanceConfigured, runWorkforce } from '@/lib/relevance/client'
import { relevanceWorkforceRunSchema } from '@/lib/validation/relevance'
import { getBusinessPlan } from '@/lib/billing/limits'
import { captureApiError } from '@/lib/logging/api'

const PLAN_ORDER: Record<string, number> = { starter: 0, pro: 1, scale: 2 }

// POST /api/relevance/run-workforce
// Protected dashboard route.

export async function POST(request: NextRequest) {
  const authClient = await createClient()
  const { data: { user }, error: authErr } = await authClient.auth.getUser()
  if (!user) {
    console.error('[run-workforce] auth.getUser failed:', authErr?.message)
    return NextResponse.json({ error: 'Please sign in to launch workforces.' }, { status: 401 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const parsed = relevanceWorkforceRunSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input.' }, { status: 400 })

  const db = createServiceRoleClient()
  const { data: membership } = await db
    .from('business_members').select('business_id').eq('user_id', user.id).limit(1).single()
  if (!membership) {
    console.error('[run-workforce] No business_members row for user:', user.id)
    return NextResponse.json({ error: 'Create a business profile first to launch workforces.' }, { status: 404 })
  }
  const businessId = membership.business_id as string

  const { data: wfRow } = await db
    .from('relevance_workforces')
    .select('id, name, relevance_workforce_id, required_plan')
    .eq('id', parsed.data.workforce_id)
    .single()
  if (!wfRow) return NextResponse.json({ error: 'Workforce not found.' }, { status: 404 })
  const wf = wfRow as { id: string; name: string; relevance_workforce_id: string | null; required_plan: string }

  const plan = await getBusinessPlan(db, businessId)
  if ((PLAN_ORDER[plan] ?? 0) < (PLAN_ORDER[wf.required_plan] ?? 0)) {
    return NextResponse.json({ error: `This workforce requires the ${wf.required_plan} plan or higher.` }, { status: 402 })
  }

  const { data: runRow } = await db
    .from('agent_runs')
    .insert({ business_id: businessId, workforce_id: wf.id, run_type: 'workforce', status: 'pending', input_summary: parsed.data.input_summary ?? `Run ${wf.name}` })
    .select('id').single()
  const runId = (runRow as { id: string } | null)?.id
  if (!runId) return NextResponse.json({ error: 'Could not create run record.' }, { status: 500 })

  if (!isRelevanceConfigured() || !wf.relevance_workforce_id) {
    await db.from('agent_runs').update({ status: 'completed', output_summary: 'Demo mode.', completed_at: new Date().toISOString() }).eq('id', runId)
    return NextResponse.json({ ok: true, run_id: runId, status: 'completed', demo: true })
  }

  await db.from('agent_runs').update({ status: 'running' }).eq('id', runId)
  try {
    const result = await runWorkforce({ workforceId: wf.relevance_workforce_id, message: parsed.data.input_summary ?? `Run ${wf.name}` })
    if (!result.ok) {
      await db.from('agent_runs').update({ status: 'failed', completed_at: new Date().toISOString() }).eq('id', runId)
      return NextResponse.json({ error: 'Workforce run failed.' }, { status: 500 })
    }
    await db.from('agent_runs').update({ provider_run_id: result.data.job_id }).eq('id', runId)
    return NextResponse.json({ ok: true, run_id: runId, job_id: result.data.job_id, status: 'running' })
  } catch (err) {
    captureApiError(err, { route: '/api/relevance/run-workforce', error_type: 'relevance_workforce_error', business_id: businessId })
    await db.from('agent_runs').update({ status: 'failed', completed_at: new Date().toISOString() }).eq('id', runId)
    return NextResponse.json({ error: 'Workforce run failed.' }, { status: 500 })
  }
}
