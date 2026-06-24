// ════════════════════════════════════════════════════════════════════
// Scoped lead data-access layer — THE canonical, safe-by-default API for
// every lead read in admin / Mission Control surfaces.
// ════════════════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   Per-agent lead isolation is enforced in application code, not by the
//   database (RLS on the lead tables is founder-only; agents read via the
//   service-role client, which bypasses RLS). That means a single query
//   that forgets the ownership filter leaks every agent's leads to every
//   other agent. This module makes the scoped query the ONLY easy path:
//   pass a server-derived session, get back exactly the rows that session
//   is allowed to see.
//
// THE RULE (see docs/security-guardrails.md)
//   Any read of research_leads / research_runs / admin_outreach_leads must
//   go through this layer. Do NOT write ad-hoc scoped queries in pages,
//   API routes, or new data files. If a direct query is unavoidable,
//   explain why in a code comment AND apply leadScopeFor() yourself.
//
// SCOPING MODEL (leadScopeFor)
//   founder_admin   → viewAll = true  → sees every agency lead.
//   outreach_agent  → viewAll = false → sees ONLY rows it owns
//                     (saved_by/created_by = its team_members.id).
//   any other role  → denied (empty / not found).
//   Non-UUID team member id (e.g. dev mock) → denied (fail closed).
//
// SESSION CONTRACT
//   `session` MUST come from a server-side auth guard (requireAdmin /
//   requireOutreachAccess / requireFounderAdmin / requireTeam). Never build
//   a TeamSession from client input. These functions intentionally do NOT
//   call the guards themselves — the caller authenticates, this layer
//   authorizes per-row.
//
// RESILIENCE
//   Missing table → empty + migrationNeeded. Missing ownership columns
//   (attribution migrations not applied) → founder degrades to base
//   columns; an agent FAILS CLOSED (no rows) because ownership cannot be
//   verified. Agents are never shown unscoped data.

import 'server-only'

import { leadScopeFor } from '@/lib/auth/permissions'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { leadDedupKey } from '@/lib/research/leadScoring'
import type { TeamSession } from '@/lib/auth/types'
import type { SavedResearchLead, SavedResearchLeadsResult } from '@/lib/data/admin-research'
import type { AdminOutreachLead, AdminOutreachResult } from '@/lib/data/admin-outreach'
import type { OutreachReplyStatus, OutreachContactMethod } from '@/lib/admin/outreach'

// ── Small local helpers (kept here so this security-critical layer has no
//    runtime dependency on the legacy data modules) ───────────────────
function ns(v: unknown): string | null { return typeof v === 'string' && v.length > 0 ? v : null }
function nnum(v: unknown): number | null { return typeof v === 'number' ? v : null }
function isMissingTable(e: { code?: string; message?: string } | null): boolean {
  if (!e) return false
  if (e.code === '42P01') return true
  const m = (e.message ?? '').toLowerCase()
  return m.includes('relation') && m.includes('does not exist')
}
function isMissingColumn(e: { code?: string; message?: string } | null): boolean {
  if (!e) return false
  if (e.code === '42703') return true
  const m = (e.message ?? '').toLowerCase()
  return m.includes('column') && m.includes('does not exist')
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Column sets — full set includes ownership/attribution columns; base set
// predates them. Founder falls back to base; agents fail closed.
const RESEARCH_BASE_COLS =
  'id, research_run_id, place_id, business_name, niche, address, phone, website, ' +
  'google_maps_url, rating, review_count, problem_found, outreach_angle, first_dm, ' +
  'cold_email_opening, lead_score, status, created_at, saved_at'
const RESEARCH_COLS =
  RESEARCH_BASE_COLS + ', saved_by_team_member_id, saved_by_name, saved_by_email'

const OUTREACH_BASE_COLS =
  'id, business_name, niche, location, instagram_url, website_url, phone, email, contact_method, ' +
  'score, pain_found, outreach_angle, first_message_sent, reply_status, next_action, follow_up_date, ' +
  'last_contacted_at, notes, created_at'
const OUTREACH_COLS =
  OUTREACH_BASE_COLS + ', created_by_team_member_id, created_by_name, created_by_email'

const RESEARCH_OWNERSHIP_HINT =
  'Per-agent lead visibility requires migration 20260608120000_add_saved_by_attribution.sql in Supabase.'
const OUTREACH_OWNERSHIP_HINT =
  'Per-agent lead visibility requires migration 20260608120000_add_saved_by_attribution.sql in Supabase.'

// ── Row mappers (the single source of truth for these shapes) ────────
function mapSavedResearchLead(r: Record<string, unknown>): SavedResearchLead {
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

function mapOutreachLead(r: Record<string, unknown>): AdminOutreachLead {
  return {
    id:                 String(r.id ?? ''),
    business_name:      typeof r.business_name === 'string' ? r.business_name : '(unnamed)',
    niche:              typeof r.niche === 'string' ? r.niche : '—',
    location:           ns(r.location),
    instagram_url:      ns(r.instagram_url),
    website_url:        ns(r.website_url),
    phone:              ns(r.phone),
    email:              ns(r.email),
    contact_method:     (typeof r.contact_method === 'string' ? r.contact_method : 'instagram') as OutreachContactMethod,
    score:              typeof r.score === 'number' ? r.score : 0,
    pain_found:         ns(r.pain_found),
    outreach_angle:     ns(r.outreach_angle),
    first_message_sent: r.first_message_sent === true,
    reply_status:       (typeof r.reply_status === 'string' ? r.reply_status : 'new') as OutreachReplyStatus,
    next_action:        ns(r.next_action),
    follow_up_date:     ns(r.follow_up_date),
    last_contacted_at:  ns(r.last_contacted_at),
    notes:              ns(r.notes),
    created_at:         typeof r.created_at === 'string' ? r.created_at : new Date(0).toISOString(),
    created_by_team_member_id: ns(r.created_by_team_member_id),
    created_by_name:           ns(r.created_by_name),
    created_by_email:          ns(r.created_by_email),
  }
}

// ════════════════════════════════════════════════════════════════════
// Pure access checks (no I/O) — use to authorize a lead you already hold.
// ════════════════════════════════════════════════════════════════════

// Minimal ownable-lead shape. `assigned_to` is not modeled in the schema
// yet; it is checked only if a future table ever provides it, so adding
// assignment later needs no change here.
export interface OwnableLead {
  saved_by_team_member_id?:   string | null
  created_by_team_member_id?: string | null
  assigned_to?:               string | null
}

/** True when `session` may access `lead` (founder: always; agent: only own). */
export function canAccessLead(session: TeamSession, lead: OwnableLead): boolean {
  const scope = leadScopeFor(session.role, session.teamMemberId)
  if (scope.viewAll) return true
  if (!scope.ownTeamMemberId) return false
  return (
    lead.saved_by_team_member_id === scope.ownTeamMemberId ||
    lead.created_by_team_member_id === scope.ownTeamMemberId ||
    lead.assigned_to === scope.ownTeamMemberId
  )
}

/** Throws if `session` may not access `lead`. Use before returning a lead
 *  fetched by a path that can't pre-filter by ownership. */
export function assertCanAccessLead(session: TeamSession, lead: OwnableLead): void {
  if (!canAccessLead(session, lead)) {
    throw new Error('Forbidden: this lead is not accessible to the current user.')
  }
}

// ════════════════════════════════════════════════════════════════════
// Research leads (research_leads, is_saved = true)
// ════════════════════════════════════════════════════════════════════

export interface ScopedResearchLeadFilters {
  status?: string   // research_leads.status
  runId?:  string   // research_run_id
}

// All saved research leads the session may see, de-duplicated by business,
// newest-saved first. Optional filters narrow within the scoped set.
export async function getScopedResearchLeads(
  session: TeamSession,
  filters: ScopedResearchLeadFilters = {},
): Promise<SavedResearchLeadsResult> {
  const scope = leadScopeFor(session.role, session.teamMemberId)
  const empty: SavedResearchLeadsResult = { rows: [], migrationNeeded: false, error: null }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { ...empty, error: 'Server configuration error.' }
  if (!scope.viewAll && !scope.ownTeamMemberId) return empty // deny: no owner identity

  try {
    const db = createServiceRoleClient()
    const runQuery = (cols: string) => {
      let q = db.from('research_leads').select(cols).eq('is_saved', true)
      if (!scope.viewAll) q = q.eq('saved_by_team_member_id', scope.ownTeamMemberId)
      if (filters.status) q = q.eq('status', filters.status)
      if (filters.runId)  q = q.eq('research_run_id', filters.runId)
      return q
        .order('saved_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
    }

    let res = await runQuery(RESEARCH_COLS)
    if (res.error && isMissingColumn(res.error)) {
      if (!scope.viewAll) return { ...empty, error: RESEARCH_OWNERSHIP_HINT } // agent: fail closed
      res = await runQuery(RESEARCH_BASE_COLS)
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
      rows.push(mapSavedResearchLead(raw))
    }
    return { rows, migrationNeeded: false, error: null }
  } catch (err) {
    console.error('[getScopedResearchLeads]', err instanceof Error ? err.message : err)
    return { ...empty, error: 'Could not load saved leads.' }
  }
}

// One saved research lead by id, scoped. Any id the session doesn't own
// behaves as not found (no existence leak, blocks direct-URL access).
export async function getScopedResearchLeadById(
  session: TeamSession,
  leadId: string,
): Promise<SavedResearchLead | null> {
  const scope = leadScopeFor(session.role, session.teamMemberId)
  if (!UUID_RE.test(leadId) || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  if (!scope.viewAll && !scope.ownTeamMemberId) return null // deny

  try {
    const db = createServiceRoleClient()
    const runQuery = (cols: string) => {
      let q = db.from('research_leads').select(cols).eq('id', leadId)
      if (!scope.viewAll) q = q.eq('saved_by_team_member_id', scope.ownTeamMemberId)
      return q.maybeSingle()
    }

    let res = await runQuery(RESEARCH_COLS)
    if (res.error && isMissingColumn(res.error)) {
      if (!scope.viewAll) return null // agent: fail closed without ownership columns
      res = await runQuery(RESEARCH_BASE_COLS)
    }
    const { data, error } = res
    if (error || !data) return null
    return mapSavedResearchLead(data as Record<string, unknown>)
  } catch (err) {
    console.error('[getScopedResearchLeadById]', err instanceof Error ? err.message : err)
    return null
  }
}

// ════════════════════════════════════════════════════════════════════
// Outreach leads (admin_outreach_leads)
// ════════════════════════════════════════════════════════════════════

export interface ScopedOutreachLeadFilters {
  status?:          string   // reply_status
  includeArchived?: boolean  // default false
}

// Active outreach leads the session may see, newest first.
export async function getScopedOutreachLeads(
  session: TeamSession,
  filters: ScopedOutreachLeadFilters = {},
): Promise<AdminOutreachResult> {
  const scope = leadScopeFor(session.role, session.teamMemberId)
  const empty: AdminOutreachResult = { rows: [], migrationNeeded: false, error: null }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { ...empty, error: 'Server configuration error.' }
  if (!scope.viewAll && !scope.ownTeamMemberId) return empty // deny: no owner identity

  try {
    const db = createServiceRoleClient()
    const runQuery = (cols: string) => {
      let q = db.from('admin_outreach_leads').select(cols)
      if (!scope.viewAll) q = q.eq('created_by_team_member_id', scope.ownTeamMemberId)
      if (!filters.includeArchived) q = q.is('archived_at', null).neq('reply_status', 'archived')
      if (filters.status) q = q.eq('reply_status', filters.status)
      return q.order('created_at', { ascending: false })
    }

    let res = await runQuery(OUTREACH_COLS)
    if (res.error && isMissingColumn(res.error)) {
      if (!scope.viewAll) return { ...empty, error: OUTREACH_OWNERSHIP_HINT } // agent: fail closed
      res = await runQuery(OUTREACH_BASE_COLS)
    }
    const { data, error } = res
    if (error) {
      if (isMissingTable(error)) return { rows: [], migrationNeeded: true, error: null }
      throw error
    }
    const rows = ((data ?? []) as Record<string, unknown>[]).map(mapOutreachLead)
    return { rows, migrationNeeded: false, error: null }
  } catch (err) {
    console.error('[getScopedOutreachLeads]', err instanceof Error ? err.message : err)
    return { ...empty, error: 'Could not load outreach leads.' }
  }
}

// One outreach lead by id, scoped. Any id the session doesn't own behaves
// as not found. (Mutations already scope in lib/actions/admin-outreach.ts.)
export async function getScopedOutreachLeadById(
  session: TeamSession,
  leadId: string,
): Promise<AdminOutreachLead | null> {
  const scope = leadScopeFor(session.role, session.teamMemberId)
  if (!UUID_RE.test(leadId) || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  if (!scope.viewAll && !scope.ownTeamMemberId) return null // deny

  try {
    const db = createServiceRoleClient()
    const runQuery = (cols: string) => {
      let q = db.from('admin_outreach_leads').select(cols).eq('id', leadId)
      if (!scope.viewAll) q = q.eq('created_by_team_member_id', scope.ownTeamMemberId)
      return q.maybeSingle()
    }

    let res = await runQuery(OUTREACH_COLS)
    if (res.error && isMissingColumn(res.error)) {
      if (!scope.viewAll) return null // agent: fail closed
      res = await runQuery(OUTREACH_BASE_COLS)
    }
    const { data, error } = res
    if (error || !data) return null
    return mapOutreachLead(data as Record<string, unknown>)
  } catch (err) {
    console.error('[getScopedOutreachLeadById]', err instanceof Error ? err.message : err)
    return null
  }
}

// ════════════════════════════════════════════════════════════════════
// Lead stats — counts the session is allowed to see (for "my leads"
// widgets). Founder: all; agent: own only. Fails closed for agents when
// ownership columns are missing.
// ════════════════════════════════════════════════════════════════════

export interface ScopedLeadStats {
  viewAll:               boolean
  researchSavedLeads:    number
  outreachActiveLeads:   number
  migrationNeeded:       boolean   // an ownership migration is not applied
  error:                 string | null
}

export async function getScopedLeadStats(session: TeamSession): Promise<ScopedLeadStats> {
  const scope = leadScopeFor(session.role, session.teamMemberId)
  const empty: ScopedLeadStats = {
    viewAll: scope.viewAll, researchSavedLeads: 0, outreachActiveLeads: 0,
    migrationNeeded: false, error: null,
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { ...empty, error: 'Server configuration error.' }
  if (!scope.viewAll && !scope.ownTeamMemberId) return empty // deny → zeros

  try {
    const db = createServiceRoleClient()
    const result = { ...empty }

    // Research saved leads (scoped count).
    {
      let q = db.from('research_leads').select('id', { count: 'exact', head: true }).eq('is_saved', true)
      if (!scope.viewAll) q = q.eq('saved_by_team_member_id', scope.ownTeamMemberId)
      const { count, error } = await q
      if (error) {
        if (isMissingColumn(error) && !scope.viewAll) { result.migrationNeeded = true }
        else if (!isMissingTable(error)) throw error
      } else {
        result.researchSavedLeads = count ?? 0
      }
    }

    // Outreach active leads (scoped count).
    {
      let q = db.from('admin_outreach_leads').select('id', { count: 'exact', head: true })
        .is('archived_at', null).neq('reply_status', 'archived')
      if (!scope.viewAll) q = q.eq('created_by_team_member_id', scope.ownTeamMemberId)
      const { count, error } = await q
      if (error) {
        if (isMissingColumn(error) && !scope.viewAll) { result.migrationNeeded = true }
        else if (!isMissingTable(error)) throw error
      } else {
        result.outreachActiveLeads = count ?? 0
      }
    }

    return result
  } catch (err) {
    console.error('[getScopedLeadStats]', err instanceof Error ? err.message : err)
    return { ...empty, error: 'Could not load lead stats.' }
  }
}
