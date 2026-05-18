// ── Phase 29: Relevance AI placeholder service for business audits ─
//
// Backend-safe service for the audit workflow. These functions DO NOT
// expose the Relevance AI API key. They are designed to be called from
// secure server actions or API routes only — never from the browser.
//
// All API-key access uses the existing `lib/relevance/client.ts` which
// reads RELEVANCE_API_KEY and RELEVANCE_PROJECT_ID server-side only.
//
// When Relevance AI is not configured, these functions return safe
// placeholder values so the UI can be built and previewed end-to-end.
// Production rollout requires:
//   1. Set RELEVANCE_API_KEY and RELEVANCE_PROJECT_ID in env
//   2. Replace the workflow IDs below with real ones from Relevance
//   3. Validate the result shape in generateClientAuditReport

import 'server-only'

import {
  isRelevanceConfigured,
  runAgent,
  getRunStatus,
  type RelevanceResult,
  type RelevanceRunResult,
} from './client'

// ── Configuration (move to env later) ─────────────────────────────

// The Relevance studio (agent) that performs business audits.
// Replace with the real studio ID once provisioned.
const AUDIT_AGENT_ID_ENV = 'RELEVANCE_AUDIT_AGENT_ID'

function getAuditAgentId(): string | null {
  return process.env[AUDIT_AGENT_ID_ENV] ?? null
}

// ── Types ─────────────────────────────────────────────────────────

export interface AuditInputContext {
  business_id:          string
  business_name:        string
  industry:             string
  city:                 string
  website?:             string
  instagram?:           string
  facebook?:            string
  whatsapp?:            string
  current_booking:      string
  monthly_leads:        number
  biggest_problem:      string
  services?:            string[]
  team_size?:           number
  existing_software?:   string
  preferred_channels?:  string[]
  selected_plan:        string
}

export type AuditStatus =
  | 'queued'
  | 'running'
  | 'complete'
  | 'failed'
  | 'unconfigured'  // Relevance not provisioned yet — UI shows manual-review state

export interface AuditTriggerResult {
  job_id: string | null
  status: AuditStatus
  reason: string | null
}

export interface AuditStatusResult {
  job_id:  string
  status:  AuditStatus
  output?: Record<string, unknown>
  error?:  string
}

export interface ClientAuditReport {
  business_id:         string
  status:              AuditStatus
  generated_at:        string
  overall_score:       number | null
  strengths:           string[]
  gaps:                string[]
  recommendations:     { title: string; detail: string; impact: 'high' | 'medium' | 'low' }[]
  estimated_lift:      string | null
  // For UI: ALL fields above are safe to render to the client browser.
  // The raw Relevance payload is NEVER forwarded to the client.
}

// ── triggerBusinessAudit ──────────────────────────────────────────

export async function triggerBusinessAudit(
  ctx: AuditInputContext,
): Promise<AuditTriggerResult> {
  if (!isRelevanceConfigured()) {
    return {
      job_id: null,
      status: 'unconfigured',
      reason: 'Relevance AI is not configured. Audit will be reviewed by a Helios team member manually.',
    }
  }

  const agentId = getAuditAgentId()
  if (!agentId) {
    return {
      job_id: null,
      status: 'unconfigured',
      reason: `Audit workflow not set. Set ${AUDIT_AGENT_ID_ENV} when the Relevance studio is ready.`,
    }
  }

  // Cast all fields to strings (Relevance context requires string values).
  const context = serializeContext(ctx)

  const res = await runAgent({
    agentId,
    message:  `Run business audit for ${ctx.business_name}.`,
    context,
    maxSteps: 12,
  })

  if (!res.ok) {
    return { job_id: null, status: 'failed', reason: res.error }
  }

  return { job_id: res.data.job_id, status: 'queued', reason: null }
}

// ── getAuditStatus ────────────────────────────────────────────────

export async function getAuditStatus(jobId: string): Promise<AuditStatusResult> {
  const agentId = getAuditAgentId()
  if (!isRelevanceConfigured() || !agentId) {
    return { job_id: jobId, status: 'unconfigured' }
  }

  const res: RelevanceResult<RelevanceRunResult> = await getRunStatus(agentId, jobId)
  if (!res.ok) {
    return { job_id: jobId, status: 'failed', error: res.error }
  }

  return {
    job_id: jobId,
    status: mapRelevanceStatus(res.data.status),
    output: res.data.output,
    error:  res.data.error,
  }
}

// ── saveAgentRun ──────────────────────────────────────────────────
//
// Records the agent run in the database so the internal team can view
// it from /team/agent-runs. Caller passes a server-side Supabase client
// so this function does NOT pull in @/lib/supabase/server (avoids the
// server-only import chain in client components).

interface SupabaseLike {
  from: (table: string) => {
    insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>
  }
}

export async function saveAgentRun(
  db: SupabaseLike,
  row: {
    business_id:   string
    agent:         string
    status:        AuditStatus
    job_id:        string | null
    triggered_by:  string
    metadata?:     Record<string, unknown>
  },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await db.from('agent_runs').insert({
      business_id:  row.business_id,
      agent:        row.agent,
      status:       row.status,
      job_id:       row.job_id,
      triggered_by: row.triggered_by,
      metadata:     row.metadata ?? {},
    })
    if (error) {
      console.error('[saveAgentRun]', error.message)
      return { ok: false, error: 'Could not save agent run.' }
    }
    return { ok: true }
  } catch (err) {
    console.error('[saveAgentRun] unexpected', err)
    return { ok: false, error: 'Could not save agent run.' }
  }
}

// ── notifyInternalTeam ────────────────────────────────────────────
//
// Stub that records an internal notification. Real implementation can
// dispatch email via Resend or push to /team/notifications.

export async function notifyInternalTeam(payload: {
  type:        'audit_pending' | 'audit_complete' | 'audit_failed' | 'business_registered'
  business_id: string
  message:     string
}): Promise<{ ok: boolean }> {
  // Placeholder log — replaced with real notifier in a follow-up phase
  console.log('[notifyInternalTeam]', payload.type, payload.business_id, payload.message)
  return { ok: true }
}

// ── generateClientAuditReport ────────────────────────────────────
//
// Reads the raw Relevance output and produces a client-safe report.
// Strips any provider-specific payload fields before returning.

export function generateClientAuditReport(
  businessId: string,
  raw: Record<string, unknown> | null | undefined,
  status: AuditStatus,
): ClientAuditReport {
  if (!raw || status !== 'complete') {
    return {
      business_id:     businessId,
      status,
      generated_at:    new Date().toISOString(),
      overall_score:   null,
      strengths:       [],
      gaps:            [],
      recommendations: [],
      estimated_lift:  null,
    }
  }

  // Defensively extract well-known fields. Unknown fields are dropped.
  const overall = typeof raw.overall_score === 'number' ? raw.overall_score : null
  const strengths = Array.isArray(raw.strengths) ? (raw.strengths as string[]).slice(0, 8) : []
  const gaps      = Array.isArray(raw.gaps)      ? (raw.gaps as string[]).slice(0, 8) : []
  const recs: ClientAuditReport['recommendations'] = Array.isArray(raw.recommendations)
    ? (raw.recommendations as Array<{ title?: string; detail?: string; impact?: string }>)
      .filter((r) => r && typeof r.title === 'string')
      .slice(0, 10)
      .map((r) => {
        const impact: 'high' | 'medium' | 'low' =
          r.impact === 'high' || r.impact === 'low' ? r.impact : 'medium'
        return {
          title:  String(r.title ?? '').slice(0, 120),
          detail: String(r.detail ?? '').slice(0, 600),
          impact,
        }
      })
    : []
  const estLift = typeof raw.estimated_lift === 'string' ? raw.estimated_lift.slice(0, 80) : null

  return {
    business_id:     businessId,
    status,
    generated_at:    new Date().toISOString(),
    overall_score:   overall,
    strengths,
    gaps,
    recommendations: recs,
    estimated_lift:  estLift,
  }
}

// ── Internal helpers ──────────────────────────────────────────────

function serializeContext(ctx: AuditInputContext): Record<string, string> {
  return {
    business_id:        ctx.business_id,
    business_name:      ctx.business_name,
    industry:           ctx.industry,
    city:               ctx.city,
    website:            ctx.website ?? '',
    instagram:          ctx.instagram ?? '',
    facebook:           ctx.facebook ?? '',
    whatsapp:           ctx.whatsapp ?? '',
    current_booking:    ctx.current_booking,
    monthly_leads:      String(ctx.monthly_leads),
    biggest_problem:    ctx.biggest_problem,
    services:           (ctx.services ?? []).join(', '),
    team_size:          String(ctx.team_size ?? 1),
    existing_software:  ctx.existing_software ?? '',
    preferred_channels: (ctx.preferred_channels ?? []).join(', '),
    selected_plan:      ctx.selected_plan,
  }
}

function mapRelevanceStatus(s: string): AuditStatus {
  if (s === 'complete') return 'complete'
  if (s === 'failed')   return 'failed'
  if (s === 'running')  return 'running'
  return 'queued'
}
