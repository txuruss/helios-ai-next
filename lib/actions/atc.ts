'use server'

// ── Audit-to-Close server actions ──────────────────────────────────
//
// Every action re-derives identity via requireAdmin (or requireFounderAdmin
// for founder-only operations), enforces lead ownership SERVER-SIDE via the
// scoped layer (lib/data/atc-leads.ts), validates input, and revalidates
// the affected routes. AI generation is delegated to lib/atc/engine.ts.
//
// SAFETY
//   • Nothing here sends any message — outreach output is drafts only.
//   • No hard deletes of leads (archive = status + archived_at).
//   • Founder-only: assign, convert to client.
//   • Missing table degrades to a clear migration hint.

import { revalidatePath } from 'next/cache'
import { requireAdmin, requireFounderAdmin } from '@/lib/auth/require-admin'
import { createServiceRoleClient } from '@/lib/supabase/server'
import {
  getAuthorizedLeadById, isMissingTable, ATC_MIGRATION_HINT,
} from '@/lib/data/atc-leads'
import {
  runPainPoints, runQualification, runOffer, runOutreach, runOrchestrator,
} from '@/lib/atc/engine'
import {
  isAtcStatus, ATC_AUDIT_CATEGORIES, ATC_SCORE_COLUMN_MAP,
  type AtcActionResult, type AtcAuditJson, type AtcStatus,
} from '@/lib/atc/types'
import { PLAN_FEES, isAdminPlan } from '@/lib/admin/plan-pricing'

const ATC_PATH = '/admin/audit-to-close'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface AtcMutationResult { ok: boolean; error?: string; leadId?: string }

// ── local helpers (not exported — 'use server' exports must be async) ─
function cleanText(raw: unknown, max: number): string | null {
  if (typeof raw !== 'string') return null
  const t = raw.trim()
  return t.length === 0 ? null : t.slice(0, max)
}
function cleanNum(raw: unknown, lo: number, hi: number): number | null {
  const n = typeof raw === 'number' ? raw : raw === '' || raw == null ? NaN : Number(raw)
  if (!Number.isFinite(n)) return null
  return Math.max(lo, Math.min(hi, n))
}
function validId(raw: unknown): string | null {
  return typeof raw === 'string' && UUID_RE.test(raw) ? raw : null
}
function guardServiceRole(): AtcMutationResult | null {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[atc] SUPABASE_SERVICE_ROLE_KEY missing')
    return { ok: false, error: 'Server configuration error.' }
  }
  return null
}
function revalidate(leadId?: string) {
  revalidatePath(ATC_PATH)
  if (leadId) revalidatePath(`${ATC_PATH}/${leadId}`)
}
function dbError(e: { code?: string; message?: string }, fallback: string): string {
  return isMissingTable(e) ? ATC_MIGRATION_HINT : fallback
}

export interface AtcLeadInput {
  business_name?:   string
  industry?:        string | null
  location?:        string | null
  website_url?:     string | null
  google_maps_url?: string | null
  phone?:           string | null
  email?:           string | null
  instagram_url?:   string | null
  facebook_url?:    string | null
  whatsapp_number?: string | null
  opening_hours?:   string | null
  rating?:          number | string | null
  review_count?:    number | string | null
  services?:        string | null
  notes?:           string | null
  source?:          string | null
  status?:          string
}

function buildLeadPatch(input: AtcLeadInput, { requireCore }: { requireCore: boolean }):
  { patch: Record<string, unknown> } | { error: string } {
  const patch: Record<string, unknown> = {}

  if (requireCore || input.business_name !== undefined) {
    const name = cleanText(input.business_name, 200)
    if (!name) return { error: 'Business name is required.' }
    patch.business_name = name
  }
  if (input.industry        !== undefined) patch.industry        = cleanText(input.industry, 120)
  if (input.location        !== undefined) patch.location        = cleanText(input.location, 200)
  if (input.website_url     !== undefined) patch.website_url     = cleanText(input.website_url, 500)
  if (input.google_maps_url !== undefined) patch.google_maps_url = cleanText(input.google_maps_url, 500)
  if (input.phone           !== undefined) patch.phone           = cleanText(input.phone, 60)
  if (input.email           !== undefined) patch.email           = cleanText(input.email, 200)
  if (input.instagram_url   !== undefined) patch.instagram_url   = cleanText(input.instagram_url, 500)
  if (input.facebook_url    !== undefined) patch.facebook_url    = cleanText(input.facebook_url, 500)
  if (input.whatsapp_number !== undefined) patch.whatsapp_number = cleanText(input.whatsapp_number, 60)
  if (input.opening_hours   !== undefined) patch.opening_hours   = cleanText(input.opening_hours, 500)
  if (input.services        !== undefined) patch.services        = cleanText(input.services, 2000)
  if (input.notes           !== undefined) patch.notes           = cleanText(input.notes, 4000)
  if (input.source          !== undefined) patch.source          = cleanText(input.source, 60) ?? 'manual'
  if (input.rating          !== undefined) patch.rating          = cleanNum(input.rating, 0, 5)
  if (input.review_count    !== undefined) {
    const n = cleanNum(input.review_count, 0, 1_000_000)
    patch.review_count = n === null ? null : Math.round(n)
  }
  if (input.status !== undefined) {
    if (!isAtcStatus(input.status)) return { error: 'Invalid status.' }
    patch.status = input.status
  }
  return { patch }
}

// ── Create / update / status / archive ─────────────────────────────

export async function createAtcLead(input: AtcLeadInput): Promise<AtcMutationResult> {
  const session = await requireAdmin({ path: ATC_PATH })
  const guard = guardServiceRole(); if (guard) return guard

  const built = buildLeadPatch(input, { requireCore: true })
  if ('error' in built) return { ok: false, error: built.error }

  // The session is the authoritative "created by" — never trust the client.
  built.patch.created_by_team_member_id =
    session.teamMemberId && UUID_RE.test(session.teamMemberId) ? session.teamMemberId : null
  built.patch.created_by_name  = session.fullName ?? null
  built.patch.created_by_email = session.email ?? null

  const db = createServiceRoleClient()
  const { data, error } = await db.from('atc_leads').insert(built.patch).select('id').single()
  if (error) {
    console.error('[createAtcLead]', error.message, '| code:', error.code)
    return { ok: false, error: dbError(error, 'Could not create lead. Try again.') }
  }
  revalidate()
  return { ok: true, leadId: String((data as { id: unknown }).id) }
}

export async function updateAtcLead(leadId: string, input: AtcLeadInput): Promise<AtcMutationResult> {
  const session = await requireAdmin({ path: ATC_PATH })
  const id = validId(leadId); if (!id) return { ok: false, error: 'Invalid lead id.' }
  const guard = guardServiceRole(); if (guard) return guard

  // Scoped read acts as the authorization check (agents: created/assigned only).
  const lead = await getAuthorizedLeadById(session, id)
  if (!lead) return { ok: false, error: 'Lead not found.' }

  const built = buildLeadPatch(input, { requireCore: false })
  if ('error' in built) return { ok: false, error: built.error }
  if (Object.keys(built.patch).length === 0) return { ok: false, error: 'Nothing to update.' }

  const db = createServiceRoleClient()
  const { error } = await db.from('atc_leads').update(built.patch).eq('id', id)
  if (error) {
    console.error('[updateAtcLead]', error.message)
    return { ok: false, error: dbError(error, 'Could not update lead. Try again.') }
  }
  revalidate(id)
  return { ok: true, leadId: id }
}

export async function setAtcLeadStatus(leadId: string, status: string): Promise<AtcMutationResult> {
  const session = await requireAdmin({ path: ATC_PATH })
  const id = validId(leadId); if (!id) return { ok: false, error: 'Invalid lead id.' }
  if (!isAtcStatus(status)) return { ok: false, error: 'Invalid status.' }
  if (status === 'archived') return archiveAtcLead(id) // route through soft-archive
  const guard = guardServiceRole(); if (guard) return guard

  const lead = await getAuthorizedLeadById(session, id)
  if (!lead) return { ok: false, error: 'Lead not found.' }

  const db = createServiceRoleClient()
  const { error } = await db.from('atc_leads').update({ status: status as AtcStatus }).eq('id', id)
  if (error) return { ok: false, error: dbError(error, 'Could not update status. Try again.') }
  revalidate(id)
  return { ok: true, leadId: id }
}

export async function archiveAtcLead(leadId: string): Promise<AtcMutationResult> {
  const session = await requireAdmin({ path: ATC_PATH })
  const id = validId(leadId); if (!id) return { ok: false, error: 'Invalid lead id.' }
  const guard = guardServiceRole(); if (guard) return guard

  const lead = await getAuthorizedLeadById(session, id)
  if (!lead) return { ok: false, error: 'Lead not found.' }

  const db = createServiceRoleClient()
  const { error } = await db.from('atc_leads')
    .update({ status: 'archived', archived_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { ok: false, error: dbError(error, 'Could not archive lead. Try again.') }
  revalidate(id)
  return { ok: true, leadId: id }
}

// ── Founder-only: assignment + conversion ──────────────────────────

export async function assignAtcLead(leadId: string, teamMemberId: string | null): Promise<AtcMutationResult> {
  await requireFounderAdmin({ path: ATC_PATH })
  const id = validId(leadId); if (!id) return { ok: false, error: 'Invalid lead id.' }
  const guard = guardServiceRole(); if (guard) return guard

  const db = createServiceRoleClient()
  let patch: Record<string, unknown> = { assigned_to_team_member_id: null, assigned_to_name: null }
  if (teamMemberId !== null) {
    const memberId = validId(teamMemberId); if (!memberId) return { ok: false, error: 'Invalid team member id.' }
    const { data: member, error: mErr } = await db.from('team_members')
      .select('id, full_name, email, status').eq('id', memberId).maybeSingle()
    if (mErr || !member) return { ok: false, error: 'Team member not found.' }
    const m = member as Record<string, unknown>
    if (m.status !== 'active') return { ok: false, error: 'That team member is not active.' }
    patch = {
      assigned_to_team_member_id: memberId,
      assigned_to_name: (m.full_name as string | null) ?? (m.email as string | null) ?? null,
    }
  }

  const { error } = await db.from('atc_leads').update(patch).eq('id', id)
  if (error) return { ok: false, error: dbError(error, 'Could not assign lead. Try again.') }
  revalidate(id)
  return { ok: true, leadId: id }
}

// Convert into the existing agency pipeline (admin_leads, stage=qualified).
// The tested Leads → Clients flow then handles the actual client creation —
// no new client/payment logic here.
export async function convertAtcLeadToClient(leadId: string): Promise<AtcMutationResult> {
  const session = await requireFounderAdmin({ path: ATC_PATH })
  const id = validId(leadId); if (!id) return { ok: false, error: 'Invalid lead id.' }
  const guard = guardServiceRole(); if (guard) return guard

  const lead = await getAuthorizedLeadById(session, id)
  if (!lead) return { ok: false, error: 'Lead not found.' }

  const plan = lead.recommended_package && isAdminPlan(lead.recommended_package)
    ? lead.recommended_package : null

  const db = createServiceRoleClient()
  const { error: insErr } = await db.from('admin_leads').insert({
    business_name:   lead.business_name,
    industry:        lead.industry,
    location:        lead.location,
    website:         lead.website_url,
    phone:           lead.phone,
    email:           lead.email,
    target_plan:     plan,
    stage:           'qualified',
    estimated_value: plan ? PLAN_FEES[plan].est_value : 0,
    next_action:     'Review Audit-to-Close offer and send proposal',
    notes:           `Converted from Audit-to-Close lead ${lead.id} (fit ${lead.fit_score ?? '—'}/100).`,
  })
  if (insErr) {
    console.error('[convertAtcLeadToClient]', insErr.message)
    return { ok: false, error: isMissingTable(insErr) ? 'Agency pipeline tables not found (admin_leads).' : 'Could not convert lead. Try again.' }
  }

  const { error: stErr } = await db.from('atc_leads').update({ status: 'closed' }).eq('id', id)
  if (stErr) console.warn('[convertAtcLeadToClient] status update failed:', stErr.message)

  revalidate(id)
  revalidatePath('/admin/leads')
  return { ok: true, leadId: id }
}

// ── Audit save (manual human judgment — upserted, one per lead) ─────

export interface AtcAuditInput {
  audit_summary?: string | null
  categories?: Record<string, {
    score?:              number | string | null
    issue?:              string | null
    why_it_matters?:     string | null
    suggested_fix?:      string | null
    helios_opportunity?: string | null
  }>
}

export async function saveAtcAudit(leadId: string, input: AtcAuditInput): Promise<AtcMutationResult> {
  const session = await requireAdmin({ path: ATC_PATH })
  const id = validId(leadId); if (!id) return { ok: false, error: 'Invalid lead id.' }
  const guard = guardServiceRole(); if (guard) return guard

  const lead = await getAuthorizedLeadById(session, id)
  if (!lead) return { ok: false, error: 'Lead not found.' }

  // Validate + clamp the 10 categories; unknown keys are dropped.
  const auditJson: AtcAuditJson = {}
  const scores: number[] = []
  for (const cat of ATC_AUDIT_CATEGORIES) {
    const raw = input.categories?.[cat.key]
    if (!raw) continue
    const score = cleanNum(raw.score, 0, 10)
    const entry = {
      score:              score === null ? null : Math.round(score),
      issue:              cleanText(raw.issue, 1000) ?? '',
      why_it_matters:     cleanText(raw.why_it_matters, 1000) ?? '',
      suggested_fix:      cleanText(raw.suggested_fix, 1000) ?? '',
      helios_opportunity: cleanText(raw.helios_opportunity, 1000) ?? '',
    }
    // Skip fully-empty categories so audit_json only holds real input.
    if (entry.score === null && !entry.issue && !entry.why_it_matters && !entry.suggested_fix && !entry.helios_opportunity) continue
    auditJson[cat.key] = entry
    if (entry.score !== null) scores.push(entry.score)
  }
  if (Object.keys(auditJson).length === 0) return { ok: false, error: 'Fill in at least one audit category.' }

  // Named score columns from their mapped categories; overall = mean × 10.
  const row: Record<string, unknown> = {
    lead_id:       id,
    audit_summary: cleanText(input.audit_summary, 4000),
    audit_json:    auditJson,
    overall_score: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) : null,
    created_by_team_member_id:
      session.teamMemberId && UUID_RE.test(session.teamMemberId) ? session.teamMemberId : null,
    created_by_name: session.fullName ?? session.email ?? null,
  }
  for (const [col, key] of Object.entries(ATC_SCORE_COLUMN_MAP)) {
    row[col] = auditJson[key]?.score ?? null
  }

  const db = createServiceRoleClient()
  const { error } = await db.from('atc_audits').upsert(row, { onConflict: 'lead_id' })
  if (error) {
    console.error('[saveAtcAudit]', error.message)
    return { ok: false, error: dbError(error, 'Could not save audit. Try again.') }
  }

  // Audit on file advances a fresh lead to 'audited' (never moves it back).
  if (lead.status === 'new' || lead.status === 'researching') {
    await db.from('atc_leads').update({ status: 'audited' }).eq('id', id)
  }

  revalidate(id)
  return { ok: true, leadId: id }
}

// ── Generation actions (thin wrappers over the engine) ─────────────
// All return the stable { ok, data?, warnings?, errors?, runId? } envelope.

export async function generatePainPoints(leadId: string): Promise<AtcActionResult> {
  const session = await requireAdmin({ path: ATC_PATH })
  const id = validId(leadId); if (!id) return { ok: false, errors: ['Invalid lead id.'] }
  const res = await runPainPoints(session, id)
  if (res.ok) revalidate(id)
  return res
}

export async function qualifyLead(leadId: string): Promise<AtcActionResult> {
  const session = await requireAdmin({ path: ATC_PATH })
  const id = validId(leadId); if (!id) return { ok: false, errors: ['Invalid lead id.'] }
  const res = await runQualification(session, id)
  if (res.ok) revalidate(id)
  return res
}

export async function buildSalesOffer(leadId: string): Promise<AtcActionResult> {
  const session = await requireAdmin({ path: ATC_PATH })
  const id = validId(leadId); if (!id) return { ok: false, errors: ['Invalid lead id.'] }
  const res = await runOffer(session, id)
  if (res.ok) revalidate(id)
  return res
}

export async function generateOutreachMessages(leadId: string): Promise<AtcActionResult> {
  const session = await requireAdmin({ path: ATC_PATH })
  const id = validId(leadId); if (!id) return { ok: false, errors: ['Invalid lead id.'] }
  const res = await runOutreach(session, id)
  if (res.ok) revalidate(id)
  return res
}

export async function runAuditToClose(leadId: string): Promise<AtcActionResult> {
  const session = await requireAdmin({ path: ATC_PATH })
  const id = validId(leadId); if (!id) return { ok: false, errors: ['Invalid lead id.'] }
  const res = await runOrchestrator(session, id)
  revalidate(id) // partial progress saves even on failure
  return res
}
