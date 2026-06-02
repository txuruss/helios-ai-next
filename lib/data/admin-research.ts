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
  leads_found: number | null
  status:      string
  lead_count:  number
  created_at:  string
}

export interface ResearchRunsResult {
  rows:            ResearchRunSummary[]
  migrationNeeded: boolean
  error:           string | null
}

// A saved lead reshaped to match the client's ResearchResultLead so the
// existing ResearchResultsTable can render historical results unchanged.
// Fields Google Places returned but we don't persist (category, business
// status, types) come back empty — the table degrades gracefully.
export interface ResearchRunLead {
  id:               string
  name:             string
  category:         string | null
  address:          string | null
  phone:            string | null
  website:          string | null
  googleMapsUrl:    string | null
  rating:           number | null
  reviewCount:      number | null
  businessStatus:   string | null
  types:            string[]
  niche:            string
  leadScore:        number
  problemFound:     string
  outreachAngle:    string
  firstDm:          string
  coldEmailOpening: string
  saved:            boolean
}

export interface ResearchRunDetail {
  run:             ResearchRunSummary | null
  leads:           ResearchRunLead[]
  migrationNeeded: boolean
  notFound:        boolean
  error:           string | null
}

function isMissingTable(e: { code?: string; message?: string } | null): boolean {
  if (!e) return false
  if (e.code === '42P01') return true
  const m = (e.message ?? '').toLowerCase()
  return m.includes('relation') && m.includes('does not exist')
}

// lead_count carries the SAVED count (is_saved=true); leads_found carries the
// total found (the column set at run completion).
function toSummary(r: Record<string, unknown>, savedCount: number): ResearchRunSummary {
  return {
    id:          String(r.id ?? ''),
    title:       typeof r.title === 'string' ? r.title : null,
    location:    typeof r.location === 'string' ? r.location : null,
    niches:      Array.isArray(r.niches) ? (r.niches as unknown[]).map(String) : [],
    radius_km:   typeof r.radius_km === 'number' ? r.radius_km : null,
    lead_target: typeof r.lead_target === 'number' ? r.lead_target : null,
    leads_found: typeof r.leads_found === 'number' ? r.leads_found : null,
    status:      typeof r.status === 'string' ? r.status : 'pending',
    lead_count:  savedCount,
    created_at:  typeof r.created_at === 'string' ? r.created_at : new Date(0).toISOString(),
  }
}

function ns(v: unknown): string | null { return typeof v === 'string' && v.length > 0 ? v : null }

// Map a research_leads DB row → the table-compatible lead shape. saved comes
// from is_saved so unsaved "found" rows render as savable.
function toRunLead(r: Record<string, unknown>): ResearchRunLead {
  return {
    id:               String(r.id ?? ''),
    name:             typeof r.business_name === 'string' ? r.business_name : '(unnamed)',
    category:         null,
    address:          ns(r.address),
    phone:            ns(r.phone),
    website:          ns(r.website),
    googleMapsUrl:    ns(r.google_maps_url),
    rating:           typeof r.rating === 'number' ? r.rating : null,
    reviewCount:      typeof r.review_count === 'number' ? r.review_count : null,
    businessStatus:   null,
    types:            [],
    niche:            typeof r.niche === 'string' ? r.niche : '—',
    leadScore:        typeof r.lead_score === 'number' ? r.lead_score : 0,
    problemFound:     ns(r.problem_found) ?? '',
    outreachAngle:    ns(r.outreach_angle) ?? '',
    firstDm:          ns(r.first_dm) ?? '',
    coldEmailOpening: ns(r.cold_email_opening) ?? '',
    saved:            r.is_saved === true,
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
      .select('id, title, location, niches, radius_km, lead_target, leads_found, status, created_at')
      .order('created_at', { ascending: false })
      .limit(Math.max(1, Math.min(50, limit)))

    if (error) {
      if (isMissingTable(error)) return { rows: [], migrationNeeded: true, error: null }
      throw error
    }

    const runRows = (data ?? []) as Record<string, unknown>[]
    const runIds = runRows.map((r) => String(r.id))

    // Saved-lead count per run (is_saved=true), in one batched query.
    const savedMap = new Map<string, number>()
    if (runIds.length > 0) {
      const { data: savedRows, error: savedErr } = await db
        .from('research_leads')
        .select('research_run_id')
        .eq('is_saved', true)
        .in('research_run_id', runIds)
      if (savedErr) {
        if (isMissingTable(savedErr)) return { rows: [], migrationNeeded: true, error: null }
        throw savedErr
      }
      for (const r of (savedRows ?? []) as Record<string, unknown>[]) {
        const id = String(r.research_run_id ?? '')
        if (id) savedMap.set(id, (savedMap.get(id) ?? 0) + 1)
      }
    }

    const rows = runRows.map((r) => toSummary(r, savedMap.get(String(r.id)) ?? 0))
    return { rows, migrationNeeded: false, error: null }
  } catch (err) {
    console.error('[getResearchRuns]', err instanceof Error ? err.message : err)
    return { ...empty, error: 'Could not load research history.' }
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// One research run plus EVERY lead found in it (saved + unsaved), for
// "View Results".
export async function getResearchRunDetail(runId: string): Promise<ResearchRunDetail> {
  await requireAdmin({ path: '/admin/mission-control/research-agent' })
  const empty: ResearchRunDetail = { run: null, leads: [], migrationNeeded: false, notFound: false, error: null }

  if (!UUID_RE.test(runId)) return { ...empty, error: 'Invalid run id.' }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { ...empty, error: 'Server configuration error.' }

  try {
    const db = createServiceRoleClient()

    const { data: runData, error: runErr } = await db
      .from('research_runs')
      .select('id, title, location, niches, radius_km, lead_target, leads_found, status, created_at')
      .eq('id', runId)
      .maybeSingle()

    if (runErr) {
      if (isMissingTable(runErr)) return { ...empty, migrationNeeded: true }
      throw runErr
    }
    if (!runData) return { ...empty, notFound: true }

    const { data: leadData, error: leadErr } = await db
      .from('research_leads')
      .select('id, business_name, niche, address, phone, website, google_maps_url, rating, review_count, problem_found, outreach_angle, first_dm, cold_email_opening, lead_score, is_saved, created_at')
      .eq('research_run_id', runId)
      .order('is_saved', { ascending: false })
      .order('lead_score', { ascending: false })

    if (leadErr) {
      if (isMissingTable(leadErr)) return { ...empty, migrationNeeded: true }
      throw leadErr
    }

    const leads = ((leadData ?? []) as Record<string, unknown>[]).map(toRunLead)
    const savedCount = leads.filter((l) => l.saved).length
    const run = toSummary(runData as Record<string, unknown>, savedCount)
    return { run, leads, migrationNeeded: false, notFound: false, error: null }
  } catch (err) {
    console.error('[getResearchRunDetail]', err instanceof Error ? err.message : err)
    return { ...empty, error: 'Could not load research run.' }
  }
}
