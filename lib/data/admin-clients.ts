// ── Founder-only admin client-CRM reads (admin_clients) ───────────
//
// Reads the Helios agency client CRM from public.admin_clients.
// Distinct from public.businesses (client product accounts).
//
// SECURITY
//   • requireAdmin() gates every call (founder_admin only).
//   • Queries run through the service-role client; the key stays server-side.
//
// RESILIENCE
//   • If admin_clients does not exist yet (migration not applied) or a
//     query fails, helpers resolve to EMPTY/zeroed data so pages render
//     clean empty states instead of crashing. Missing table = "no clients
//     yet" (error: null), not an error banner.
//
// REVENUE
//   • MRR/ARR/setup are computed from REAL stored fees on admin_clients,
//     never from a hardcoded plan map. No verified PayPal payments =
//     figures are Estimated.

import 'server-only'

import { requireAdmin } from '@/lib/auth/require-admin'
import { createServiceRoleClient } from '@/lib/supabase/server'

export type AdminClientStatus = 'active' | 'onboarding' | 'paused' | 'churned'

export type PaymentStatus = 'unpaid' | 'deposit_paid' | 'paid' | 'overdue' | 'cancelled'
export type PaymentMethod = 'paypal' | 'bank_transfer' | 'cash' | 'other'

export type OnboardingStage =
  | 'not_started' | 'intake_needed' | 'setup_in_progress' | 'testing' | 'live' | 'complete'

export type NoteType = 'general' | 'payment' | 'onboarding' | 'support' | 'retention'

// Full client record for the detail drawer (superset of AdminClientRow).
export interface AdminClientDetail {
  id:               string
  business_name:    string
  contact_name:     string | null
  email:            string | null
  phone:            string | null
  website:          string | null
  industry:         string | null
  city:             string | null
  plan:             string
  setup_fee:        number
  monthly_fee:      number
  status:           AdminClientStatus
  monthly_leads:    number
  monthly_bookings: number
  client_since:     string | null
  created_at:       string
  source_audit_id:  string | null
  source_lead_id:   string | null
  payment_status:   PaymentStatus
  payment_method:   PaymentMethod | null
  last_payment_date: string | null
  next_payment_due:  string | null
  paypal_invoice_id: string | null
  payment_notes:     string | null
  onboarding_stage:  OnboardingStage
  onboarding_notes:  string | null
  onboarding_completed_at: string | null
  legacy_notes:      string | null   // admin_clients.notes free-text field
}

export interface ClientNote {
  id:         string
  note:       string
  note_type:  NoteType
  created_at: string
}

export interface ClientPaymentEvent {
  id:                string
  payment_status:    PaymentStatus
  payment_method:    PaymentMethod | null
  amount:            number | null
  payment_date:      string | null
  next_payment_due:  string | null
  paypal_invoice_id: string | null
  notes:             string | null
  created_at:        string
}

export interface ClientNotesResult         { rows: ClientNote[];         migrationNeeded: boolean; error: string | null }
export interface ClientPaymentEventsResult  { rows: ClientPaymentEvent[]; migrationNeeded: boolean; error: string | null }

// UI-facing row. Field names match what ClientsPageClient consumes
// (name / industry / city / plan / monthly_leads / monthly_bookings /
// created_at) plus the stored commercial fields.
export interface AdminClientRow {
  id:               string
  name:             string
  industry:         string
  city:             string
  plan:             string             // 'starter' | 'pro' | 'scale' | ''
  setup_fee:        number
  monthly_fee:      number
  status:           AdminClientStatus
  monthly_leads:    number
  monthly_bookings: number
  created_at:       string             // client_since || created_at (display only)
  // Manual payment tracking (null when the payment migration is not yet
  // applied — all reads are resilient to the missing columns).
  payment_status:   PaymentStatus
  payment_method:   PaymentMethod | null
  last_payment_date: string | null     // YYYY-MM-DD
  next_payment_due:  string | null     // YYYY-MM-DD
  paypal_invoice_id: string | null
  payment_notes:     string | null
}

export interface AdminClientsResult {
  rows:  AdminClientRow[]
  error: string | null
}

export interface AdminClientRevenue {
  activeClients: number   // status = 'active'
  totalClients:  number   // all non-archived
  mrr:           number   // Σ monthly_fee where status = 'active'
  arr:           number   // mrr × 12
  setupRevenue:  number   // Σ setup_fee for current clients (active/onboarding/paused)
  avgMonthly:    number   // mrr ÷ activeClients
  projected12mo: number   // arr + setupRevenue
  error:         string | null
}

function normalizeStatus(raw: unknown): AdminClientStatus {
  if (raw === 'active' || raw === 'onboarding' || raw === 'paused' || raw === 'churned') return raw
  return 'onboarding'
}

function normalizePaymentStatus(raw: unknown): PaymentStatus {
  if (
    raw === 'unpaid' || raw === 'deposit_paid' || raw === 'paid' ||
    raw === 'overdue' || raw === 'cancelled'
  ) return raw
  return 'unpaid'
}

function normalizePaymentMethod(raw: unknown): PaymentMethod | null {
  if (raw === 'paypal' || raw === 'bank_transfer' || raw === 'cash' || raw === 'other') return raw
  return null
}

function dateStr(raw: unknown): string | null {
  return typeof raw === 'string' && raw.length > 0 ? raw.slice(0, 10) : null
}

function toRow(raw: Record<string, unknown>): AdminClientRow {
  return {
    id:               String(raw.id ?? ''),
    name:             typeof raw.business_name === 'string' ? raw.business_name : '(unknown)',
    industry:         typeof raw.industry === 'string' && raw.industry ? raw.industry : '—',
    city:             typeof raw.city === 'string' && raw.city ? raw.city : '—',
    plan:             typeof raw.plan === 'string' ? raw.plan : '',
    setup_fee:        typeof raw.setup_fee === 'number' ? raw.setup_fee : 0,
    monthly_fee:      typeof raw.monthly_fee === 'number' ? raw.monthly_fee : 0,
    status:           normalizeStatus(raw.status),
    monthly_leads:    typeof raw.leads_this_month === 'number' ? raw.leads_this_month : 0,
    monthly_bookings: typeof raw.bookings_this_month === 'number' ? raw.bookings_this_month : 0,
    created_at:
      (typeof raw.client_since === 'string' && raw.client_since) ||
      (typeof raw.created_at === 'string' && raw.created_at) ||
      new Date(0).toISOString(),
    payment_status:    normalizePaymentStatus(raw.payment_status),
    payment_method:    normalizePaymentMethod(raw.payment_method),
    last_payment_date: dateStr(raw.last_payment_date),
    next_payment_due:  dateStr(raw.next_payment_due),
    paypal_invoice_id: typeof raw.paypal_invoice_id === 'string' && raw.paypal_invoice_id ? raw.paypal_invoice_id : null,
    payment_notes:     typeof raw.payment_notes === 'string' && raw.payment_notes ? raw.payment_notes : null,
  }
}

// "column does not exist" → the payment migration is not applied yet.
function isMissingColumn(e: { code?: string; message?: string } | null): boolean {
  if (!e) return false
  if (e.code === '42703') return true
  const m = (e.message ?? '').toLowerCase()
  return m.includes('column') && m.includes('does not exist')
}

function isMissingTable(e: { code?: string; message?: string } | null): boolean {
  if (!e) return false
  if (e.code === '42P01') return true
  const m = (e.message ?? '').toLowerCase()
  return m.includes('relation') && m.includes('does not exist')
}

const BASE_COLS =
  'id, business_name, industry, city, plan, setup_fee, monthly_fee, status, ' +
  'leads_this_month, bookings_this_month, client_since, created_at'

const PAYMENT_COLS =
  'payment_status, payment_method, last_payment_date, next_payment_due, ' +
  'paypal_invoice_id, payment_notes'

const SELECT_COLS = `${BASE_COLS}, ${PAYMENT_COLS}`

// All non-archived clients (active workbook for the Clients page).
// Resilient to the payment migration not being applied: if the payment
// columns are missing, retry with the base columns (toRow defaults the
// payment fields), so the page never breaks.
export async function getAdminClients(): Promise<AdminClientsResult> {
  await requireAdmin({ path: '/admin/clients' })

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { rows: [], error: 'Service role key not configured.' }
  }

  try {
    const db = createServiceRoleClient()

    let { data, error } = await db
      .from('admin_clients')
      .select(SELECT_COLS)
      .neq('status', 'archived')
      .order('created_at', { ascending: false })
      .limit(500)

    // Payment migration not applied yet → retry without payment columns.
    if (error && isMissingColumn(error)) {
      ({ data, error } = await db
        .from('admin_clients')
        .select(BASE_COLS)
        .neq('status', 'archived')
        .order('created_at', { ascending: false })
        .limit(500))
    }

    if (error) {
      if (isMissingTable(error)) return { rows: [], error: null }
      throw error
    }

    return { rows: ((data ?? []) as Record<string, unknown>[]).map(toRow), error: null }
  } catch (err) {
    console.error('[getAdminClients]', err instanceof Error ? err.message : err)
    return { rows: [], error: 'Client list is temporarily unavailable.' }
  }
}

// Revenue rollup from real stored fees. Safe to call from Mission Control.
export async function getAdminClientRevenue(): Promise<AdminClientRevenue> {
  await requireAdmin({ path: '/admin/mission-control' })

  const empty: AdminClientRevenue = {
    activeClients: 0, totalClients: 0, mrr: 0, arr: 0,
    setupRevenue: 0, avgMonthly: 0, projected12mo: 0, error: null,
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return empty

  try {
    const db = createServiceRoleClient()
    const { data, error } = await db
      .from('admin_clients')
      .select('status, setup_fee, monthly_fee')
      .neq('status', 'archived')

    if (error) {
      if (isMissingTable(error)) return empty   // no table yet → $0, no error
      throw error
    }

    const rows = (data ?? []) as { status?: string; setup_fee?: number; monthly_fee?: number }[]

    let activeClients = 0
    let mrr = 0
    let setupRevenue = 0
    const totalClients = rows.length

    for (const r of rows) {
      const monthly = typeof r.monthly_fee === 'number' ? r.monthly_fee : 0
      const setup   = typeof r.setup_fee   === 'number' ? r.setup_fee   : 0
      // Setup counted for current clients (active/onboarding/paused).
      if (r.status === 'active' || r.status === 'onboarding' || r.status === 'paused') {
        setupRevenue += setup
      }
      // MRR only from currently-active recurring clients.
      if (r.status === 'active') {
        activeClients += 1
        mrr += monthly
      }
    }

    const arr        = mrr * 12
    const avgMonthly = activeClients > 0 ? Math.round(mrr / activeClients) : 0

    return {
      activeClients,
      totalClients,
      mrr,
      arr,
      setupRevenue,
      avgMonthly,
      projected12mo: arr + setupRevenue,
      error: null,
    }
  } catch (err) {
    console.error('[getAdminClientRevenue]', err instanceof Error ? err.message : err)
    return { ...empty, error: 'Revenue rollup unavailable.' }
  }
}

export interface AdminClientPaymentHealth {
  paid:     number   // payment_status = 'paid'
  unpaid:   number   // payment_status in ('unpaid','deposit_paid')
  overdue:  number   // payment_status = 'overdue' OR past-due & not paid/cancelled
  dueSoon:  number   // next_payment_due within 7 days & not paid/cancelled
  tracked:  number   // total non-archived clients considered
  error:    string | null
}

// Manual payment-health rollup from real admin_clients fields only.
// Returns all-zero (error: null) when the table OR the payment columns
// are missing, so Mission Control never breaks before the migration.
export async function getAdminClientPaymentHealth(): Promise<AdminClientPaymentHealth> {
  await requireAdmin({ path: '/admin/mission-control' })

  const empty: AdminClientPaymentHealth = {
    paid: 0, unpaid: 0, overdue: 0, dueSoon: 0, tracked: 0, error: null,
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return empty

  try {
    const db = createServiceRoleClient()
    const { data, error } = await db
      .from('admin_clients')
      .select('payment_status, next_payment_due')
      .neq('status', 'archived')

    if (error) {
      // No table or payment columns yet → treat as "nothing tracked".
      if (isMissingTable(error) || isMissingColumn(error)) return empty
      throw error
    }

    const rows = (data ?? []) as { payment_status?: string; next_payment_due?: string }[]
    const today   = new Date().toISOString().slice(0, 10)
    const soonIso = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)

    let paid = 0, unpaid = 0, overdue = 0, dueSoon = 0

    for (const r of rows) {
      const status = normalizePaymentStatus(r.payment_status)
      const due    = dateStr(r.next_payment_due)
      const settled = status === 'paid' || status === 'cancelled'

      if (status === 'paid') paid += 1
      if (status === 'unpaid' || status === 'deposit_paid') unpaid += 1

      // Overdue: explicitly flagged, or a past due-date that isn't settled.
      if (status === 'overdue' || (!settled && due !== null && due < today)) overdue += 1

      // Due soon: due within the next 7 days and not yet settled/overdue.
      if (!settled && due !== null && due >= today && due <= soonIso) dueSoon += 1
    }

    return { paid, unpaid, overdue, dueSoon, tracked: rows.length, error: null }
  } catch (err) {
    console.error('[getAdminClientPaymentHealth]', err instanceof Error ? err.message : err)
    return { ...empty, error: 'Payment health unavailable.' }
  }
}

// ── Detail drawer reads ────────────────────────────────────────────

function normalizeOnboarding(raw: unknown): OnboardingStage {
  if (
    raw === 'not_started' || raw === 'intake_needed' || raw === 'setup_in_progress' ||
    raw === 'testing' || raw === 'live' || raw === 'complete'
  ) return raw
  return 'not_started'
}

function normalizeNoteType(raw: unknown): NoteType {
  if (
    raw === 'general' || raw === 'payment' || raw === 'onboarding' ||
    raw === 'support' || raw === 'retention'
  ) return raw
  return 'general'
}

function str(raw: unknown): string | null {
  return typeof raw === 'string' && raw.length > 0 ? raw : null
}

// Full client record. Uses select('*') so it is naturally resilient to
// the payment / onboarding migrations not being applied (missing columns
// simply come back undefined and default via the normalizers).
export async function getClientDetail(clientId: string): Promise<AdminClientDetail | null> {
  await requireAdmin({ path: '/admin/clients' })
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null

  try {
    const db = createServiceRoleClient()
    const { data, error } = await db
      .from('admin_clients')
      .select('*')
      .eq('id', clientId)
      .maybeSingle()

    if (error) {
      if (isMissingTable(error)) return null
      throw error
    }
    if (!data) return null

    const r = data as Record<string, unknown>
    return {
      id:               String(r.id ?? ''),
      business_name:    typeof r.business_name === 'string' ? r.business_name : '(unknown)',
      contact_name:     str(r.contact_name),
      email:            str(r.email),
      phone:            str(r.phone),
      website:          str(r.website),
      industry:         str(r.industry),
      city:             str(r.city),
      plan:             typeof r.plan === 'string' ? r.plan : '',
      setup_fee:        typeof r.setup_fee === 'number' ? r.setup_fee : 0,
      monthly_fee:      typeof r.monthly_fee === 'number' ? r.monthly_fee : 0,
      status:           normalizeStatus(r.status),
      monthly_leads:    typeof r.leads_this_month === 'number' ? r.leads_this_month : 0,
      monthly_bookings: typeof r.bookings_this_month === 'number' ? r.bookings_this_month : 0,
      client_since:     dateStr(r.client_since),
      created_at:       typeof r.created_at === 'string' ? r.created_at : new Date(0).toISOString(),
      source_audit_id:  str(r.source_audit_id),
      source_lead_id:   str(r.source_lead_id),
      payment_status:   normalizePaymentStatus(r.payment_status),
      payment_method:   normalizePaymentMethod(r.payment_method),
      last_payment_date: dateStr(r.last_payment_date),
      next_payment_due:  dateStr(r.next_payment_due),
      paypal_invoice_id: str(r.paypal_invoice_id),
      payment_notes:     str(r.payment_notes),
      onboarding_stage:  normalizeOnboarding(r.onboarding_stage),
      onboarding_notes:  str(r.onboarding_notes),
      onboarding_completed_at: str(r.onboarding_completed_at),
      legacy_notes:      str(r.notes),
    }
  } catch (err) {
    console.error('[getClientDetail]', err instanceof Error ? err.message : err)
    return null
  }
}

export async function getClientNotes(clientId: string): Promise<ClientNotesResult> {
  await requireAdmin({ path: '/admin/clients' })
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { rows: [], migrationNeeded: false, error: 'Service role key not configured.' }
  }

  try {
    const db = createServiceRoleClient()
    const { data, error } = await db
      .from('admin_client_notes')
      .select('id, note, note_type, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) {
      if (isMissingTable(error)) return { rows: [], migrationNeeded: true, error: null }
      throw error
    }

    const rows = ((data ?? []) as Record<string, unknown>[]).map((r) => ({
      id:         String(r.id ?? ''),
      note:       typeof r.note === 'string' ? r.note : '',
      note_type:  normalizeNoteType(r.note_type),
      created_at: typeof r.created_at === 'string' ? r.created_at : new Date(0).toISOString(),
    }))
    return { rows, migrationNeeded: false, error: null }
  } catch (err) {
    console.error('[getClientNotes]', err instanceof Error ? err.message : err)
    return { rows: [], migrationNeeded: false, error: 'Notes are temporarily unavailable.' }
  }
}

export async function getClientPaymentEvents(clientId: string): Promise<ClientPaymentEventsResult> {
  await requireAdmin({ path: '/admin/clients' })
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { rows: [], migrationNeeded: false, error: 'Service role key not configured.' }
  }

  try {
    const db = createServiceRoleClient()
    const { data, error } = await db
      .from('admin_client_payment_events')
      .select('id, payment_status, payment_method, amount, payment_date, next_payment_due, paypal_invoice_id, notes, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) {
      if (isMissingTable(error)) return { rows: [], migrationNeeded: true, error: null }
      throw error
    }

    const rows = ((data ?? []) as Record<string, unknown>[]).map((r) => ({
      id:                String(r.id ?? ''),
      payment_status:    normalizePaymentStatus(r.payment_status),
      payment_method:    normalizePaymentMethod(r.payment_method),
      amount:            typeof r.amount === 'number' ? r.amount : null,
      payment_date:      dateStr(r.payment_date),
      next_payment_due:  dateStr(r.next_payment_due),
      paypal_invoice_id: str(r.paypal_invoice_id),
      notes:             str(r.notes),
      created_at:        typeof r.created_at === 'string' ? r.created_at : new Date(0).toISOString(),
    }))
    return { rows, migrationNeeded: false, error: null }
  } catch (err) {
    console.error('[getClientPaymentEvents]', err instanceof Error ? err.message : err)
    return { rows: [], migrationNeeded: false, error: 'Payment history is temporarily unavailable.' }
  }
}
