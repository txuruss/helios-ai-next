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

// ── Update client status (e.g. Mark paused, Reactivate) ────────────
export async function updateClientStatus(
  clientId: string,
  status:   ClientStatus,
): Promise<AdminClientActionResult> {
  await requireAdmin({ path: '/admin/clients' })

  const id = validId(clientId)
  if (!id) return { ok: false, error: 'Invalid client id.' }
  if (!CLIENT_STATUSES.includes(status)) return { ok: false, error: 'Invalid status.' }

  const guard = guardServiceRole()
  if (guard) return guard

  const db = createServiceRoleClient()
  const { error } = await db.from('admin_clients').update({ status }).eq('id', id)

  if (error) {
    if (isMissingTable(error)) return { ok: false, error: MIGRATION_HINT }
    console.error('[updateClientStatus]', error.message, '| code:', error.code)
    return { ok: false, error: 'Could not update client status. Try again.' }
  }

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

  const db = createServiceRoleClient()
  const { error } = await db
    .from('admin_clients')
    .update({
      payment_status:    input.payment_status,
      payment_method:    method,
      last_payment_date: lastPaid,
      next_payment_due:  nextDue,
      paypal_invoice_id: cleanText(input.paypal_invoice_id, 120),
      payment_notes:     cleanText(input.payment_notes, 2000),
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

  revalidate()
  return { ok: true }
}
