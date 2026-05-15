'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { isRelevanceConfigured, runAgent, runWorkforce } from '@/lib/relevance/client'
import {
  relevanceAgentRunSchema,
  relevanceWorkforceRunSchema,
  outputStatusSchema,
  recommendationStatusSchema,
} from '@/lib/validation/relevance'
import { getAuthContext, logAudit } from './_shared'
import { getBusinessPlan } from '@/lib/billing/limits'
import { captureApiError } from '@/lib/logging/api'
import { capture } from '@/lib/analytics/posthog'
import type { ActionState, AgentRun, AgentOutput, AgentRecommendation } from '@/types'

const APP_PATH = '/dashboard/agents'

// ── Plan gate for agent runs ──────────────────────────────────────

const PLAN_ORDER: Record<string, number> = { starter: 0, pro: 1, scale: 2 }

function planAllows(userPlan: string, requiredPlan: string): boolean {
  return (PLAN_ORDER[userPlan] ?? 0) >= (PLAN_ORDER[requiredPlan] ?? 0)
}

// ── Run a Helios agent ────────────────────────────────────────────

export async function runHeliosAgent(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState & { run_id?: string }> {
  const { user, businessId } = await getAuthContext()
  if (!user || !businessId) return { error: 'Not authenticated.' }

  const parsed = relevanceAgentRunSchema.safeParse({
    agent_id:      formData.get('agent_id'),
    input_summary: formData.get('input_summary') || undefined,
  })
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Invalid input.' }

  const db = createServiceRoleClient()

  // Fetch agent definition
  const { data: agent } = await db
    .from('helios_agents')
    .select('id, name, relevance_agent_id, required_plan')
    .eq('id', parsed.data.agent_id)
    .single()

  if (!agent) return { error: 'Agent not found.' }
  const agentRow = agent as { id: string; name: string; relevance_agent_id: string | null; required_plan: string }

  // Plan gate
  const plan = await getBusinessPlan(db, businessId)
  if (!planAllows(plan, agentRow.required_plan)) {
    return { error: `The ${agentRow.name} requires the ${agentRow.required_plan} plan or higher.` }
  }

  // Create run record
  const { data: runRow, error: runErr } = await db
    .from('agent_runs')
    .insert({
      business_id:   businessId,
      agent_id:      agentRow.id,
      run_type:      'agent',
      status:        'pending',
      input_summary: parsed.data.input_summary ?? `Run ${agentRow.name}`,
    })
    .select('id')
    .single()

  if (runErr || !runRow) {
    console.error('[runHeliosAgent] insert run:', runErr?.message)
    return { error: 'Could not create agent run record.' }
  }

  const runId = (runRow as { id: string }).id

  if (!isRelevanceConfigured() || !agentRow.relevance_agent_id) {
    // Relevance not configured — mark as completed with placeholder output
    await db.from('agent_runs').update({
      status: 'completed',
      output_summary: 'Demo mode: Relevance AI not configured. Add RELEVANCE_API_KEY to enable real runs.',
      completed_at: new Date().toISOString(),
    }).eq('id', runId)

    await db.from('agent_run_logs').insert({
      business_id: businessId,
      agent_run_id: runId,
      level: 'info',
      message: 'Demo run — Relevance AI not configured.',
    })

    await db.from('agent_outputs').insert({
      business_id:  businessId,
      agent_run_id: runId,
      output_type:  'text',
      title:        `${agentRow.name} — Demo Output`,
      content:      `This is a demo output for ${agentRow.name}. Configure RELEVANCE_API_KEY and RELEVANCE_PROJECT_ID to enable real agent runs.`,
      status:       'pending_review',
    })

    revalidatePath(APP_PATH)
    return { success: 'Demo run completed.', run_id: runId }
  }

  // Update to running
  await db.from('agent_runs').update({ status: 'running' }).eq('id', runId)

  try {
    const message = parsed.data.input_summary ?? `Run ${agentRow.name} analysis`
    const result  = await runAgent({
      agentId:  agentRow.relevance_agent_id,
      message,
      context:  { business_id: businessId.slice(0, 8), plan },
    })

    if (!result.ok) {
      await db.from('agent_runs').update({ status: 'failed', error_message: 'Provider error.', completed_at: new Date().toISOString() }).eq('id', runId)
      await db.from('agent_run_logs').insert({ business_id: businessId, agent_run_id: runId, level: 'error', message: result.error })
      return { error: 'Agent run failed. Please try again.' }
    }

    const jobId = result.data.job_id
    await db.from('agent_runs').update({ provider_run_id: jobId, status: 'running' }).eq('id', runId)
    await db.from('agent_run_logs').insert({ business_id: businessId, agent_run_id: runId, level: 'info', message: `Agent triggered. Job ID: ${jobId}` })

    capture('agent_run_started', { agent_name: agentRow.name, plan })
    await logAudit(db, { business_id: businessId, user_id: user.id, action: 'relevance.agent.run_started', resource: 'agent_runs', resource_id: runId, new_values: { agent_name: agentRow.name } })

  } catch (err) {
    captureApiError(err, { route: '/actions/runHeliosAgent', error_type: 'relevance_run_error', business_id: businessId })
    await db.from('agent_runs').update({ status: 'failed', completed_at: new Date().toISOString() }).eq('id', runId)
    return { error: 'Agent run failed unexpectedly.' }
  }

  revalidatePath(APP_PATH)
  return { success: `${agentRow.name} started.`, run_id: runId }
}

// ── Run a workforce ───────────────────────────────────────────────

export async function runHeliosWorkforce(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState & { run_id?: string }> {
  const { user, businessId } = await getAuthContext()
  if (!user || !businessId) return { error: 'Not authenticated.' }

  const parsed = relevanceWorkforceRunSchema.safeParse({
    workforce_id:  formData.get('workforce_id'),
    input_summary: formData.get('input_summary') || undefined,
  })
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Invalid input.' }

  const db = createServiceRoleClient()

  const { data: workforce } = await db
    .from('relevance_workforces')
    .select('id, name, relevance_workforce_id, required_plan')
    .eq('id', parsed.data.workforce_id)
    .single()

  if (!workforce) return { error: 'Workforce not found.' }
  const wfRow = workforce as { id: string; name: string; relevance_workforce_id: string | null; required_plan: string }

  const plan = await getBusinessPlan(db, businessId)
  if (!planAllows(plan, wfRow.required_plan)) {
    return { error: `The ${wfRow.name} requires the ${wfRow.required_plan} plan or higher.` }
  }

  const { data: runRow, error: runErr } = await db
    .from('agent_runs')
    .insert({ business_id: businessId, workforce_id: wfRow.id, run_type: 'workforce', status: 'pending', input_summary: parsed.data.input_summary ?? `Run ${wfRow.name}` })
    .select('id').single()

  if (runErr || !runRow) return { error: 'Could not create run record.' }
  const runId = (runRow as { id: string }).id

  if (!isRelevanceConfigured() || !wfRow.relevance_workforce_id) {
    await db.from('agent_runs').update({ status: 'completed', output_summary: 'Demo mode.', completed_at: new Date().toISOString() }).eq('id', runId)
    revalidatePath(APP_PATH)
    return { success: 'Demo workforce run completed.', run_id: runId }
  }

  await db.from('agent_runs').update({ status: 'running' }).eq('id', runId)

  try {
    const result = await runWorkforce({ workforceId: wfRow.relevance_workforce_id, message: parsed.data.input_summary ?? `Run ${wfRow.name}` })
    if (!result.ok) {
      await db.from('agent_runs').update({ status: 'failed', completed_at: new Date().toISOString() }).eq('id', runId)
      return { error: 'Workforce run failed.' }
    }
    await db.from('agent_runs').update({ provider_run_id: result.data.job_id, status: 'running' }).eq('id', runId)
    capture('workforce_run_started', { workforce_name: wfRow.name, plan })
  } catch (err) {
    captureApiError(err, { route: '/actions/runHeliosWorkforce', error_type: 'relevance_workforce_error', business_id: businessId })
    await db.from('agent_runs').update({ status: 'failed', completed_at: new Date().toISOString() }).eq('id', runId)
    return { error: 'Workforce run failed.' }
  }

  revalidatePath(APP_PATH)
  return { success: `${wfRow.name} started.`, run_id: runId }
}

// ── Get recent runs ───────────────────────────────────────────────

export async function getAgentRuns(limit = 20): Promise<AgentRun[]> {
  const { businessId } = await getAuthContext()
  if (!businessId) return []
  const db = createServiceRoleClient()
  const { data } = await db
    .from('agent_runs')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as AgentRun[]
}

// ── Get outputs for a run ─────────────────────────────────────────

export async function getAgentOutputs(runId: string): Promise<AgentOutput[]> {
  const { businessId } = await getAuthContext()
  if (!businessId) return []
  const db = createServiceRoleClient()
  const { data } = await db
    .from('agent_outputs')
    .select('*')
    .eq('agent_run_id', runId)
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
  return (data ?? []) as AgentOutput[]
}

// ── Update output status ──────────────────────────────────────────

export async function updateOutputStatus(outputId: string, status: AgentOutput['status']): Promise<ActionState> {
  const { user, businessId } = await getAuthContext()
  if (!user || !businessId) return { error: 'Not authenticated.' }
  const db = createServiceRoleClient()
  const { error } = await db.from('agent_outputs').update({ status }).eq('id', outputId).eq('business_id', businessId)
  if (error) return { error: 'Could not update output status.' }
  capture('agent_output_reviewed', { status })
  revalidatePath(APP_PATH)
  return { success: 'Output updated.' }
}

// ── Update recommendation status ──────────────────────────────────

export async function updateRecommendationStatus(recId: string, status: AgentRecommendation['status']): Promise<ActionState> {
  const { user, businessId } = await getAuthContext()
  if (!user || !businessId) return { error: 'Not authenticated.' }
  const db = createServiceRoleClient()
  const { error } = await db.from('agent_recommendations').update({ status }).eq('id', recId).eq('business_id', businessId)
  if (error) return { error: 'Could not update recommendation.' }
  if (status === 'approved') capture('agent_recommendation_approved', {})
  revalidatePath(APP_PATH)
  return { success: 'Recommendation updated.' }
}
