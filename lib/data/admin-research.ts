// ── Role-scoped reads: Business Research Agent (research_runs) ─────
//
// SECURITY: requireAdmin() gates every call; service-role client used.
// OWNERSHIP: every read is scoped via leadScopeFor() — founder_admin sees
// all runs/leads, outreach_agent sees ONLY rows they own. The scoping
// happens HERE (server-side query layer), never just in the UI.
// RESILIENCE: missing table → empty + migrationNeeded; missing ownership
// columns → founder falls back to base columns, agents FAIL CLOSED.

import 'server-only'

import { requireAdmin } from '@/lib/auth/require-admin'
import { leadScopeFor, type LeadScope } from '@/lib/auth/permissions'
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
  // Run ownership (migration 20260609120000). Null for legacy runs.
  created_by_name:  string | null
  created_by_email: string | null
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
  // Attribution (migration 20260608120000). Null for legacy/unknown leads.
  saved_by_team_member_id: string | null
  saved_by_name:           string | null
  saved_by_email:          string | null
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

// Postgres "undefined_column" — raised when the attribution columns
// (migration 20260608120000) aren't applied yet. Lets reads fall back to the
// base column set instead of failing the whole Saved Leads view.
function isMissingColumn(e: { code?: string; message?: string } | null): boolean {
  if (!e) return false
  if (e.code === '42703') return true
  const m = (e.message ?? '').toLowerCase()
  return m.includes('column') && m.includes('does not exist')
}

// Saved-lead column sets. The base set predates attribution; the attributed
// set adds saved_by_*. Founder reads try the attributed set and fall back to
// base; agent reads NEVER fall back (ownership can't be verified → empty).
const SAVED_LEAD_BASE_COLS =
  'id, research_run_id, place_id, business_name, niche, address, phone, website, ' +
  'google_maps_url, rating, review_count, problem_found, outreach_angle, first_dm, ' +
  'cold_email_opening, lead_score, status, created_at, saved_at'
const SAVED_LEAD_COLS =
  SAVED_LEAD_BASE_COLS + ', saved_by_team_member_id, saved_by_name, saved_by_email'

// Run column sets — same pattern for run ownership (20260609120000).
const RUN_BASE_COLS =
  'id, title, location, niches, radius_km, lead_target, leads_found, status, created_at'
const RUN_COLS =
  RUN_BASE_COLS + ', created_by_team_member_id, created_by_name, created_by_email'

// User-safe hints shown when an agent's view requires a not-yet-applied
// ownership migration. Agents fail closed (no rows) rather than seeing all.
const LEAD_OWNERSHIP_HINT =
  'Per-agent lead visibility requires migration 20260608120000_add_saved_by_attribution.sql in Supabase.'
const RUN_OWNERSHIP_HINT =
  'Per-agent run history requires migration 20260609120000_add_research_run_ownership.sql in Supabase.'

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
    created_by_name:  ns(r.created_by_name),
    created_by_email: ns(r.created_by_email),
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
// Scoped: founder sees all runs; outreach_agent sees only their own.
export async function getResearchRuns(limit = 15): Promise<ResearchRunsResult> {
  const session = await requireAdmin({ path: '/admin/mission-control/research-agent' })
  const scope = leadScopeFor(session.role, session.teamMemberId)
  const empty: ResearchRunsResult = { rows: [], migrationNeeded: false, error: null }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ...empty, error: 'Server configuration error.' }
  }
  if (!scope.viewAll && !scope.ownTeamMemberId) return empty // deny: no owner identity

  try {
    const db = createServiceRoleClient()
    const runQuery = (cols: string) => {
      let q = db.from('research_runs').select(cols)
      if (!scope.viewAll) q = q.eq('created_by_team_member_id', scope.ownTeamMemberId)
      return q.order('created_at', { ascending: false }).limit(Math.max(1, Math.min(50, limit)))
    }

    let res = await runQuery(RUN_COLS)
    if (res.error && isMissingColumn(res.error)) {
      // Ownership columns not migrated: founder degrades to the base view;
      // an agent fails closed (we cannot verify which runs are theirs).
      if (!scope.viewAll) return { ...empty, error: RUN_OWNERSHIP_HINT }
      res = await runQuery(RUN_BASE_COLS)
    }
    const { data, error } = res

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
// "View Results". Scoped: an outreach_agent can only open their OWN runs —
// any other run id behaves as not found (no existence leak).
export async function getResearchRunDetail(runId: string): Promise<ResearchRunDetail> {
  const session = await requireAdmin({ path: '/admin/mission-control/research-agent' })
  const scope = leadScopeFor(session.role, session.teamMemberId)
  const empty: ResearchRunDetail = { run: null, leads: [], migrationNeeded: false, notFound: false, error: null }

  if (!UUID_RE.test(runId)) return { ...empty, error: 'Invalid run id.' }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { ...empty, error: 'Server configuration error.' }
  if (!scope.viewAll && !scope.ownTeamMemberId) return { ...empty, notFound: true } // deny

  try {
    const db = createServiceRoleClient()

    const runQuery = (cols: string) => {
      let q = db.from('research_runs').select(cols).eq('id', runId)
      if (!scope.viewAll) q = q.eq('created_by_team_member_id', scope.ownTeamMemberId)
      return q.maybeSingle()
    }

    let runRes = await runQuery(RUN_COLS + ', raw_results')
    if (runRes.error && isMissingColumn(runRes.error)) {
      if (!scope.viewAll) return { ...empty, error: RUN_OWNERSHIP_HINT }
      runRes = await runQuery(RUN_BASE_COLS + ', raw_results')
    }
    const { data: runData, error: runErr } = runRes

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
    saved_by_team_member_id: ns(r.saved_by_team_member_id),
    saved_by_name:           ns(r.saved_by_name),
    saved_by_email:          ns(r.saved_by_email),
  }
}

// All saved research leads across runs (including archived, so the pipeline
// summary + status filter can show them), newest-saved first. De-duplicated by
// business (place id / domain / phone / name+addr), keeping the most recently
// saved row.
export async function getSavedResearchLeads(): Promise<SavedResearchLeadsResult> {
  const session = await requireAdmin({ path: '/admin/mission-control/research-agent' })
  const scope = leadScopeFor(session.role, session.teamMemberId)
  const empty: SavedResearchLeadsResult = { rows: [], migrationNeeded: false, error: null }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ...empty, error: 'Server configuration error.' }
  }
  if (!scope.viewAll && !scope.ownTeamMemberId) return empty // deny: no owner identity

  try {
    const db = createServiceRoleClient()
    const runQuery = (cols: string) => {
      let q = db.from('research_leads').select(cols).eq('is_saved', true)
      if (!scope.viewAll) q = q.eq('saved_by_team_member_id', scope.ownTeamMemberId)
      return q
        .order('saved_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
    }

    let res = await runQuery(SAVED_LEAD_COLS)
    // Attribution columns not migrated yet → founder falls back to the base
    // set (attribution shows "Unknown"); an agent FAILS CLOSED — without the
    // columns we cannot tell which leads are theirs.
    if (res.error && isMissingColumn(res.error)) {
      if (!scope.viewAll) return { ...empty, error: LEAD_OWNERSHIP_HINT }
      res = await runQuery(SAVED_LEAD_BASE_COLS)
    }
    const { data, error } = res

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

// One saved research lead by id — used to prefill the Client Outreach
// "Add lead" form when a lead is sent to outreach. Returns null on any miss.
// Scoped: an outreach_agent can only fetch their OWN lead — any other id
// behaves as not found (blocks direct-URL prefill of someone else's lead).
export async function getResearchLeadById(id: string): Promise<SavedResearchLead | null> {
  const session = await requireAdmin({ path: '/admin/outreach' })
  const scope = leadScopeFor(session.role, session.teamMemberId)
  if (!UUID_RE.test(id) || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  if (!scope.viewAll && !scope.ownTeamMemberId) return null // deny

  try {
    const db = createServiceRoleClient()
    const runQuery = (cols: string) => {
      let q = db.from('research_leads').select(cols).eq('id', id)
      if (!scope.viewAll) q = q.eq('saved_by_team_member_id', scope.ownTeamMemberId)
      return q.maybeSingle()
    }

    let res = await runQuery(SAVED_LEAD_COLS)
    if (res.error && isMissingColumn(res.error)) {
      if (!scope.viewAll) return null // agent: fail closed without ownership columns
      res = await runQuery(SAVED_LEAD_BASE_COLS)
    }
    const { data, error } = res
    if (error || !data) return null
    return toSavedLead(data as Record<string, unknown>)
  } catch (err) {
    console.error('[getResearchLeadById]', err instanceof Error ? err.message : err)
    return null
  }
}
