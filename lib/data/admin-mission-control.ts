// ── Lean Baseline: admin Mission Control summary ─────────────────
//
// Aggregates the practical founder KPIs for /admin/mission-control:
//   • Active client count (businesses table)
//   • Recent leads (7-day window)
//   • Recent bookings (7-day window)
//   • Service health flags (env presence — not a live ping)
//
// Audit-submission counts come from getAdminAuditMetrics() in
// lib/data/admin-audits.ts and are composed at the page level so we
// only hit the audit_submissions RLS check once.
//
// SECURITY
//   • requireAdmin() is the gate; the service-role client is then used
//     to read across all businesses for the founder dashboard.
//   • The service role key never reaches the browser.

import 'server-only'

import { requireAdmin } from '@/lib/auth/require-admin'
import { createServiceRoleClient } from '@/lib/supabase/server'

export interface AdminMissionControlSummary {
  activeClients:  number
  recentLeads:    number
  recentBookings: number
  health: {
    supabase:   boolean
    anthropic:  boolean
    calcom:     boolean
    whatsapp:   boolean
    stripe:     boolean
  }
  error: string | null
}

function daysAgoIso(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString()
}

export async function getAdminMissionControlSummary(): Promise<AdminMissionControlSummary> {
  await requireAdmin({ path: '/admin/mission-control' })

  // Env-presence health flags. Not a live ping — just whether the
  // backing keys are configured. Cheap and non-blocking.
  const health = {
    supabase:  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    calcom:    !!process.env.CALCOM_API_KEY,
    whatsapp:  !!process.env.WHATSAPP_TOKEN || !!process.env.WHATSAPP_ACCESS_TOKEN,
    stripe:    !!process.env.STRIPE_SECRET_KEY,
  }

  const empty: AdminMissionControlSummary = {
    activeClients:  0,
    recentLeads:    0,
    recentBookings: 0,
    health,
    error:          null,
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ...empty, error: 'Service role key not configured.' }
  }

  try {
    const db = createServiceRoleClient()
    const since = daysAgoIso(7)

    const [clientsRes, leadsRes, bookingsRes] = await Promise.all([
      db.from('businesses').select('id', { count: 'exact', head: true }),
      db.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', since),
      db.from('bookings').select('id', { count: 'exact', head: true }).gte('created_at', since),
    ])

    return {
      activeClients:  clientsRes.count  ?? 0,
      recentLeads:    leadsRes.count    ?? 0,
      recentBookings: bookingsRes.count ?? 0,
      health,
      error:          null,
    }
  } catch (err) {
    console.error('[getAdminMissionControlSummary]', err instanceof Error ? err.message : err)
    return { ...empty, error: 'Mission Control summary is unavailable.' }
  }
}
