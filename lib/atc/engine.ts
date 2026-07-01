// ════════════════════════════════════════════════════════════════════
// Audit-to-Close Engine — server-only generation core + orchestrator
// ════════════════════════════════════════════════════════════════════
//
// SAFETY RULES (see docs/security-guardrails.md)
//   • Server-only. The Anthropic key never reaches the browser.
//   • DRAFTS ONLY — nothing here sends an email/DM/message. Human
//     approval + manual sending is required for all outreach.
//   • The AI never writes prices or package names. Those are injected
//     from lib/billing/packages.ts (canonical) so pricing can't be
//     hallucinated.
//   • Grounded generation: prompts contain ONLY facts we hold on the
//     lead/audit; the system prompt forbids invented facts, guaranteed
//     revenue, and exaggeration.
//   • Every generator re-authorizes the lead through the scoped data
//     layer (founder: all; agent: created/assigned only) and logs a row
//     in atc_agent_runs.

import 'server-only'

import Anthropic from '@anthropic-ai/sdk'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getAuthorizedLeadById, getAtcLeadDetail, isMissingTable, ATC_MIGRATION_HINT } from '@/lib/data/atc-leads'
import { qualifyLeadRules } from '@/lib/atc/qualify'
import { PACKAGES } from '@/lib/billing/packages'
import {
  AI_KEY_MISSING_ERROR, ATC_AUDIT_CATEGORIES, isPainCategory, isSeverity,
  type AtcActionResult, type AtcLead, type AtcAudit, type AtcPainPoint,
  type AtcOffer, type AtcOutreachMessages, type AtcQualification, type AtcStatus,
} from '@/lib/atc/types'
import type { TeamSession } from '@/lib/auth/types'

// Internal, low-volume sales generation → prioritize quality.
const ATC_MODEL = 'claude-sonnet-5'
const MAX_TOKENS = 3000

// Conservative, founder-editable timeline copy per package (drafts — the
// founder confirms real dates on the call; "typically" keeps it honest).
const TIMELINES: Record<'starter' | 'pro' | 'scale', string> = {
  starter: 'Typically 1–2 weeks from kickoff to launch.',
  pro:     'Typically 2–3 weeks from kickoff to launch.',
  scale:   'Typically 3–4 weeks from kickoff to launch.',
}

type Db = ReturnType<typeof createServiceRoleClient>

// ── Agent run logging (atc_agent_runs) ──────────────────────────────
// Best-effort: a logging failure must never block generation.

async function startRun(
  db: Db, session: TeamSession, leadId: string, agent: string, input: unknown,
): Promise<string | null> {
  try {
    const { data, error } = await db.from('atc_agent_runs').insert({
      lead_id:    leadId,
      agent_name: agent,
      status:     'running',
      input_json: input ?? null,
      created_by_team_member_id:
        /^[0-9a-f-]{36}$/i.test(session.teamMemberId) ? session.teamMemberId : null,
      created_by_name: session.fullName ?? session.email ?? null,
    }).select('id').single()
    if (error) throw error
    return String((data as { id: unknown }).id)
  } catch (err) {
    console.warn('[atc startRun] could not log run:', err instanceof Error ? err.message : err)
    return null
  }
}

async function finishRun(db: Db, runId: string | null, ok: boolean, output: unknown, errorMsg?: string) {
  if (!runId) return
  try {
    await db.from('atc_agent_runs').update({
      status:        ok ? 'completed' : 'failed',
      output_json:   ok ? (output ?? null) : null,
      error_message: ok ? null : (errorMsg ?? 'Unknown error').slice(0, 2000),
      completed_at:  new Date().toISOString(),
    }).eq('id', runId)
  } catch { /* non-fatal */ }
}

// ── Structured AI generation ────────────────────────────────────────

const SYSTEM_PROMPT =
  'You are a sales analyst for Helios AI, an agency that builds AI booking and lead-response systems ' +
  'for local service businesses (salons, spas, clinics, barbershops, dentists, gyms, med spas).\n' +
  'HARD RULES:\n' +
  '1. Use ONLY the facts provided. Never invent names, numbers, reviews, tools, or details.\n' +
  '2. Never promise or imply guaranteed revenue, guaranteed bookings, or specific results.\n' +
  '3. Use careful language for anything unverified: "may", "could", "appears", "worth verifying".\n' +
  '4. Be direct, specific, and practical. No hype, no fake compliments, no spam patterns.\n' +
  '5. Do not mention prices or package names — those are added by the system, not you.\n' +
  '6. Respond with VALID JSON only. No markdown fences, no commentary before or after.'

function extractJson(raw: string): unknown {
  let t = raw.trim()
  // Strip accidental code fences despite instructions.
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  // Fall back to the outermost JSON object/array if extra prose slipped in.
  const first = Math.min(...['{', '['].map((c) => { const i = t.indexOf(c); return i === -1 ? Infinity : i }))
  if (first !== Infinity && first > 0) t = t.slice(first)
  return JSON.parse(t)
}

async function generateJson(prompt: string): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: AI_KEY_MISSING_ERROR }
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const res = await anthropic.messages.create({
      model:      ATC_MODEL,
      max_tokens: MAX_TOKENS,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: prompt }],
    })
    const text = res.content.find((b) => b.type === 'text')
    if (!text || text.type !== 'text' || !text.text.trim()) return { ok: false, error: 'AI returned an empty response.' }
    try {
      return { ok: true, data: extractJson(text.text) }
    } catch {
      return { ok: false, error: 'AI did not return valid JSON. Try again.' }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    console.error('[atc generateJson]', msg)
    if (msg.includes('401') || msg.toLowerCase().includes('auth')) return { ok: false, error: AI_KEY_MISSING_ERROR }
    return { ok: false, error: 'AI request failed. Try again.' }
  }
}

// ── Prompt facts (only what we actually hold) ───────────────────────

function leadFacts(lead: AtcLead): string {
  const f: string[] = [`Business: ${lead.business_name}`]
  if (lead.industry)        f.push(`Industry: ${lead.industry}`)
  if (lead.location)        f.push(`Location: ${lead.location}`)
  if (lead.website_url)     f.push(`Website: ${lead.website_url}`)
  else                      f.push('Website: none found')
  if (lead.instagram_url)   f.push(`Instagram: ${lead.instagram_url}`)
  if (lead.facebook_url)    f.push(`Facebook: ${lead.facebook_url}`)
  if (lead.phone)           f.push(`Phone: ${lead.phone}`)
  if (lead.whatsapp_number) f.push(`WhatsApp: ${lead.whatsapp_number}`)
  if (lead.opening_hours)   f.push(`Opening hours: ${lead.opening_hours}`)
  if (lead.rating !== null)       f.push(`Google rating: ${lead.rating}★`)
  if (lead.review_count !== null) f.push(`Review count: ${lead.review_count}`)
  if (lead.services)        f.push(`Services: ${lead.services}`)
  if (lead.notes)           f.push(`Internal notes: ${lead.notes}`)
  return f.join('\n')
}

function auditFacts(audit: AtcAudit): string {
  const lines: string[] = []
  if (audit.audit_summary) lines.push(`Audit summary: ${audit.audit_summary}`)
  for (const cat of ATC_AUDIT_CATEGORIES) {
    const c = audit.audit_json[cat.key]
    if (!c) continue
    const bits: string[] = []
    if (c.score !== null && c.score !== undefined) bits.push(`score ${c.score}/10`)
    if (c.issue)              bits.push(`issue: ${c.issue}`)
    if (c.suggested_fix)      bits.push(`fix: ${c.suggested_fix}`)
    if (c.helios_opportunity) bits.push(`opportunity: ${c.helios_opportunity}`)
    if (bits.length) lines.push(`${cat.label} — ${bits.join(' | ')}`)
  }
  return lines.length ? lines.join('\n') : '(no category details recorded)'
}

function s(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}
function strArray(v: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .slice(0, maxItems).map((x) => x.trim().slice(0, maxLen))
}

// Advance status forward only — generation never moves a lead backwards
// (e.g. re-running the offer on a 'contacted' lead keeps it 'contacted').
const STATUS_RANK: Record<string, number> = {
  new: 0, researching: 1, audited: 2, qualified: 3, ready_for_outreach: 4,
  contacted: 5, follow_up_needed: 6, discovery_booked: 7, proposal_sent: 8,
  closed: 9, lost: 9, archived: 9,
}
function advanceStatus(current: AtcStatus, target: AtcStatus): AtcStatus {
  return STATUS_RANK[target] > STATUS_RANK[current] ? target : current
}

// ── Validation (orchestrator stage 1) ───────────────────────────────

export function validateLeadDetails(lead: AtcLead): { errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []
  if (!lead.business_name || lead.business_name === '(unnamed)') errors.push('Missing required field: business_name.')
  if (!lead.industry) errors.push('Missing required field: industry.')
  if (!lead.phone && !lead.email && !lead.instagram_url && !lead.whatsapp_number && !lead.website_url)
    errors.push('No contact channel on the lead (phone, email, Instagram, WhatsApp, or website).')
  if (!lead.location)     warnings.push('Location is empty — outreach will be less specific.')
  if (!lead.services)     warnings.push('Services are empty — offer and outreach will be more generic.')
  if (lead.review_count === null) warnings.push('Review count unknown — demand signals are weaker.')
  return { errors, warnings }
}

// ════════════════════════════════════════════════════════════════════
// 1. Pain point generation (AI, grounded in lead + audit)
// ════════════════════════════════════════════════════════════════════

export async function runPainPoints(session: TeamSession, leadId: string): Promise<AtcActionResult<AtcPainPoint[]>> {
  const detail = await getAtcLeadDetail(session, leadId)
  if (!detail) return { ok: false, errors: ['Lead not found.'] }
  if (!detail.audit) return { ok: false, errors: ['Save an audit for this lead first — pain points are generated from the audit.'] }

  const db = createServiceRoleClient()
  const runId = await startRun(db, session, leadId, 'pain_points', { business: detail.lead.business_name })

  const prompt =
    `Generate the business pain points for this local service business, based ONLY on these facts.\n\n` +
    `FACTS:\n${leadFacts(detail.lead)}\n\nAUDIT FINDINGS:\n${auditFacts(detail.audit)}\n\n` +
    `Return a JSON array of 3 to 8 pain points. Each item:\n` +
    `{"category": one of ${JSON.stringify(['missed_lead_risk','booking_friction','slow_response_risk','weak_trust_signals','poor_mobile_experience','poor_conversion','no_automation','weak_follow_up','manual_owner_workload'])},\n` +
    ` "severity": "low"|"medium"|"high"|"critical",\n` +
    ` "evidence": what specific fact/audit finding shows this (quote the fact),\n` +
    ` "business_impact": what it may be costing them, in careful language,\n` +
    ` "recommended_solution": the practical fix (an AI assistant capability, not a product pitch),\n` +
    ` "sales_angle": one direct sentence the team could open with}\n` +
    `Only include pain points actually supported by the facts. Fewer, well-grounded items beat many weak ones.`

  const gen = await generateJson(prompt)
  if (!gen.ok) {
    await finishRun(db, runId, false, null, gen.error)
    return { ok: false, errors: [gen.error], runId: runId ?? undefined }
  }

  // Validate + clamp every item; drop anything malformed.
  const items = (Array.isArray(gen.data) ? gen.data : []).flatMap((raw) => {
    const r = raw as Record<string, unknown>
    if (!isPainCategory(r.category)) return []
    return [{
      lead_id:              detail.lead.id,
      audit_id:             detail.audit!.id,
      category:             r.category,
      severity:             isSeverity(r.severity) ? r.severity : 'medium',
      evidence:             s(r.evidence, 1000) || null,
      business_impact:      s(r.business_impact, 1000) || null,
      recommended_solution: s(r.recommended_solution, 1000) || null,
      sales_angle:          s(r.sales_angle, 500) || null,
    }]
  })
  if (items.length === 0) {
    await finishRun(db, runId, false, null, 'AI returned no valid pain points.')
    return { ok: false, errors: ['AI returned no valid pain points. Try again.'], runId: runId ?? undefined }
  }

  // Replace previous generation (derived artifacts — regenerable by design).
  const del = await db.from('atc_pain_points').delete().eq('lead_id', detail.lead.id)
  if (del.error && !isMissingTable(del.error)) {
    await finishRun(db, runId, false, null, del.error.message)
    return { ok: false, errors: ['Could not replace previous pain points.'], runId: runId ?? undefined }
  }
  const ins = await db.from('atc_pain_points').insert(items).select('*')
  if (ins.error) {
    const msg = isMissingTable(ins.error) ? ATC_MIGRATION_HINT : 'Could not save pain points.'
    await finishRun(db, runId, false, null, ins.error.message)
    return { ok: false, errors: [msg], runId: runId ?? undefined }
  }

  await finishRun(db, runId, true, { count: items.length })
  const saved = (ins.data ?? []) as unknown as AtcPainPoint[]
  return { ok: true, data: saved, runId: runId ?? undefined }
}

// ════════════════════════════════════════════════════════════════════
// 2. Qualification (deterministic rules — always available, no AI needed)
// ════════════════════════════════════════════════════════════════════

export async function runQualification(session: TeamSession, leadId: string): Promise<AtcActionResult<AtcQualification>> {
  const detail = await getAtcLeadDetail(session, leadId)
  if (!detail) return { ok: false, errors: ['Lead not found.'] }
  if (!detail.audit) return { ok: false, errors: ['Save an audit for this lead first — qualification uses the audit scores.'] }

  const db = createServiceRoleClient()
  const runId = await startRun(db, session, leadId, 'qualification', { business: detail.lead.business_name })

  const q = qualifyLeadRules({ lead: detail.lead, audit: detail.audit, painPoints: detail.painPoints })

  const { error } = await db.from('atc_leads').update({
    fit_score:           q.fit_score,
    fit_level:           q.fit_level,
    recommended_package: q.recommended_package,
    close_difficulty:    q.close_difficulty,
    qualification_json:  q,
    qualified_at:        new Date().toISOString(),
    status:              advanceStatus(detail.lead.status, 'qualified'),
  }).eq('id', detail.lead.id)

  if (error) {
    const msg = isMissingTable(error) ? ATC_MIGRATION_HINT : 'Could not save qualification.'
    await finishRun(db, runId, false, null, error.message)
    return { ok: false, errors: [msg], runId: runId ?? undefined }
  }

  await finishRun(db, runId, true, { fit_score: q.fit_score, package: q.recommended_package })
  const warnings = detail.painPoints.length === 0
    ? ['No pain points existed yet — generate pain points for a stronger owner-pain signal, then re-qualify.'] : undefined
  return { ok: true, data: q, warnings, runId: runId ?? undefined }
}

// ════════════════════════════════════════════════════════════════════
// 3. Offer generation (AI copy + CODE-injected prices/deliverables)
// ════════════════════════════════════════════════════════════════════

export async function runOffer(session: TeamSession, leadId: string): Promise<AtcActionResult<AtcOffer>> {
  const detail = await getAtcLeadDetail(session, leadId)
  if (!detail) return { ok: false, errors: ['Lead not found.'] }
  if (!detail.audit) return { ok: false, errors: ['Save an audit first — the offer is built from the audit.'] }
  const qual = detail.lead.qualification_json
  if (!qual) return { ok: false, errors: ['Qualify the lead first — the offer uses the recommended package.'] }

  const db = createServiceRoleClient()
  const runId = await startRun(db, session, leadId, 'offer', { business: detail.lead.business_name, package: qual.recommended_package })

  const pkg = PACKAGES[qual.recommended_package]
  const painLines = detail.painPoints.map((p) =>
    `- [${p.severity}] ${p.category}: ${p.evidence ?? ''} → ${p.business_impact ?? ''}`).join('\n')

  const prompt =
    `Write the narrative parts of a sales offer for this business, based ONLY on these facts.\n\n` +
    `FACTS:\n${leadFacts(detail.lead)}\n\nAUDIT FINDINGS:\n${auditFacts(detail.audit)}\n\n` +
    `PAIN POINTS:\n${painLines || '(none recorded)'}\n\n` +
    `WHAT THE SYSTEM WILL BE ABLE TO DO (the package build — rephrase per-business, do not add capabilities):\n` +
    pkg.setupIncludes.map((x) => `- ${x}`).join('\n') + '\n\n' +
    `Return JSON:\n` +
    `{"diagnosis": 2-3 sentences on their specific situation, grounded in the audit,\n` +
    ` "main_pain_points": 2-4 short strings, each tied to evidence above,\n` +
    ` "what_we_build": 3-6 short strings describing the build IN THEIR CONTEXT (only capabilities from the list),\n` +
    ` "why_it_matters": 2-3 sentences on why this matters for THIS business, careful language,\n` +
    ` "cta": one sentence inviting a short call or demo — direct, no pressure}`

  const gen = await generateJson(prompt)
  if (!gen.ok) {
    await finishRun(db, runId, false, null, gen.error)
    return { ok: false, errors: [gen.error], runId: runId ?? undefined }
  }

  const r = gen.data as Record<string, unknown>
  const offer: AtcOffer = {
    // Canonical, code-owned fields — the AI cannot influence these.
    package_id:          qual.recommended_package,
    package_name:        pkg.displayName,
    setup_price_label:   pkg.setupFeeLabel,
    monthly_price_label: pkg.monthlyFeeLabel,
    deliverables:        [...pkg.setupIncludes],
    monthly_covers:      [...pkg.monthlyIncludes],
    timeline:            TIMELINES[qual.recommended_package],
    // AI narrative (validated + clamped).
    diagnosis:           s(r.diagnosis, 1500),
    main_pain_points:    strArray(r.main_pain_points, 4, 300),
    what_we_build:       strArray(r.what_we_build, 6, 300),
    why_it_matters:      s(r.why_it_matters, 1500),
    cta:                 s(r.cta, 300),
  }
  if (!offer.diagnosis || offer.what_we_build.length === 0) {
    await finishRun(db, runId, false, null, 'AI offer output incomplete.')
    return { ok: false, errors: ['AI offer output was incomplete. Try again.'], runId: runId ?? undefined }
  }

  const { error } = await db.from('atc_leads').update({
    offer_json:         offer,
    offer_generated_at: new Date().toISOString(),
  }).eq('id', detail.lead.id)
  if (error) {
    await finishRun(db, runId, false, null, error.message)
    return { ok: false, errors: [isMissingTable(error) ? ATC_MIGRATION_HINT : 'Could not save offer.'], runId: runId ?? undefined }
  }

  await finishRun(db, runId, true, { package: offer.package_id })
  return { ok: true, data: offer, runId: runId ?? undefined }
}

// ════════════════════════════════════════════════════════════════════
// 4. Outreach message generation (AI drafts — NEVER auto-sent)
// ════════════════════════════════════════════════════════════════════

export async function runOutreach(session: TeamSession, leadId: string): Promise<AtcActionResult<AtcOutreachMessages>> {
  const detail = await getAtcLeadDetail(session, leadId)
  if (!detail) return { ok: false, errors: ['Lead not found.'] }
  const qual = detail.lead.qualification_json
  if (!qual) return { ok: false, errors: ['Qualify the lead first — outreach uses the best angle from qualification.'] }

  const db = createServiceRoleClient()
  const runId = await startRun(db, session, leadId, 'outreach', { business: detail.lead.business_name })

  const topPains = detail.painPoints.slice(0, 3).map((p) => `- ${p.sales_angle ?? p.evidence ?? p.category}`).join('\n')
  const prompt =
    `Draft outreach messages for this business, based ONLY on these facts. These are DRAFTS a human will edit and send manually.\n\n` +
    `FACTS:\n${leadFacts(detail.lead)}\n\n` +
    `BEST ANGLE: ${qual.best_outreach_angle}\n` +
    `TOP PAIN POINTS:\n${topPains || '(none)'}\n\n` +
    `TONE: direct, helpful, specific to this business. No fake compliments, no hype, no "I hope this finds you well", ` +
    `no unrealistic claims, no walls of text. Reference one concrete observed fact per message. Sign-off placeholder: [Your name], Helios AI.\n\n` +
    `Return JSON:\n` +
    `{"cold_email": {"subject": short + specific, "body": under 120 words},\n` +
    ` "follow_up_email": {"subject": ..., "body": under 80 words, references the first email politely, adds ONE new specific point},\n` +
    ` "instagram_dm": under 60 words, casual but professional,\n` +
    ` "whatsapp_message": under 60 words,\n` +
    ` "call_script": a short opener + 2-3 discovery questions + a close asking for a 15-minute demo, under 150 words}`

  const gen = await generateJson(prompt)
  if (!gen.ok) {
    await finishRun(db, runId, false, null, gen.error)
    return { ok: false, errors: [gen.error], runId: runId ?? undefined }
  }

  const r = gen.data as Record<string, unknown>
  const ce = (r.cold_email ?? {}) as Record<string, unknown>
  const fe = (r.follow_up_email ?? {}) as Record<string, unknown>
  const messages: AtcOutreachMessages = {
    cold_email:       { subject: s(ce.subject, 200), body: s(ce.body, 2000) },
    follow_up_email:  { subject: s(fe.subject, 200), body: s(fe.body, 2000) },
    instagram_dm:     s(r.instagram_dm, 1000),
    whatsapp_message: s(r.whatsapp_message, 1000),
    call_script:      s(r.call_script, 3000),
  }
  if (!messages.cold_email.body || !messages.call_script) {
    await finishRun(db, runId, false, null, 'AI outreach output incomplete.')
    return { ok: false, errors: ['AI outreach output was incomplete. Try again.'], runId: runId ?? undefined }
  }

  const { error } = await db.from('atc_leads').update({
    outreach_json:         messages,
    outreach_generated_at: new Date().toISOString(),
  }).eq('id', detail.lead.id)
  if (error) {
    await finishRun(db, runId, false, null, error.message)
    return { ok: false, errors: [isMissingTable(error) ? ATC_MIGRATION_HINT : 'Could not save outreach drafts.'], runId: runId ?? undefined }
  }

  await finishRun(db, runId, true, { drafted: true })
  return { ok: true, data: messages, runId: runId ?? undefined }
}

// ════════════════════════════════════════════════════════════════════
// 5. Orchestrator — full Audit-to-Close pipeline
// ════════════════════════════════════════════════════════════════════
// Each stage saves its own output before the next starts, so a failure
// midway never loses completed work. Requires the audit to exist (the
// audit is human judgment — the engine refuses to fabricate one).

export interface OrchestratorOutput {
  stages: Array<{ stage: string; ok: boolean; detail: string }>
  finalStatus: AtcStatus | null
}

export async function runOrchestrator(session: TeamSession, leadId: string): Promise<AtcActionResult<OrchestratorOutput>> {
  const lead = await getAuthorizedLeadById(session, leadId)
  if (!lead) return { ok: false, errors: ['Lead not found.'] }

  const db = createServiceRoleClient()
  const runId = await startRun(db, session, leadId, 'orchestrator', { business: lead.business_name })
  const stages: OrchestratorOutput['stages'] = []
  const warnings: string[] = []

  // Stage 1 — validate lead details.
  const v = validateLeadDetails(lead)
  warnings.push(...v.warnings)
  if (v.errors.length > 0) {
    stages.push({ stage: 'Validate lead', ok: false, detail: v.errors.join(' ') })
    await finishRun(db, runId, false, { stages }, v.errors.join(' '))
    return { ok: false, errors: v.errors, warnings, data: { stages, finalStatus: null }, runId: runId ?? undefined }
  }
  stages.push({ stage: 'Validate lead', ok: true, detail: 'Required fields present.' })

  // Stage 2 — confirm the audit exists (human-entered; never fabricated).
  const detail = await getAtcLeadDetail(session, leadId)
  if (!detail?.audit) {
    stages.push({ stage: 'Confirm audit', ok: false, detail: 'No audit saved. Fill in the Audit tab first.' })
    await finishRun(db, runId, false, { stages }, 'No audit saved.')
    return { ok: false, errors: ['No audit saved for this lead. Save the audit first — the engine never invents audit findings.'], warnings, data: { stages, finalStatus: null }, runId: runId ?? undefined }
  }
  stages.push({ stage: 'Confirm audit', ok: true, detail: `Audit on file (overall ${detail.audit.overall_score ?? '—'}/100).` })

  // Stage 3 — pain points.
  const pains = await runPainPoints(session, leadId)
  stages.push({ stage: 'Generate pain points', ok: pains.ok, detail: pains.ok ? `${pains.data?.length ?? 0} pain points saved.` : (pains.errors?.join(' ') ?? 'Failed.') })
  if (!pains.ok) {
    await finishRun(db, runId, false, { stages }, pains.errors?.join(' '))
    return { ok: false, errors: pains.errors, warnings, data: { stages, finalStatus: null }, runId: runId ?? undefined }
  }

  // Stage 4 + 5 — qualification (includes the package recommendation).
  const qual = await runQualification(session, leadId)
  stages.push({ stage: 'Qualify lead', ok: qual.ok, detail: qual.ok ? `Fit ${qual.data?.fit_score}/100 → ${qual.data?.recommended_package}.` : (qual.errors?.join(' ') ?? 'Failed.') })
  if (!qual.ok) {
    await finishRun(db, runId, false, { stages }, qual.errors?.join(' '))
    return { ok: false, errors: qual.errors, warnings, data: { stages, finalStatus: null }, runId: runId ?? undefined }
  }
  if (qual.warnings) warnings.push(...qual.warnings)

  // Stage 6 — offer.
  const offer = await runOffer(session, leadId)
  stages.push({ stage: 'Build sales offer', ok: offer.ok, detail: offer.ok ? `Offer built on ${offer.data?.package_name}.` : (offer.errors?.join(' ') ?? 'Failed.') })
  if (!offer.ok) {
    await finishRun(db, runId, false, { stages }, offer.errors?.join(' '))
    return { ok: false, errors: offer.errors, warnings, data: { stages, finalStatus: null }, runId: runId ?? undefined }
  }

  // Stage 7 — outreach drafts.
  const outreach = await runOutreach(session, leadId)
  stages.push({ stage: 'Generate outreach drafts', ok: outreach.ok, detail: outreach.ok ? 'Cold email, follow-up, DM, WhatsApp, and call script drafted.' : (outreach.errors?.join(' ') ?? 'Failed.') })
  if (!outreach.ok) {
    await finishRun(db, runId, false, { stages }, outreach.errors?.join(' '))
    return { ok: false, errors: outreach.errors, warnings, data: { stages, finalStatus: null }, runId: runId ?? undefined }
  }

  // Stage 8 — move the lead forward (never backwards).
  const current = (await getAuthorizedLeadById(session, leadId))?.status ?? lead.status
  const finalStatus = advanceStatus(current, 'ready_for_outreach')
  const { error: stErr } = await db.from('atc_leads').update({ status: finalStatus }).eq('id', leadId)
  stages.push({ stage: 'Move to Ready for Outreach', ok: !stErr, detail: stErr ? 'Status update failed.' : `Status: ${finalStatus}.` })

  await finishRun(db, runId, true, { stages })
  return {
    ok: true,
    data: { stages, finalStatus },
    warnings: warnings.length ? warnings : undefined,
    runId: runId ?? undefined,
  }
}
