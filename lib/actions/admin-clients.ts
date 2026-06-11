'use server'

// ── Founder admin actions: client CRM (admin_clients) ──────────────
//
// Server actions behind the /admin/clients row actions. Every action
// re-derives founder identity via requireAdmin(), uses the service-role
// client, validates the id as a UUID, and revalidates affected routes.
//
// SAFETY
//   • No hard deletes. Archive sets status='archived' + archived_at.
//   • Missing pipeline table degrades to a clear, user-safe error.

import { requireAdmin } from '@/lib/auth/require-admin'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { feesForPlan, isAdminPlan, type AdminPlan } from '@/lib/admin/plan-pricing'
import { getClientDetail, getClientNotes, getClientPaymentEvents } from '@/lib/data/admin-clients'
import { getClientReadinessForStatusChange } from '@/lib/data/admin-client-readiness'

export interface AdminClientActionResult {
  ok:     boolean
  error?: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const CLIENT_STATUSES = ['active', 'onboarding', 'paused', 'churned'] as const
type ClientStatus = (typeof CLIENT_STATUSES)[number]

function validId(raw: unknown): string | null {
  return typeof raw === 'string' && UUID_RE.test(raw) ? raw : null
}

function isMissingTable(e: { code?: string; message?: string } | null): boolean {
  if (!e) return false
  if (e.code === '42P01') return true
  const m = (e.message ?? '').toLowerCase()
  return m.includes('relation') && m.includes('does not exist')
}

const MIGRATION_HINT =
  'Pipeline tables not found. Apply migration 20260528120000_create_admin_pipeline.sql in Supabase, then retry.'

function guardServiceRole(): AdminClientActionResult | null {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[admin-clients] SUPABASE_SERVICE_ROLE_KEY missing')
    return { ok: false, error: 'Server configuration error.' }
  }
  return null
}

function revalidate() {
  revalidatePath('/admin/clients')
  revalidatePath('/admin/delivery')
  revalidatePath('/admin/mission-control')
}

// ── Archive a client (soft) ────────────────────────────────────────
export async function archiveClient(clientId: string): Promise<AdminClientActionResult> {
  await requireAdmin({ path: '/admin/clients' })

  const id = validId(clientId)
  if (!id) return { ok: false, error: 'Invalid client id.' }

  const guard = guardServiceRole()
  if (guard) return guard

  const db = createServiceRoleClient()
  const { error } = await db
    .from('admin_clients')
    .update({ status: 'archived', archived_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    if (isMissingTable(error)) return { ok: false, error: MIGRATION_HINT }
    console.error('[archiveClient]', error.message, '| code:', error.code)
    return { ok: false, error: 'Could not archive client. Try again.' }
  }

  revalidate()
  return { ok: true }
}

// ── Update client status (manual lifecycle transitions) ────────────
// Supports the full lifecycle including 'archived'. Archiving stamps
// archived_at; moving away from archived clears it. No hard delete.
// A status-change note is recorded best-effort (never fails the update).
const LIFECYCLE_STATUSES = ['onboarding', 'active', 'paused', 'churned', 'archived'] as const
const STATUS_LABEL: Record<string, string> = {
  onboarding: 'Onboarding', active: 'Active', paused: 'Paused', churned: 'Churned', archived: 'Archived',
}

export async function updateClientStatus(
  clientId: string,
  status:   string,
): Promise<AdminClientActionResult> {
  await requireAdmin({ path: '/admin/clients' })

  const id = validId(clientId)
  if (!id) return { ok: false, error: 'Invalid client id.' }
  if (!LIFECYCLE_STATUSES.includes(status as (typeof LIFECYCLE_STATUSES)[number])) {
    return { ok: false, error: 'Invalid status.' }
  }

  const guard = guardServiceRole()
  if (guard) return guard

  const db = createServiceRoleClient()

  // Read current status for the no-op guard + the status-change note.
  const cur = await db.from('admin_clients').select('status').eq('id', id).maybeSingle()
  if (cur.error && isMissingTable(cur.error)) return { ok: false, error: MIGRATION_HINT }
  const fromStatus = cur.data && typeof cur.data.status === 'string' ? cur.data.status : null
  if (fromStatus === status) {
    return { ok: false, error: `Client is already marked as ${STATUS_LABEL[status] ?? status}.` }
  }

  const { error } = await db
    .from('admin_clients')
    .update({
      status,
      // Stamp on archive; clear when leaving archived. (archived_at exists
      // from the payment-tracking migration; harmless if it doesn't.)
      archived_at: status === 'archived' ? new Date().toISOString() : null,
    })
    .eq('id', id)

  if (error) {
    if (isMissingTable(error)) return { ok: false, error: MIGRATION_HINT }
    console.error('[updateClientStatus]', error.message, '| code:', error.code)
    return { ok: false, error: 'Could not update client status. Please try again.' }
  }

  // Best-effort status-change note (non-fatal; skipped if notes table absent).
  try {
    await db.from('admin_client_notes').insert({
      client_id: id,
      note: `Status changed from ${STATUS_LABEL[fromStatus ?? ''] ?? fromStatus ?? 'unknown'} to ${STATUS_LABEL[status] ?? status}.`,
      note_type: 'general',
    })
  } catch { /* non-fatal */ }

  revalidate()
  return { ok: true }
}

// ── Update client plan (re-defaults fees from the new plan) ────────
// Fees remain editable; this convenience action resets them to the
// plan's standard rate when the plan changes.
export async function updateClientPlan(
  clientId: string,
  plan:     AdminPlan,
): Promise<AdminClientActionResult> {
  await requireAdmin({ path: '/admin/clients' })

  const id = validId(clientId)
  if (!id) return { ok: false, error: 'Invalid client id.' }
  if (!isAdminPlan(plan)) return { ok: false, error: 'Invalid plan.' }

  const guard = guardServiceRole()
  if (guard) return guard

  const fees = feesForPlan(plan)
  const db = createServiceRoleClient()
  const { error } = await db
    .from('admin_clients')
    .update({ plan, setup_fee: fees.setup_fee, monthly_fee: fees.monthly_fee })
    .eq('id', id)

  if (error) {
    if (isMissingTable(error)) return { ok: false, error: MIGRATION_HINT }
    console.error('[updateClientPlan]', error.message, '| code:', error.code)
    return { ok: false, error: 'Could not update client plan. Try again.' }
  }

  revalidate()
  return { ok: true }
}

// ── Manual payment tracking ────────────────────────────────────────
// Records payment state by hand. This NEVER calls the PayPal API and
// never verifies a payment — it only stores what the founder enters.

const PAYMENT_STATUSES = ['unpaid', 'deposit_paid', 'paid', 'overdue', 'cancelled'] as const
const PAYMENT_METHODS  = ['paypal', 'bank_transfer', 'cash', 'other'] as const

export interface ClientPaymentInput {
  payment_status:    string
  payment_method?:   string | null
  last_payment_date?: string | null   // 'YYYY-MM-DD' or '' / null
  next_payment_due?:  string | null   // 'YYYY-MM-DD' or '' / null
  paypal_invoice_id?: string | null
  payment_notes?:     string | null
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// Normalize a date-ish input to 'YYYY-MM-DD' or null. Invalid → undefined
// (signals "reject"); empty → null (clear the field).
function parseDate(raw: string | null | undefined): string | null | undefined {
  if (raw === null || raw === undefined) return null
  const t = raw.trim()
  if (t === '') return null
  if (!DATE_RE.test(t) || Number.isNaN(Date.parse(t))) return undefined
  return t
}

function cleanText(raw: string | null | undefined, max: number): string | null {
  if (typeof raw !== 'string') return null
  const t = raw.trim()
  return t.length === 0 ? null : t.slice(0, max)
}

export async function updateClientPayment(
  clientId: string,
  input:    ClientPaymentInput,
): Promise<AdminClientActionResult> {
  await requireAdmin({ path: '/admin/clients' })

  const id = validId(clientId)
  if (!id) return { ok: false, error: 'Invalid client id.' }

  // Validate enums.
  if (!PAYMENT_STATUSES.includes(input.payment_status as (typeof PAYMENT_STATUSES)[number])) {
    return { ok: false, error: 'Invalid payment status.' }
  }
  const method =
    input.payment_method == null || input.payment_method === ''
      ? null
      : input.payment_method
  if (method !== null && !PAYMENT_METHODS.includes(method as (typeof PAYMENT_METHODS)[number])) {
    return { ok: false, error: 'Invalid payment method.' }
  }

  // Validate dates.
  const lastPaid = parseDate(input.last_payment_date)
  if (lastPaid === undefined) return { ok: false, error: 'Invalid last payment date.' }
  const nextDue = parseDate(input.next_payment_due)
  if (nextDue === undefined) return { ok: false, error: 'Invalid next payment due date.' }

  const guard = guardServiceRole()
  if (guard) return guard

  const invoice = cleanText(input.paypal_invoice_id, 120)
  const pnotes  = cleanText(input.payment_notes, 2000)

  const db = createServiceRoleClient()
  const { error } = await db
    .from('admin_clients')
    .update({
      payment_status:    input.payment_status,
      payment_method:    method,
      last_payment_date: lastPaid,
      next_payment_due:  nextDue,
      paypal_invoice_id: invoice,
      payment_notes:     pnotes,
    })
    .eq('id', id)

  if (error) {
    if (isMissingTable(error)) return { ok: false, error: MIGRATION_HINT }
    if (error.code === '42703') {
      return { ok: false, error: 'Payment fields not found. Apply migration 20260529120000_add_admin_clients_payment_tracking.sql in Supabase, then retry.' }
    }
    console.error('[updateClientPayment]', error.message, '| code:', error.code)
    return { ok: false, error: 'Could not update payment. Try again.' }
  }

  // Append a payment-history event (non-fatal). If the events table is
  // not yet created, this is silently skipped — the payment update above
  // already succeeded and must not be rolled back.
  try {
    const { error: evErr } = await db.from('admin_client_payment_events').insert({
      client_id:         id,
      payment_status:    input.payment_status,
      payment_method:    method,
      payment_date:      lastPaid,
      next_payment_due:  nextDue,
      paypal_invoice_id: invoice,
      notes:             pnotes,
    })
    if (evErr && evErr.code !== '42P01') {
      console.error('[updateClientPayment] event insert failed (non-fatal):', evErr.message)
    }
  } catch (evErr) {
    console.error('[updateClientPayment] event insert threw (non-fatal):', evErr instanceof Error ? evErr.message : evErr)
  }

  revalidate()
  return { ok: true }
}

// ── Detail-drawer read wrappers (callable from the client drawer) ──
// Thin 'use server' wrappers around the server-only data helpers so the
// client component can fetch detail/notes/events on demand.
export async function loadClientDetail(clientId: string) {
  const id = validId(clientId)
  if (!id) return null
  return getClientDetail(id)
}

// Handoff readiness for a status change (used by the Clients table flow).
export async function loadClientReadiness(clientId: string) {
  const id = validId(clientId)
  if (!id) return { readiness: null, error: 'Invalid client id.' }
  return getClientReadinessForStatusChange(id)
}

export async function loadClientNotes(clientId: string) {
  const id = validId(clientId)
  if (!id) return { rows: [], migrationNeeded: false, error: 'Invalid client id.' }
  return getClientNotes(id)
}

export async function loadClientPaymentEvents(clientId: string) {
  const id = validId(clientId)
  if (!id) return { rows: [], migrationNeeded: false, error: 'Invalid client id.' }
  return getClientPaymentEvents(id)
}

// ── Add a client note ──────────────────────────────────────────────
const NOTE_TYPES = ['general', 'payment', 'onboarding', 'support', 'retention'] as const

export async function addClientNote(
  clientId: string,
  note:     string,
  noteType: string = 'general',
): Promise<AdminClientActionResult> {
  await requireAdmin({ path: '/admin/clients' })

  const id = validId(clientId)
  if (!id) return { ok: false, error: 'Invalid client id.' }

  const text = typeof note === 'string' ? note.trim() : ''
  if (text.length === 0)     return { ok: false, error: 'Note cannot be empty.' }
  if (text.length > 4000)    return { ok: false, error: 'Note is too long (max 4000 characters).' }

  const type = NOTE_TYPES.includes(noteType as (typeof NOTE_TYPES)[number]) ? noteType : 'general'

  const guard = guardServiceRole()
  if (guard) return guard

  const db = createServiceRoleClient()
  const { error } = await db.from('admin_client_notes').insert({
    client_id: id,
    note:      text.slice(0, 4000),
    note_type: type,
  })

  if (error) {
    if (error.code === '42P01' || isMissingTable(error)) {
      return { ok: false, error: 'Apply the notes migration (20260530120000_add_client_crm_detail.sql) to enable client notes.' }
    }
    console.error('[addClientNote]', error.message, '| code:', error.code)
    return { ok: false, error: 'Could not save note. Try again.' }
  }

  revalidate()
  return { ok: true }
}

// ── Update onboarding stage ────────────────────────────────────────
const ONBOARDING_STAGES = [
  'not_started', 'intake_needed', 'setup_in_progress', 'testing', 'live', 'complete',
] as const

export async function updateClientOnboarding(
  clientId: string,
  stage:    string,
  notes?:   string | null,
): Promise<AdminClientActionResult> {
  await requireAdmin({ path: '/admin/clients' })

  const id = validId(clientId)
  if (!id) return { ok: false, error: 'Invalid client id.' }
  if (!ONBOARDING_STAGES.includes(stage as (typeof ONBOARDING_STAGES)[number])) {
    return { ok: false, error: 'Invalid onboarding stage.' }
  }

  const guard = guardServiceRole()
  if (guard) return guard

  const update: Record<string, unknown> = {
    onboarding_stage: stage,
    onboarding_notes: cleanText(notes, 2000),
  }
  // Stamp completion when reaching 'complete'; clear it otherwise.
  update.onboarding_completed_at = stage === 'complete' ? new Date().toISOString() : null

  const db = createServiceRoleClient()
  const { error } = await db.from('admin_clients').update(update).eq('id', id)

  if (error) {
    if (isMissingTable(error)) return { ok: false, error: MIGRATION_HINT }
    if (error.code === '42703') {
      return { ok: false, error: 'Onboarding fields not found. Apply migration 20260530120000_add_client_crm_detail.sql in Supabase, then retry.' }
    }
    console.error('[updateClientOnboarding]', error.message, '| code:', error.code)
    return { ok: false, error: 'Could not update onboarding. Try again.' }
  }

  revalidate()
  return { ok: true }
}

// ── Update retainer tracking (setup fee + monthly retainer model) ──
// Sets the retainer state, next monthly review date, and last report
// date on a client. Manual by design — the founder controls the cycle.
const RETAINER_STATUSES = ['active', 'paused', 'cancelled', 'needs_review'] as const
const ACTION_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// '' or null → clear (null); valid YYYY-MM-DD → kept; anything else → undefined (reject).
function parseActionDate(raw: unknown): string | null | undefined {
  if (raw === null || raw === undefined) return null
  if (typeof raw !== 'string') return undefined
  const t = raw.trim()
  if (t === '') return null
  if (!ACTION_DATE_RE.test(t) || Number.isNaN(Date.parse(t))) return undefined
  return t
}

export async function updateClientRetainer(
  clientId: string,
  input: { retainer_status?: string; next_review_date?: string | null; last_report_date?: string | null },
): Promise<AdminClientActionResult> {
  await requireAdmin({ path: '/admin/clients' })

  const id = validId(clientId)
  if (!id) return { ok: false, error: 'Invalid client id.' }

  const update: Record<string, unknown> = {}
  if (input.retainer_status !== undefined) {
    if (!RETAINER_STATUSES.includes(input.retainer_status as (typeof RETAINER_STATUSES)[number])) {
      return { ok: false, error: 'Invalid retainer status.' }
    }
    update.retainer_status = input.retainer_status
  }
  if (input.next_review_date !== undefined) {
    const d = parseActionDate(input.next_review_date)
    if (d === undefined) return { ok: false, error: 'Invalid next review date.' }
    update.next_review_date = d
  }
  if (input.last_report_date !== undefined) {
    const d = parseActionDate(input.last_report_date)
    if (d === undefined) return { ok: false, error: 'Invalid last report date.' }
    update.last_report_date = d
  }
  if (Object.keys(update).length === 0) return { ok: false, error: 'Nothing to update.' }

  const guard = guardServiceRole()
  if (guard) return guard

  const db = createServiceRoleClient()
  const { error } = await db.from('admin_clients').update(update).eq('id', id)

  if (error) {
    if (isMissingTable(error)) return { ok: false, error: MIGRATION_HINT }
    if (error.code === '42703') {
      return { ok: false, error: 'Retainer fields not found. Apply migration 20260611120000_add_retainer_tracking.sql in Supabase, then retry.' }
    }
    console.error('[updateClientRetainer]', error.message, '| code:', error.code)
    return { ok: false, error: 'Could not update retainer tracking. Try again.' }
  }

  revalidate()
  return { ok: true }
}
