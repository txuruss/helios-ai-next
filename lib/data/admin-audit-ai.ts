// ── Founder-only reads: audit AI results (admin_audit_ai_results) ──
//
// SECURITY: requireAdmin() gates reads; service-role client used.
// RESILIENCE: missing table → empty + migrationNeeded, never crashes.

import 'server-only'

import { requireAdmin } from '@/lib/auth/require-admin'
import { createServiceRoleClient } from '@/lib/supabase/server'

export type AuditAiStatus = 'running' | 'completed' | 'failed'

export interface AuditAiResult {
  audit_id:                 string
  business_summary:         string | null
  fit_score:                number | null
  urgency_score:            number | null
  lead_priority:            string | null
  recommended_offer:        string | null
  automation_opportunities: string[]
  missing_information:      string[]
  suggested_next_action:    string | null
  founder_notes:            string | null
  status:                   AuditAiStatus
  error_message:            string | null
  created_at:               string
}

function isMissingTable(e: { code?: string; message?: string } | null): boolean {
  if (!e) return false
  if (e.code === '42P01') return true
  const m = (e.message ?? '').toLowerCase()
  return m.includes('relation') && m.includes('does not exist')
}

function strArr(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean)
  return []
}
function normStatus(v: unknown): AuditAiStatus {
  return v === 'running' || v === 'completed' || v === 'failed' ? v : 'completed'
}

const COLS =
  'audit_id, business_summary, fit_score, urgency_score, lead_priority, recommended_offer, ' +
  'automation_opportunities, missing_information, suggested_next_action, founder_notes, status, error_message, created_at'

function toResult(r: Record<string, unknown>): AuditAiResult {
  return {
    audit_id:                 String(r.audit_id ?? ''),
    business_summary:         typeof r.business_summary === 'string' ? r.business_summary : null,
    fit_score:                typeof r.fit_score === 'number' ? r.fit_score : null,
    urgency_score:            typeof r.urgency_score === 'number' ? r.urgency_score : null,
    lead_priority:            typeof r.lead_priority === 'string' ? r.lead_priority : null,
    recommended_offer:        typeof r.recommended_offer === 'string' ? r.recommended_offer : null,
    automation_opportunities: strArr(r.automation_opportunities),
    missing_information:      strArr(r.missing_information),
    suggested_next_action:    typeof r.suggested_next_action === 'string' ? r.suggested_next_action : null,
    founder_notes:            typeof r.founder_notes === 'string' ? r.founder_notes : null,
    status:                   normStatus(r.status),
    error_message:            typeof r.error_message === 'string' ? r.error_message : null,
    created_at:               typeof r.created_at === 'string' ? r.created_at : new Date(0).toISOString(),
  }
}

export interface AuditAiResultsMap {
  byAudit:         Record<string, AuditAiResult>
  migrationNeeded: boolean
}

// Map of auditId → result for the given audit ids (for the audits table).
export async function getAuditAiResultsForAudits(auditIds: string[]): Promise<AuditAiResultsMap> {
  await requireAdmin({ path: '/admin/audits' })
  const empty: AuditAiResultsMap = { byAudit: {}, migrationNeeded: false }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || auditIds.length === 0) return empty

  try {
    const db = createServiceRoleClient()
    const { data, error } = await db
      .from('admin_audit_ai_results')
      .select(COLS)
      .in('audit_id', auditIds)

    if (error) {
      if (isMissingTable(error)) return { byAudit: {}, migrationNeeded: true }
      throw error
    }

    const byAudit: Record<string, AuditAiResult> = {}
    for (const r of (data ?? []) as Record<string, unknown>[]) {
      const res = toResult(r)
      if (res.audit_id) byAudit[res.audit_id] = res
    }
    return { byAudit, migrationNeeded: false }
  } catch (err) {
    console.error('[getAuditAiResultsForAudits]', err instanceof Error ? err.message : err)
    return empty
  }
}
