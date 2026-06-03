// ── Founder-only reads: Business Research Agent (research_runs) ────
//
// SECURITY: requireAdmin() gates every call; service-role client used.
// RESILIENCE: missing table → empty + migrationNeeded, never crashes.

import 'server-only'

import { requireAdmin } from '@/lib/auth/require-admin'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { leadDedupKey } from '@/lib/research/leadScoring'

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
  placeId:          string | null
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

// A saved research lead (is_saved=true) shown in the Saved Leads view.
export interface SavedResearchLead {
  id:              string
  research_run_id: string | null
  business_name:   string
  niche:           string | null
  address:         string | null
  phone:           string | null
  website:         string | null
  google_maps_url: string | null
  rating:          number | null
  review_count:    number | null
  problem_found:   string | null
  outreach_angle:  string | null
  first_dm:        string | null
  cold_email_opening: string | null
  lead_score:      number | null
  status:          string
  created_at:      string
  saved_at:        string | null
}

export interface SavedResearchLeadsResult {
  rows:            SavedResearchLead[]
  migrationNeeded: boolean
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
function nnum(v: unknown): number | null { return typeof v === 'number' ? v : null }

// Map a research_leads DB row → the table-compatible lead shape. Used only as
// a fallback for legacy runs that have no raw_results JSON.
function toRunLead(r: Record<string, unknown>): ResearchRunLead {
  return {
    id:               String(r.id ?? ''),
    placeId:          ns(r.place_id),
    name:             typeof r.business_name === 'string' ? r.business_name : '(unnamed)',
    category:         null,
    address:          ns(r.address),
    phone:            ns(r.phone),
    website:          ns(r.website),
    googleMapsUrl:    ns(r.google_maps_url),
    rating:           nnum(r.rating),
    reviewCount:      nnum(r.review_count),
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

// Map a raw_results JSON entry (a stored ScoredLead) → the table shape,
// re-deriving saved from the run's current saved-leads set.
function rawToRunLead(raw: Record<string, unknown>, savedKeys: Set<string>): ResearchRunLead {
  const placeId       = ns(raw.placeId)
  const website       = ns(raw.website)
  const phone         = ns(raw.phone)
  const name          = typeof raw.name === 'string' ? raw.name : '(unnamed)'
  const address       = ns(raw.address)
  const key = leadDedupKey({ placeId, website, phone, name, address })
  return {
    id:               typeof raw.id === 'string' ? raw.id : key,
    placeId,
    name,
    category:         ns(raw.category),
    address,
    phone,
    website,
    googleMapsUrl:    ns(raw.googleMapsUrl),
    rating:           nnum(raw.rating),
    reviewCount:      nnum(raw.reviewCount),
    businessStatus:   ns(raw.businessStatus),
    types:            Array.isArray(raw.types) ? (raw.types as unknown[]).map(String) : [],
    niche:            typeof raw.niche === 'string' ? raw.niche : '—',
    leadScore:        typeof raw.leadScore === 'number' ? raw.leadScore : 0,
    problemFound:     ns(raw.problemFound) ?? '',
    outreachAngle:    ns(raw.outreachAngle) ?? '',
    firstDm:          ns(raw.firstDm) ?? '',
    coldEmailOpening: ns(raw.coldEmailOpening) ?? '',
    saved:            savedKeys.has(key),
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
      .select('id, title, location, niches, radius_km, lead_target, leads_found, status, created_at, raw_results')
      .eq('id', runId)
      .maybeSingle()

    if (runErr) {
      if (isMissingTable(runErr)) return { ...empty, migrationNeeded: true }
      throw runErr
    }
    if (!runData) return { ...empty, notFound: true }
    const runRecord = runData as Record<string, unknown>

    // Currently-saved leads for this run → dedupe set + saved count.
    const { data: savedData, error: savedErr } = await db
      .from('research_leads')
      .select('id, place_id, website, phone, business_name, address, niche, google_maps_url, rating, review_count, problem_found, outreach_angle, first_dm, cold_email_opening, lead_score, is_saved')
      .eq('research_run_id', runId)
      .order('lead_score', { ascending: false })

    if (savedErr) {
      if (isMissingTable(savedErr)) return { ...empty, migrationNeeded: true }
      throw savedErr
    }

    const savedRows = (savedData ?? []) as Record<string, unknown>[]
    const savedKeys = new Set<string>()
    for (const r of savedRows) {
      savedKeys.add(leadDedupKey({
        placeId: r.place_id as string | null,
        website: r.website as string | null,
        phone:   r.phone as string | null,
        name:    r.business_name as string | null,
        address: r.address as string | null,
      }))
    }
    const savedCount = savedRows.length

    // Prefer the run's full result set (raw_results). Fall back to the saved
    // rows for legacy runs created before raw_results existed.
    const raw = runRecord.raw_results
    const leads = Array.isArray(raw) && raw.length > 0
      ? (raw as Record<string, unknown>[]).map((r) => rawToRunLead(r, savedKeys))
      : savedRows.map(toRunLead)

    const run = toSummary(runRecord, savedCount)
    return { run, leads, migrationNeeded: false, notFound: false, error: null }
  } catch (err) {
    console.error('[getResearchRunDetail]', err instanceof Error ? err.message : err)
    return { ...empty, error: 'Could not load research run.' }
  }
}

function toSavedLead(r: Record<string, unknown>): SavedResearchLead {
  return {
    id:                 String(r.id ?? ''),
    research_run_id:    ns(r.research_run_id),
    business_name:      typeof r.business_name === 'string' ? r.business_name : '(unnamed)',
    niche:              ns(r.niche),
    address:            ns(r.address),
    phone:              ns(r.phone),
    website:            ns(r.website),
    google_maps_url:    ns(r.google_maps_url),
    rating:             nnum(r.rating),
    review_count:       nnum(r.review_count),
    problem_found:      ns(r.problem_found),
    outreach_angle:     ns(r.outreach_angle),
    first_dm:           ns(r.first_dm),
    cold_email_opening: ns(r.cold_email_opening),
    lead_score:         nnum(r.lead_score),
    status:             typeof r.status === 'string' ? r.status : 'saved',
    created_at:         typeof r.created_at === 'string' ? r.created_at : new Date(0).toISOString(),
    saved_at:           ns(r.saved_at),
  }
}

// All saved research leads across runs (including archived, so the pipeline
// summary + status filter can show them), newest-saved first. De-duplicated by
// business (place id / domain / phone / name+addr), keeping the most recently
// saved row.
export async function getSavedResearchLeads(): Promise<SavedResearchLeadsResult> {
  await requireAdmin({ path: '/admin/mission-control/research-agent' })
  const empty: SavedResearchLeadsResult = { rows: [], migrationNeeded: false, error: null }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ...empty, error: 'Server configuration error.' }
  }

  try {
    const db = createServiceRoleClient()
    const { data, error } = await db
      .from('research_leads')
      .select('id, research_run_id, place_id, business_name, niche, address, phone, website, google_maps_url, rating, review_count, problem_found, outreach_angle, first_dm, cold_email_opening, lead_score, status, created_at, saved_at')
      .eq('is_saved', true)
      .order('saved_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (error) {
      if (isMissingTable(error)) return { rows: [], migrationNeeded: true, error: null }
      throw error
    }

    // De-dupe by business, keeping the first (most recently saved) row.
    const seen = new Set<string>()
    const rows: SavedResearchLead[] = []
    for (const raw of (data ?? []) as Record<string, unknown>[]) {
      const key = leadDedupKey({
        placeId: raw.place_id as string | null,
        website: raw.website as string | null,
        phone:   raw.phone as string | null,
        name:    raw.business_name as string | null,
        address: raw.address as string | null,
      })
      if (seen.has(key)) continue
      seen.add(key)
      rows.push(toSavedLead(raw))
    }
    return { rows, migrationNeeded: false, error: null }
  } catch (err) {
    console.error('[getSavedResearchLeads]', err instanceof Error ? err.message : err)
    return { ...empty, error: 'Could not load saved leads.' }
  }
}
