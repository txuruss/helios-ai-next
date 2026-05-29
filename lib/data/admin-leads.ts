// ── Founder-only admin sales-pipeline reads (admin_leads) ─────────
//
// Reads the Helios agency sales pipeline from public.admin_leads.
// Distinct from lib/data (per-business end-customer leads).
//
// SECURITY
//   • requireAdmin() gates every call (founder_admin only).
//   • Queries run through the service-role client; the key never
//     leaves the server.
//
// RESILIENCE
//   • If admin_leads does not exist yet (migration not applied) or any
//     query fails, helpers resolve to EMPTY rows so the page renders a
//     clean empty state instead of crashing. A missing table is treated
//     as "no leads yet" (error: null), not as an error banner.

import 'server-only'

import { requireAdmin } from '@/lib/auth/require-admin'
import { createServiceRoleClient } from '@/lib/supabase/server'

export type AdminLeadStage =
  | 'new' | 'qualified' | 'audit_sent' | 'proposal' | 'won' | 'lost'

// UI-facing row. Field names intentionally match what LeadsPageClient
// consumes (business / contact / plan_target / value_usd / next_action).
export interface AdminLeadRow {
  id:              string
  business:        string
  contact:         string
  email:           string | null
  stage:           AdminLeadStage
  plan_target:     string            // 'starter' | 'pro' | 'scale' | ''
  value_usd:       number
  next_action:     string
  source_audit_id: string | null
}

export interface AdminLeadsResult {
  rows:  AdminLeadRow[]
  error: string | null
}

function normalizeStage(raw: unknown): AdminLeadStage {
  if (
    raw === 'new' || raw === 'qualified' || raw === 'audit_sent' ||
    raw === 'proposal' || raw === 'won' || raw === 'lost'
  ) return raw
  return 'new'
}

function toRow(raw: Record<string, unknown>): AdminLeadRow {
  return {
    id:              String(raw.id ?? ''),
    business:        typeof raw.business_name === 'string' ? raw.business_name : '(unknown)',
    contact:         typeof raw.contact_name === 'string' && raw.contact_name ? raw.contact_name : '—',
    email:           typeof raw.email === 'string' ? raw.email : null,
    stage:           normalizeStage(raw.stage),
    plan_target:     typeof raw.target_plan === 'string' ? raw.target_plan : '',
    value_usd:       typeof raw.estimated_value === 'number' ? raw.estimated_value : 0,
    next_action:     typeof raw.next_action === 'string' && raw.next_action ? raw.next_action : '—',
    source_audit_id: typeof raw.source_audit_id === 'string' ? raw.source_audit_id : null,
  }
}

// PostgREST "relation does not exist" → treat as empty (migration pending).
function isMissingTable(e: { code?: string; message?: string } | null): boolean {
  if (!e) return false
  if (e.code === '42P01') return true
  const m = (e.message ?? '').toLowerCase()
  return m.includes('relation') && m.includes('does not exist')
}

const SELECT_COLS =
  'id, source_audit_id, business_name, contact_name, email, target_plan, ' +
  'stage, estimated_value, next_action, created_at'

export async function getAdminLeads(): Promise<AdminLeadsResult> {
  await requireAdmin({ path: '/admin/leads' })

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { rows: [], error: 'Service role key not configured.' }
  }

  try {
    const db = createServiceRoleClient()
    const { data, error } = await db
      .from('admin_leads')
      .select(SELECT_COLS)
      .neq('stage', 'archived')
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      if (isMissingTable(error)) return { rows: [], error: null }
      throw error
    }

    return { rows: ((data ?? []) as Record<string, unknown>[]).map(toRow), error: null }
  } catch (err) {
    console.error('[getAdminLeads]', err instanceof Error ? err.message : err)
    return { rows: [], error: 'Leads pipeline is temporarily unavailable.' }
  }
}
