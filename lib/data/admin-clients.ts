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
  }
}

function isMissingTable(e: { code?: string; message?: string } | null): boolean {
  if (!e) return false
  if (e.code === '42P01') return true
  const m = (e.message ?? '').toLowerCase()
  return m.includes('relation') && m.includes('does not exist')
}

const SELECT_COLS =
  'id, business_name, industry, city, plan, setup_fee, monthly_fee, status, ' +
  'leads_this_month, bookings_this_month, client_since, created_at'

// All non-archived clients (active workbook for the Clients page).
export async function getAdminClients(): Promise<AdminClientsResult> {
  await requireAdmin({ path: '/admin/clients' })

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { rows: [], error: 'Service role key not configured.' }
  }

  try {
    const db = createServiceRoleClient()
    const { data, error } = await db
      .from('admin_clients')
      .select(SELECT_COLS)
      .neq('status', 'archived')
      .order('created_at', { ascending: false })
      .limit(500)

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
