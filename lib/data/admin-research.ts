// ── Founder-only reads: Business Research Agent (research_runs) ────
//
// SECURITY: requireAdmin() gates every call; service-role client used.
// RESILIENCE: missing table → empty + migrationNeeded, never crashes.

import 'server-only'

import { requireAdmin } from '@/lib/auth/require-admin'
import { createServiceRoleClient } from '@/lib/supabase/server'

export interface ResearchRunSummary {
  id:          string
  title:       string | null
  location:    string | null
  niches:      string[]
  radius_km:   number | null
  lead_target: number | null
  status:      string
  lead_count:  number
  created_at:  string
}

export interface ResearchRunsResult {
  rows:            ResearchRunSummary[]
  migrationNeeded: boolean
  error:           string | null
}

function isMissingTable(e: { code?: string; message?: string } | null): boolean {
  if (!e) return false
  if (e.code === '42P01') return true
  const m = (e.message ?? '').toLowerCase()
  return m.includes('relation') && m.includes('does not exist')
}

function toSummary(r: Record<string, unknown>): ResearchRunSummary {
  // Supabase returns the embedded aggregate as research_leads: [{ count }].
  let leadCount = 0
  const rel = r.research_leads
  if (Array.isArray(rel) && rel.length > 0 && typeof (rel[0] as Record<string, unknown>).count === 'number') {
    leadCount = (rel[0] as { count: number }).count
  }
  return {
    id:          String(r.id ?? ''),
    title:       typeof r.title === 'string' ? r.title : null,
    location:    typeof r.location === 'string' ? r.location : null,
    niches:      Array.isArray(r.niches) ? (r.niches as unknown[]).map(String) : [],
    radius_km:   typeof r.radius_km === 'number' ? r.radius_km : null,
    lead_target: typeof r.lead_target === 'number' ? r.lead_target : null,
    status:      typeof r.status === 'string' ? r.status : 'pending',
    lead_count:  leadCount,
    created_at:  typeof r.created_at === 'string' ? r.created_at : new Date(0).toISOString(),
  }
}

// Recent research runs (newest first) with a saved-lead count per run.
export async function getResearchRuns(limit = 15): Promise<ResearchRunsResult> {
  await requireAdmin({ path: '/admin/mission-control/research-agent' })
  const empty: ResearchRunsResult = { rows: [], migrationNeeded: false, error: null }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ...empty, error: 'Server configuration error.' }
  }

  try {
    const db = createServiceRoleClient()
    const { data, error } = await db
      .from('research_runs')
      .select('id, title, location, niches, radius_km, lead_target, status, created_at, research_leads(count)')
      .order('created_at', { ascending: false })
      .limit(Math.max(1, Math.min(50, limit)))

    if (error) {
      if (isMissingTable(error)) return { rows: [], migrationNeeded: true, error: null }
      throw error
    }
    const rows = ((data ?? []) as Record<string, unknown>[]).map(toSummary)
    return { rows, migrationNeeded: false, error: null }
  } catch (err) {
    console.error('[getResearchRuns]', err instanceof Error ? err.message : err)
    return { ...empty, error: 'Could not load research history.' }
  }
}
