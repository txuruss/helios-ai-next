// ── Helios AI Audit Qualifier Agent trigger ───────────────────────
//
// Triggers the Helios AI Audit Qualifier Agent in Relevance AI after a
// new audit submission is saved to `public.audit_submissions`.
//
// DESIGN
//   • Non-throwing: the caller wraps in try/catch; a failed trigger NEVER
//     blocks the audit submission from completing.
//   • Skips silently (with a log) when RELEVANCE_API_KEY is not set or no
//     trigger URL can be resolved — safe in all environments.
//   • 8-second AbortController timeout as a backstop on the background task.
//   • Auth header: `Key {projectId}:{apiKey}` when RELEVANCE_PROJECT_ID is
//     set (Relevance default); falls back to `Bearer {apiKey}`.
//   • The raw Relevance response is NEVER forwarded to the browser.
//   • All user-supplied strings are converted to plain strings before being
//     sent so the agent receives a clean, typed context.
//
// ENV VARS
//   Required:
//     RELEVANCE_API_KEY          — Relevance AI API key (server-side only)
//     RELEVANCE_TRIGGER_URL      — full trigger endpoint URL (preferred)
//   Optional (fallback when RELEVANCE_TRIGGER_URL is not set):
//     RELEVANCE_AGENT_ID         — agent ID; URL is constructed when combined
//                                  with RELEVANCE_PROJECT_ID + RELEVANCE_REGION
//     RELEVANCE_PROJECT_ID       — project ID; also used in auth header
//     RELEVANCE_REGION           — region slug; defaults to "us-east-1"
//
// SCHEMA NOTE
//   The current `audit_submissions` table supports two fields from the agent
//   output: `qualification_score` (fit_score) and `priority`. All other agent
//   output fields require a migration — see:
//   docs/RELEVANCE-AI-AUDIT-INTEGRATION-PLAN.md

import 'server-only'

// ── Types ─────────────────────────────────────────────────────────

export interface AuditQualifierPayload {
  audit_submission_id:           string
  submitter_name:                string | null
  submitter_email:               string | null
  business_name:                 string
  industry:                      string | null
  city:                          string | null
  country:                       string | null
  website:                       string | null
  instagram:                     string | null
  facebook:                      string | null
  whatsapp:                      string | null
  current_booking_method:        string | null
  monthly_leads:                 number | null
  team_size:                     number | null
  biggest_problem:               string | null
  services_offered:              string | null
  business_hours:                string | null
  existing_booking_software:     string | null
  preferred_automation_channels: string[]
  source:                        string
}

export interface AuditQualifierResult {
  ok:                          boolean
  job_id:                      string | null
  // Structured output — populated when Relevance returns data synchronously.
  // All fields are null when the trigger is async and output is pending.
  fit_score:                   number | null   // 0–100
  priority:                    'low' | 'normal' | 'high' | 'urgent' | null
  main_problem_summary:        string | null
  recommended_offer:           string | null
  recommended_next_step:       string | null
  suggested_follow_up_message: string | null
  internal_notes:              string | null
  risk_flags:                  string[]
  call_recommended:            boolean | null
  error?:                      string
}

// after() frees the user immediately; 8s is a backstop for the background job.
const TIMEOUT_MS = 8_000

// ── Main export ───────────────────────────────────────────────────

export async function triggerAuditQualifier(
  payload: AuditQualifierPayload,
): Promise<AuditQualifierResult> {
  const empty: AuditQualifierResult = {
    ok:                          false,
    job_id:                      null,
    fit_score:                   null,
    priority:                    null,
    main_problem_summary:        null,
    recommended_offer:           null,
    recommended_next_step:       null,
    suggested_follow_up_message: null,
    internal_notes:              null,
    risk_flags:                  [],
    call_recommended:            null,
  }

  const apiKey = process.env.RELEVANCE_API_KEY
  if (!apiKey) {
    console.log('[audit-qualifier] skipped — RELEVANCE_API_KEY not set')
    return { ...empty, error: 'RELEVANCE_API_KEY not configured' }
  }

  const triggerUrl = resolveTriggerUrl()
  if (!triggerUrl) {
    console.log(
      '[audit-qualifier] skipped — no trigger URL. ' +
      'Set RELEVANCE_TRIGGER_URL, or set both RELEVANCE_AGENT_ID and RELEVANCE_PROJECT_ID.',
    )
    return { ...empty, error: 'Trigger URL not configured' }
  }

  const projectId  = process.env.RELEVANCE_PROJECT_ID
  const authHeader = projectId ? `Key ${projectId}:${apiKey}` : `Bearer ${apiKey}`

  const controller = new AbortController()
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS)

  let raw: Record<string, unknown>
  try {
    const res = await fetch(triggerUrl, {
      method: 'POST',
      headers: {
        Authorization:  authHeader,
        'Content-Type': 'application/json',
      },
      body:   JSON.stringify(buildBody(payload)),
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error(`[audit-qualifier] HTTP ${res.status}: ${body.slice(0, 200)}`)
      return { ...empty, error: `Relevance API error ${res.status}` }
    }

    raw = (await res.json().catch(() => ({}))) as Record<string, unknown>
  } catch (err) {
    clearTimeout(timer)
    const isTimeout = err instanceof Error && err.name === 'AbortError'
    const msg       = err instanceof Error ? err.message : String(err)
    console.error(`[audit-qualifier] ${isTimeout ? 'timeout after 8s' : 'fetch error'}: ${msg}`)
    return { ...empty, error: isTimeout ? 'Request timed out' : 'Fetch failed' }
  }

  const jobId = typeof raw.job_id === 'string' ? raw.job_id : null

  // Some sync triggers return the output nested under `output`; async triggers
  // return `{ job_id }` with no output yet. Handle both gracefully.
  const outputSource =
    typeof raw.output === 'object' && raw.output !== null
      ? (raw.output as Record<string, unknown>)
      : raw

  const result = normalizeOutput(outputSource, jobId)
  console.log(
    `[audit-qualifier] triggered for ${payload.business_name}` +
    (jobId          ? ` | job_id=${jobId}`                           : '') +
    (result.fit_score !== null ? ` | fit_score=${result.fit_score}` : ''),
  )
  return result
}

// ── Helpers ───────────────────────────────────────────────────────

function resolveTriggerUrl(): string | null {
  const direct = process.env.RELEVANCE_TRIGGER_URL
  if (direct) return direct

  const agentId   = process.env.RELEVANCE_AGENT_ID
  const projectId = process.env.RELEVANCE_PROJECT_ID
  const region    = process.env.RELEVANCE_REGION ?? 'us-east-1'

  if (agentId && projectId) {
    return `https://${region}-relevance-ai.b8.workers.dev/latest/studios/${agentId}/trigger_async`
  }

  return null
}

function buildBody(payload: AuditQualifierPayload): unknown {
  return {
    message: {
      role:    'human',
      content: `Qualify this audit submission for ${payload.business_name}.`,
    },
    max_steps: 15,
    context:   buildContext(payload),
  }
}

function buildContext(payload: AuditQualifierPayload): Record<string, string> {
  return {
    audit_submission_id:           payload.audit_submission_id,
    submitter_name:                payload.submitter_name          ?? '',
    submitter_email:               payload.submitter_email         ?? '',
    business_name:                 payload.business_name,
    industry:                      payload.industry                ?? '',
    city:                          payload.city                    ?? '',
    country:                       payload.country                 ?? '',
    website:                       payload.website                 ?? '',
    instagram:                     payload.instagram               ?? '',
    facebook:                      payload.facebook                ?? '',
    whatsapp:                      payload.whatsapp                ?? '',
    current_booking_method:        payload.current_booking_method  ?? '',
    monthly_leads:                 payload.monthly_leads  !== null ? String(payload.monthly_leads)  : '',
    team_size:                     payload.team_size      !== null ? String(payload.team_size)      : '',
    biggest_problem:               payload.biggest_problem         ?? '',
    services_offered:              payload.services_offered        ?? '',
    business_hours:                payload.business_hours          ?? '',
    existing_booking_software:     payload.existing_booking_software ?? '',
    preferred_automation_channels: payload.preferred_automation_channels.join(', '),
    source:                        payload.source,
  }
}

function normalizeOutput(
  output: Record<string, unknown>,
  jobId:  string | null,
): AuditQualifierResult {
  return {
    ok:                          true,
    job_id:                      jobId,
    fit_score:                   extractScore(output.fit_score),
    priority:                    normalizePriority(output.priority),
    main_problem_summary:        extractStr(output.main_problem_summary,        1000),
    recommended_offer:           extractStr(output.recommended_offer,           500),
    recommended_next_step:       extractStr(output.recommended_next_step,       500),
    suggested_follow_up_message: extractStr(output.suggested_follow_up_message, 2000),
    internal_notes:              extractStr(output.internal_notes,              2000),
    risk_flags:                  extractStrArray(output.risk_flags, 10),
    call_recommended:            typeof output.call_recommended === 'boolean' ? output.call_recommended : null,
  }
}

function extractScore(v: unknown): number | null {
  if (typeof v !== 'number' || Number.isNaN(v)) return null
  return Math.min(100, Math.max(0, Math.round(v)))
}

function extractStr(v: unknown, maxLen: number): string | null {
  if (typeof v !== 'string' || v.length === 0) return null
  return v.slice(0, maxLen)
}

function extractStrArray(v: unknown, maxItems: number): string[] {
  if (!Array.isArray(v)) return []
  return v.slice(0, maxItems).map(String)
}

function normalizePriority(v: unknown): 'low' | 'normal' | 'high' | 'urgent' | null {
  if (v === 'low' || v === 'normal' || v === 'high' || v === 'urgent') return v
  // Accept common aliases from the agent
  if (v === 'medium') return 'normal'
  if (typeof v === 'number') {
    if (v >= 80) return 'urgent'
    if (v >= 60) return 'high'
    if (v >= 30) return 'normal'
    return 'low'
  }
  return null
}
