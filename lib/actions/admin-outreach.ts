'use server'

// ── Founder admin actions: outreach CRM (admin_outreach_leads) ─────
//
// Every action re-derives founder identity via requireAdmin(), uses the
// service-role client, validates input, and revalidates affected routes.
//
// SAFETY
//   • 100% manual. Nothing here sends a DM/email, scrapes, or contacts
//     anyone — it only records what the founder enters. All status
//     changes are explicit.
//   • No hard deletes. Archive sets archived_at + reply_status='archived'.
//   • Missing table degrades to a clear, user-safe error.
//   • "Create audit from lead" inserts ONE audit_submissions row only.
//     It never creates clients, leads, or contacts anyone.

import { requireAdmin } from '@/lib/auth/require-admin'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import {
  isReplyStatus, isContactMethod, type OutreachReplyStatus, type OutreachContactMethod,
} from '@/lib/admin/outreach'

export interface OutreachActionResult { ok: boolean; error?: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const MIGRATION_HINT =
  'Outreach table not found. Apply migration 20260605120000_create_admin_outreach.sql in Supabase, then retry.'

function validId(raw: unknown): string | null {
  return typeof raw === 'string' && UUID_RE.test(raw) ? raw : null
}
function isMissingTable(e: { code?: string; message?: string } | null): boolean {
  if (!e) return false
  if (e.code === '42P01') return true
  const m = (e.message ?? '').toLowerCase()
  return m.includes('relation') && m.includes('does not exist')
}
function guardServiceRole(): OutreachActionResult | null {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[admin-outreach] SUPABASE_SERVICE_ROLE_KEY missing')
    return { ok: false, error: 'Server configuration error.' }
  }
  return null
}
function revalidate() {
  revalidatePath('/admin/outreach')
  revalidatePath('/admin/mission-control')
}

function cleanText(raw: unknown, max: number): string | null {
  if (typeof raw !== 'string') return null
  const t = raw.trim()
  return t.length === 0 ? null : t.slice(0, max)
}
// '' → null (clear); valid date → kept; invalid → undefined (reject).
function parseDate(raw: unknown): string | null | undefined {
  if (raw === null || raw === undefined) return null
  if (typeof raw !== 'string') return undefined
  const t = raw.trim()
  if (t === '') return null
  if (!DATE_RE.test(t) || Number.isNaN(Date.parse(t))) return undefined
  return t
}
function clampScore(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(10, Math.round(n)))
}

export interface OutreachLeadInput {
  business_name?:  string
  niche?:          string
  location?:       string | null
  instagram_url?:  string | null
  website_url?:    string | null
  phone?:          string | null
  email?:          string | null
  contact_method?: string
  score?:          number
  pain_found?:     string | null
  outreach_angle?: string | null
  reply_status?:   string
  next_action?:    string | null
  follow_up_date?: string | null
  notes?:          string | null
}

// Build a validated column patch from input. Returns { patch } or { error }.
function buildPatch(
  input: OutreachLeadInput,
  { requireCore }: { requireCore: boolean },
): { patch: Record<string, unknown> } | { error: string } {
  const patch: Record<string, unknown> = {}

  if (requireCore || input.business_name !== undefined) {
    const name = cleanText(input.business_name, 200)
    if (!name) return { error: 'Business name is required.' }
    patch.business_name = name
  }
  if (requireCore || input.niche !== undefined) {
    const niche = cleanText(input.niche, 120)
    if (!niche) return { error: 'Niche is required.' }
    patch.niche = niche
  }

  if (input.location       !== undefined) patch.location       = cleanText(input.location, 200)
  if (input.instagram_url  !== undefined) patch.instagram_url  = cleanText(input.instagram_url, 500)
  if (input.website_url    !== undefined) patch.website_url    = cleanText(input.website_url, 500)
  if (input.phone          !== undefined) patch.phone          = cleanText(input.phone, 60)
  if (input.email          !== undefined) patch.email          = cleanText(input.email, 200)
  if (input.pain_found     !== undefined) patch.pain_found     = cleanText(input.pain_found, 2000)
  if (input.outreach_angle !== undefined) patch.outreach_angle = cleanText(input.outreach_angle, 2000)
  if (input.next_action    !== undefined) patch.next_action    = cleanText(input.next_action, 500)
  if (input.notes          !== undefined) patch.notes          = cleanText(input.notes, 4000)

  if (input.score !== undefined) patch.score = clampScore(input.score)

  if (input.contact_method !== undefined) {
    if (!isContactMethod(input.contact_method)) return { error: 'Invalid contact method.' }
    patch.contact_method = input.contact_method
  }
  if (input.reply_status !== undefined) {
    if (!isReplyStatus(input.reply_status)) return { error: 'Invalid status.' }
    patch.reply_status = input.reply_status
  }
  if (input.follow_up_date !== undefined) {
    const fu = parseDate(input.follow_up_date)
    if (fu === undefined) return { error: 'Invalid follow-up date.' }
    patch.follow_up_date = fu
  }

  return { patch }
}

// ── Create lead ────────────────────────────────────────────────────
const CREATED_BY_KEYS = ['created_by_team_member_id', 'created_by_name', 'created_by_email']

export async function createOutreachLead(input: OutreachLeadInput): Promise<OutreachActionResult> {
  // The session is the authoritative "added by" — never trust the client.
  const session = await requireAdmin({ path: '/admin/outreach' })
  const guard = guardServiceRole(); if (guard) return guard

  const built = buildPatch(input, { requireCore: true })
  if ('error' in built) return { ok: false, error: built.error }

  // Record who added the lead: relational link (NULL if not a real UUID, e.g.
  // dev mock) plus a stable name/email snapshot. Only set on create.
  built.patch.created_by_team_member_id =
    session.teamMemberId && UUID_RE.test(session.teamMemberId) ? session.teamMemberId : null
  built.patch.created_by_name  = session.fullName ?? null
  built.patch.created_by_email = session.email ?? null

  const db = createServiceRoleClient()
  let result = await db.from('admin_outreach_leads').insert(built.patch)
  // created_by_* not migrated yet (20260608120000) → retry without them so
  // adding a lead still works (just without attribution).
  if (result.error && result.error.code === '42703') {
    console.warn('[createOutreachLead] created_by_* columns missing — apply 20260608120000. Saving without attribution.')
    for (const k of CREATED_BY_KEYS) delete built.patch[k]
    result = await db.from('admin_outreach_leads').insert(built.patch)
  }
  const { error } = result
  if (error) {
    if (isMissingTable(error)) return { ok: false, error: MIGRATION_HINT }
    console.error('[createOutreachLead]', error.message, '| code:', error.code)
    return { ok: false, error: 'Could not add lead. Try again.' }
  }
  revalidate()
  return { ok: true }
}

// ── Edit lead ──────────────────────────────────────────────────────
export async function updateOutreachLead(leadId: string, input: OutreachLeadInput): Promise<OutreachActionResult> {
  await requireAdmin({ path: '/admin/outreach' })
  const id = validId(leadId); if (!id) return { ok: false, error: 'Invalid lead id.' }
  const guard = guardServiceRole(); if (guard) return guard

  const built = buildPatch(input, { requireCore: false })
  if ('error' in built) return { ok: false, error: built.error }
  if (Object.keys(built.patch).length === 0) return { ok: false, error: 'Nothing to update.' }

  const db = createServiceRoleClient()
  const { error } = await db.from('admin_outreach_leads').update(built.patch).eq('id', id)
  if (error) {
    if (isMissingTable(error)) return { ok: false, error: MIGRATION_HINT }
    console.error('[updateOutreachLead]', error.message, '| code:', error.code)
    return { ok: false, error: 'Could not update lead. Try again.' }
  }
  revalidate()
  return { ok: true }
}

// ── Manual status change (quick marks) ─────────────────────────────
export async function setOutreachStatus(leadId: string, status: string): Promise<OutreachActionResult> {
  await requireAdmin({ path: '/admin/outreach' })
  const id = validId(leadId); if (!id) return { ok: false, error: 'Invalid lead id.' }
  if (!isReplyStatus(status)) return { ok: false, error: 'Invalid status.' }
  if (status === 'archived') return archiveOutreachLead(id) // route through soft-archive
  const guard = guardServiceRole(); if (guard) return guard

  const update: Record<string, unknown> = { reply_status: status as OutreachReplyStatus }
  // Marking contacted records the touch (manual — the founder sent it).
  if (status === 'contacted') {
    update.first_message_sent = true
    update.last_contacted_at  = new Date().toISOString()
  }

  const db = createServiceRoleClient()
  const { error } = await db.from('admin_outreach_leads').update(update).eq('id', id)
  if (error) {
    if (isMissingTable(error)) return { ok: false, error: MIGRATION_HINT }
    console.error('[setOutreachStatus]', error.message, '| code:', error.code)
    return { ok: false, error: 'Could not update status. Try again.' }
  }
  revalidate()
  return { ok: true }
}

// ── Soft archive ───────────────────────────────────────────────────
export async function archiveOutreachLead(leadId: string): Promise<OutreachActionResult> {
  await requireAdmin({ path: '/admin/outreach' })
  const id = validId(leadId); if (!id) return { ok: false, error: 'Invalid lead id.' }
  const guard = guardServiceRole(); if (guard) return guard

  const db = createServiceRoleClient()
  const { error } = await db
    .from('admin_outreach_leads')
    .update({ reply_status: 'archived', archived_at: new Date().toISOString() })
    .eq('id', id)
  if (error) {
    if (isMissingTable(error)) return { ok: false, error: MIGRATION_HINT }
    console.error('[archiveOutreachLead]', error.message, '| code:', error.code)
    return { ok: false, error: 'Could not archive lead. Try again.' }
  }
  revalidate()
  return { ok: true }
}

// ── End-of-day review (upsert by date) ─────────────────────────────
export interface DailyReviewInput {
  businesses_contacted?: string | null
  replies?:              string | null
  best_niche?:           string | null
  best_outreach_angle?:  string | null
  hottest_lead?:         string | null
  follow_ups_due?:       string | null
  improve_tomorrow?:     string | null
  checklist?:            Record<string, boolean>
}

export async function saveOutreachDailyReview(date: string, input: DailyReviewInput): Promise<OutreachActionResult> {
  await requireAdmin({ path: '/admin/outreach' })
  const guard = guardServiceRole(); if (guard) return guard

  const day = typeof date === 'string' && DATE_RE.test(date) ? date : new Date().toISOString().slice(0, 10)
  const checklist: Record<string, boolean> = {}
  if (input.checklist && typeof input.checklist === 'object') {
    for (const [k, v] of Object.entries(input.checklist)) checklist[String(k).slice(0, 200)] = v === true
  }

  const row = {
    review_date:          day,
    businesses_contacted: cleanText(input.businesses_contacted, 2000),
    replies:              cleanText(input.replies, 2000),
    best_niche:           cleanText(input.best_niche, 200),
    best_outreach_angle:  cleanText(input.best_outreach_angle, 2000),
    hottest_lead:         cleanText(input.hottest_lead, 300),
    follow_ups_due:       cleanText(input.follow_ups_due, 2000),
    improve_tomorrow:     cleanText(input.improve_tomorrow, 2000),
    checklist,
  }

  const db = createServiceRoleClient()
  const { error } = await db.from('admin_outreach_daily_reviews').upsert(row, { onConflict: 'review_date' })
  if (error) {
    if (isMissingTable(error)) return { ok: false, error: MIGRATION_HINT }
    console.error('[saveOutreachDailyReview]', error.message, '| code:', error.code)
    return { ok: false, error: 'Could not save review. Try again.' }
  }
  revalidatePath('/admin/outreach')
  return { ok: true }
}

// ── Conversion path: create ONE audit submission from a lead ───────
// Manual, founder-triggered. Inserts a single audit_submissions row
// (source='manual') so the lead can flow through the normal audit queue.
// It does NOT create clients/leads, run the AI, or contact anyone.
export async function createAuditFromOutreachLead(leadId: string): Promise<OutreachActionResult> {
  await requireAdmin({ path: '/admin/outreach' })
  const id = validId(leadId); if (!id) return { ok: false, error: 'Invalid lead id.' }
  const guard = guardServiceRole(); if (guard) return guard

  const db = createServiceRoleClient()

  const { data: lead, error: readErr } = await db
    .from('admin_outreach_leads')
    .select('business_name, niche, location, website_url, instagram_url, phone, email, pain_found')
    .eq('id', id)
    .maybeSingle()
  if (readErr) {
    if (isMissingTable(readErr)) return { ok: false, error: MIGRATION_HINT }
    console.error('[createAuditFromOutreachLead] read', readErr.message)
    return { ok: false, error: 'Could not read lead. Try again.' }
  }
  if (!lead) return { ok: false, error: 'Lead not found.' }

  const l = lead as Record<string, unknown>
  const name = typeof l.business_name === 'string' ? l.business_name : null
  if (!name) return { ok: false, error: 'Lead has no business name.' }

  const insert: Record<string, unknown> = {
    business_name: name,
    industry:      typeof l.niche === 'string' ? l.niche : null,
    location:      typeof l.location === 'string' ? l.location : null,
    website:       typeof l.website_url === 'string' ? l.website_url : null,
    instagram:     typeof l.instagram_url === 'string' ? l.instagram_url : null,
    phone:         typeof l.phone === 'string' ? l.phone : null,
    email:         typeof l.email === 'string' ? l.email : null,
    biggest_problem: typeof l.pain_found === 'string' ? l.pain_found : null,
    source:        'manual',
    notes:         `Created from outreach lead: ${name}.`,
  }

  const { error: insErr } = await db.from('audit_submissions').insert(insert)
  if (insErr) {
    if (isMissingTable(insErr)) return { ok: false, error: 'Audit submissions table not found.' }
    console.error('[createAuditFromOutreachLead] insert', insErr.message, '| code:', insErr.code)
    return { ok: false, error: 'Could not create audit. Try again.' }
  }

  // Best-effort: note the conversion on the lead (non-fatal).
  try {
    await db.from('admin_outreach_leads')
      .update({ next_action: 'Audit created — review in Audits' })
      .eq('id', id)
  } catch { /* non-fatal */ }

  revalidatePath('/admin/outreach')
  revalidatePath('/admin/audits')
  revalidatePath('/admin/mission-control')
  return { ok: true }
}
