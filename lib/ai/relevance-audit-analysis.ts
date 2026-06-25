// ── Manual Relevance AI audit analysis (synchronous) ──────────────
//
// Triggered by the founder from /admin/audits ("Run AI Audit"). Sends an
// audit submission to a Relevance AI agent and returns STRUCTURED output
// for storage in admin_audit_ai_results.
//
// DESIGN
//   • Server-only; the API key never reaches the browser.
//   • Non-throwing: returns { ok:false, error } on any failure so the
//     caller can persist a 'failed' result instead of crashing.
//   • NEVER fabricates results — fields are only populated from the
//     agent's actual response. If the agent returns no usable structured
//     output, ok:false with the raw response preserved for debugging.
//   • No auto-conversion, no outreach, no client/payment writes.
//
// ENV VARS (new names preferred; legacy RELEVANCE_* accepted as fallback)
//   RELEVANCE_AI_API_KEY   (or RELEVANCE_API_KEY)        — required
//   RELEVANCE_AI_AGENT_ID  (or RELEVANCE_AGENT_ID)       — required (unless URL)
//   RELEVANCE_AI_REGION    (or RELEVANCE_REGION)         — default us-east-1
//   RELEVANCE_AI_PROJECT_ID(or RELEVANCE_PROJECT_ID)     — optional (auth header)
//   RELEVANCE_AI_TRIGGER_URL (or RELEVANCE_TRIGGER_URL)  — optional full URL override

import 'server-only'

export interface AuditAnalysisInput {
  audit_id:               string
  business_name:          string
  contact_name:           string | null
  email:                  string | null
  industry:               string | null
  city:                   string | null
  country:                string | null
  website:                string | null
  current_booking:        string | null
  monthly_leads:          string | null
  biggest_problem:        string | null
  services_offered:       string | null
  business_hours:         string | null
  existing_software:      string | null
  preferred_channels:     string[]
  selected_plan:          string | null
}

export type LeadPriority = 'low' | 'medium' | 'high' | 'urgent'
export type RecommendedOffer = 'Starter' | 'Booking OS' | 'Helios AIOS' | 'Custom'

export interface AuditAiAnalysis {
  business_summary:         string | null
  fit_score:                number | null
  urgency_score:            number | null
  lead_priority:            LeadPriority | null
  recommended_offer:        RecommendedOffer | null
  automation_opportunities: string[]
  missing_information:      string[]
  suggested_next_action:    string | null
  founder_notes:            string | null
  raw_agent_response:       unknown
}

export type AnalysisResult =
  | { ok: true; analysis: AuditAiAnalysis }
  | { ok: false; error: string; raw?: unknown }

const TIMEOUT_MS = 45_000

function apiKey():    string | undefined { return process.env.RELEVANCE_AI_API_KEY    || process.env.RELEVANCE_API_KEY }
function agentId():   string | undefined { return process.env.RELEVANCE_AI_AGENT_ID   || process.env.RELEVANCE_AGENT_ID }
function projectId(): string | undefined { return process.env.RELEVANCE_AI_PROJECT_ID || process.env.RELEVANCE_PROJECT_ID }
function region():    string             { return process.env.RELEVANCE_AI_REGION     || process.env.RELEVANCE_REGION || 'us-east-1' }

function resolveTriggerUrl(): string | null {
  const direct = process.env.RELEVANCE_AI_TRIGGER_URL || process.env.RELEVANCE_TRIGGER_URL
  if (direct) return direct
  const id = agentId()
  if (id) return `https://${region()}-relevance-ai.b8.workers.dev/latest/studios/${id}/trigger`
  return null
}

// Configured = key present AND a trigger URL resolvable.
export function relevanceAiConfigured(): boolean {
  return !!apiKey() && !!resolveTriggerUrl()
}

export async function runRelevanceAuditAnalysis(input: AuditAnalysisInput): Promise<AnalysisResult> {
  const key = apiKey()
  if (!key) return { ok: false, error: 'Relevance AI not connected (missing API key).' }
  const url = resolveTriggerUrl()
  if (!url) return { ok: false, error: 'Relevance AI not connected (missing agent ID / trigger URL).' }

  const auth = projectId() ? `Key ${projectId()}:${key}` : `Bearer ${key}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  let raw: unknown
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: { role: 'human', content: `Analyze this audit submission for ${input.business_name} and return the structured audit fields.` },
        max_steps: 20,
        context: buildContext(input),
      }),
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { ok: false, error: `Relevance API error ${res.status}.`, raw: body.slice(0, 500) }
    }
    raw = await res.json().catch(() => ({}))
  } catch (err) {
    clearTimeout(timer)
    const isTimeout = err instanceof Error && err.name === 'AbortError'
    return { ok: false, error: isTimeout ? 'Relevance AI request timed out.' : 'Relevance AI request failed.' }
  }

  const parsed = parseAnalysis(raw)
  if (!parsed) {
    return { ok: false, error: 'Agent did not return usable structured output.', raw }
  }
  return { ok: true, analysis: { ...parsed, raw_agent_response: raw } }
}

// ── Parsing / normalization ───────────────────────────────────────

function buildContext(i: AuditAnalysisInput): Record<string, string> {
  return {
    audit_id:           i.audit_id,
    business_name:      i.business_name,
    contact_name:       i.contact_name ?? '',
    email:              i.email ?? '',
    industry:           i.industry ?? '',
    city:               i.city ?? '',
    country:            i.country ?? '',
    website:            i.website ?? '',
    current_booking:    i.current_booking ?? '',
    monthly_leads:      i.monthly_leads ?? '',
    biggest_problem:    i.biggest_problem ?? '',
    services_offered:   i.services_offered ?? '',
    business_hours:     i.business_hours ?? '',
    existing_software:  i.existing_software ?? '',
    preferred_channels: i.preferred_channels.join(', '),
    selected_plan:      i.selected_plan ?? '',
  }
}

// Drills into the common Relevance response shapes to find the agent's
// structured object. Returns null when nothing usable is present.
function parseAnalysis(raw: unknown): Omit<AuditAiAnalysis, 'raw_agent_response'> | null {
  const candidates: Record<string, unknown>[] = []
  const root = (raw ?? {}) as Record<string, unknown>
  pushObj(candidates, root)
  pushObj(candidates, root.output)
  if (root.output && typeof root.output === 'object') pushObj(candidates, (root.output as Record<string, unknown>).answer)
  pushObj(candidates, root.answer)
  // Some agents return a JSON string in `answer` / `output`.
  for (const v of [root.answer, root.output, (root.output as Record<string, unknown> | undefined)?.answer]) {
    if (typeof v === 'string') { const o = tryJson(v); if (o) pushObj(candidates, o) }
  }

  for (const c of candidates) {
    const a = extractFrom(c)
    if (a) return a
  }
  return null
}

function pushObj(arr: Record<string, unknown>[], v: unknown) {
  if (v && typeof v === 'object' && !Array.isArray(v)) arr.push(v as Record<string, unknown>)
}
function tryJson(s: string): Record<string, unknown> | null {
  try { const o = JSON.parse(s); return o && typeof o === 'object' ? o as Record<string, unknown> : null } catch { return null }
}

function extractFrom(o: Record<string, unknown>): Omit<AuditAiAnalysis, 'raw_agent_response'> | null {
  const summary   = str(o.business_summary ?? o.summary, 2000)
  const fit       = score(o.fit_score)
  const urgency   = score(o.urgency_score)
  const priority  = priorityOf(o.lead_priority ?? o.priority)
  const offer     = offerOf(o.recommended_offer ?? o.offer)
  const autos     = strArray(o.automation_opportunities ?? o.automations, 20)
  const missing   = strArray(o.missing_information ?? o.missing_info ?? o.missing, 20)
  const nextAction = str(o.suggested_next_action ?? o.next_action, 1000)
  const notes     = str(o.founder_notes ?? o.notes, 2000)

  // Require at least one meaningful field, else this candidate isn't the output.
  const hasSomething =
    summary !== null || fit !== null || urgency !== null || priority !== null ||
    offer !== null || autos.length > 0 || missing.length > 0 || nextAction !== null
  if (!hasSomething) return null

  return {
    business_summary: summary,
    fit_score: fit,
    urgency_score: urgency,
    lead_priority: priority,
    recommended_offer: offer,
    automation_opportunities: autos,
    missing_information: missing,
    suggested_next_action: nextAction,
    founder_notes: notes,
  }
}

function str(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t.length === 0 ? null : t.slice(0, max)
}
function score(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  if (Number.isNaN(n)) return null
  return Math.min(100, Math.max(0, Math.round(n)))
}
function strArray(v: unknown, max: number): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean).slice(0, max)
  if (typeof v === 'string' && v.trim()) return v.split(/[,\n]/).map((s) => s.trim()).filter(Boolean).slice(0, max)
  return []
}
function priorityOf(v: unknown): LeadPriority | null {
  if (v === 'low' || v === 'medium' || v === 'high' || v === 'urgent') return v
  if (v === 'normal') return 'medium'
  if (typeof v === 'number') {
    if (v >= 80) return 'urgent'
    if (v >= 60) return 'high'
    if (v >= 30) return 'medium'
    return 'low'
  }
  return null
}
function offerOf(v: unknown): RecommendedOffer | null {
  if (typeof v !== 'string' || !v.trim()) return null
  const s = v.toLowerCase()
  if (s.includes('starter')) return 'Starter'
  if (s.includes('booking') || s === 'pro' || s.includes('growth')) return 'Booking OS'
  if (s.includes('ops') || s === 'scale' || s.includes('command')) return 'Helios AIOS'
  if (s.includes('custom')) return 'Custom'
  return 'Custom'
}
