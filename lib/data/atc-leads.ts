// ════════════════════════════════════════════════════════════════════
// Audit-to-Close leads — scoped data access (extension of the canonical
// scoped lead layer; see lib/data/scoped-leads.ts + docs/security-guardrails.md)
// ════════════════════════════════════════════════════════════════════
//
// SCOPING (leadScopeFor — same contract as research/outreach leads):
//   founder_admin  → sees every atc_lead.
//   outreach_agent → ONLY leads they created OR are assigned to.
//   any other role → denied (empty / not found). Non-UUID member id → denied.
//
// Per-agent isolation is enforced HERE in app code (RLS on atc_* is
// founder-only; the server reads via the service-role client, which
// bypasses RLS). Every atc_leads read must go through this module.
//
// The session MUST come from a server-side guard (requireAdmin etc.) —
// never build a TeamSession from client input.

import 'server-only'

import { leadScopeFor } from '@/lib/auth/permissions'
import { canAccessLead } from '@/lib/data/scoped-leads'
import { createServiceRoleClient } from '@/lib/supabase/server'
import type { TeamSession } from '@/lib/auth/types'
import type {
  AtcLead, AtcAudit, AtcPainPoint, AtcAgentRun, AtcAuditJson,
  AtcQualification, AtcOffer, AtcOutreachMessages,
} from '@/lib/atc/types'
import { isAtcStatus } from '@/lib/atc/types'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const ATC_MIGRATION_HINT =
  'Audit-to-Close tables not found. Apply migration 20260701120000_create_audit_to_close.sql in Supabase, then retry.'

function ns(v: unknown): string | null { return typeof v === 'string' && v.length > 0 ? v : null }
function nnum(v: unknown): number | null { return typeof v === 'number' ? v : null }

export function isMissingTable(e: { code?: string; message?: string } | null): boolean {
  if (!e) return false
  if (e.code === '42P01') return true
  const m = (e.message ?? '').toLowerCase()
  return m.includes('relation') && m.includes('does not exist')
}

// ── Row mapper (single source of truth for the AtcLead shape) ────────
export function mapAtcLead(r: Record<string, unknown>): AtcLead {
  return {
    id:                         String(r.id ?? ''),
    business_name:              typeof r.business_name === 'string' ? r.business_name : '(unnamed)',
    industry:                   ns(r.industry),
    location:                   ns(r.location),
    website_url:                ns(r.website_url),
    google_maps_url:            ns(r.google_maps_url),
    phone:                      ns(r.phone),
    email:                      ns(r.email),
    instagram_url:              ns(r.instagram_url),
    facebook_url:               ns(r.facebook_url),
    whatsapp_number:            ns(r.whatsapp_number),
    opening_hours:              ns(r.opening_hours),
    rating:                     nnum(r.rating),
    review_count:               nnum(r.review_count),
    services:                   ns(r.services),
    notes:                      ns(r.notes),
    source:                     typeof r.source === 'string' ? r.source : 'manual',
    status:                     isAtcStatus(r.status) ? r.status : 'new',
    created_by_team_member_id:  ns(r.created_by_team_member_id),
    created_by_name:            ns(r.created_by_name),
    created_by_email:           ns(r.created_by_email),
    assigned_to_team_member_id: ns(r.assigned_to_team_member_id),
    assigned_to_name:           ns(r.assigned_to_name),
    fit_score:                  nnum(r.fit_score),
    fit_level:                  (ns(r.fit_level) as AtcLead['fit_level']) ?? null,
    recommended_package:        (ns(r.recommended_package) as AtcLead['recommended_package']) ?? null,
    close_difficulty:           (ns(r.close_difficulty) as AtcLead['close_difficulty']) ?? null,
    qualification_json:         (r.qualification_json ?? null) as AtcQualification | null,
    qualified_at:               ns(r.qualified_at),
    offer_json:                 (r.offer_json ?? null) as AtcOffer | null,
    offer_generated_at:         ns(r.offer_generated_at),
    outreach_json:              (r.outreach_json ?? null) as AtcOutreachMessages | null,
    outreach_generated_at:      ns(r.outreach_generated_at),
    created_at:                 typeof r.created_at === 'string' ? r.created_at : new Date(0).toISOString(),
    updated_at:                 typeof r.updated_at === 'string' ? r.updated_at : new Date(0).toISOString(),
    archived_at:                ns(r.archived_at),
  }
}

function mapAudit(r: Record<string, unknown>): AtcAudit {
  return {
    id:                 String(r.id ?? ''),
    lead_id:            String(r.lead_id ?? ''),
    overall_score:      nnum(r.overall_score),
    mobile_score:       nnum(r.mobile_score),
    booking_score:      nnum(r.booking_score),
    cta_score:          nnum(r.cta_score),
    trust_score:        nnum(r.trust_score),
    lead_capture_score: nnum(r.lead_capture_score),
    whatsapp_score:     nnum(r.whatsapp_score),
    automation_score:   nnum(r.automation_score),
    audit_summary:      ns(r.audit_summary),
    audit_json:         (r.audit_json && typeof r.audit_json === 'object' ? r.audit_json : {}) as AtcAuditJson,
    created_by_name:    ns(r.created_by_name),
    created_at:         typeof r.created_at === 'string' ? r.created_at : new Date(0).toISOString(),
    updated_at:         typeof r.updated_at === 'string' ? r.updated_at : new Date(0).toISOString(),
  }
}

function mapPainPoint(r: Record<string, unknown>): AtcPainPoint {
  return {
    id:                   String(r.id ?? ''),
    lead_id:              String(r.lead_id ?? ''),
    audit_id:             ns(r.audit_id),
    category:             (typeof r.category === 'string' ? r.category : 'missed_lead_risk') as AtcPainPoint['category'],
    severity:             (typeof r.severity === 'string' ? r.severity : 'medium') as AtcPainPoint['severity'],
    evidence:             ns(r.evidence),
    business_impact:      ns(r.business_impact),
    recommended_solution: ns(r.recommended_solution),
    sales_angle:          ns(r.sales_angle),
    created_at:           typeof r.created_at === 'string' ? r.created_at : new Date(0).toISOString(),
  }
}

function mapRun(r: Record<string, unknown>): AtcAgentRun {
  return {
    id:              String(r.id ?? ''),
    lead_id:         ns(r.lead_id),
    agent_name:      typeof r.agent_name === 'string' ? r.agent_name : 'unknown',
    status:          (typeof r.status === 'string' ? r.status : 'failed') as AtcAgentRun['status'],
    error_message:   ns(r.error_message),
    created_by_name: ns(r.created_by_name),
    created_at:      typeof r.created_at === 'string' ? r.created_at : new Date(0).toISOString(),
    completed_at:    ns(r.completed_at),
  }
}

// ── Ownership predicate (list queries) ───────────────────────────────
// An agent owns a lead when they created it OR it is assigned to them.
function applyScope<T extends { or: (f: string) => T }>(q: T, ownId: string): T {
  return q.or(`created_by_team_member_id.eq.${ownId},assigned_to_team_member_id.eq.${ownId}`)
}

// ── Authorized reads (the shared permission helpers) ─────────────────

export interface AtcLeadsResult {
  rows:            AtcLead[]
  migrationNeeded: boolean
  error:           string | null
}

export interface AtcLeadFilters {
  status?:          string
  includeArchived?: boolean  // default false
}

/** All ATC leads the session may see (founder: all; agent: created/assigned). */
export async function listAuthorizedLeads(
  session: TeamSession,
  filters: AtcLeadFilters = {},
): Promise<AtcLeadsResult> {
  const scope = leadScopeFor(session.role, session.teamMemberId)
  const empty: AtcLeadsResult = { rows: [], migrationNeeded: false, error: null }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { ...empty, error: 'Server configuration error.' }
  if (!scope.viewAll && !scope.ownTeamMemberId) return empty // deny: no owner identity

  try {
    const db = createServiceRoleClient()
    let q = db.from('atc_leads').select('*')
    if (!scope.viewAll) q = applyScope(q, scope.ownTeamMemberId!)
    if (!filters.includeArchived) q = q.is('archived_at', null).neq('status', 'archived')
    if (filters.status && isAtcStatus(filters.status)) q = q.eq('status', filters.status)
    const { data, error } = await q.order('created_at', { ascending: false })
    if (error) {
      if (isMissingTable(error)) return { rows: [], migrationNeeded: true, error: null }
      throw error
    }
    return { rows: ((data ?? []) as Record<string, unknown>[]).map(mapAtcLead), migrationNeeded: false, error: null }
  } catch (err) {
    console.error('[listAuthorizedLeads]', err instanceof Error ? err.message : err)
    return { ...empty, error: 'Could not load leads.' }
  }
}

/** One ATC lead by id, scoped. Ids the session doesn't own behave as not
 *  found (no existence leak; blocks direct-URL access to another agent's lead). */
export async function getAuthorizedLeadById(
  session: TeamSession,
  leadId: string,
): Promise<AtcLead | null> {
  const scope = leadScopeFor(session.role, session.teamMemberId)
  if (!UUID_RE.test(leadId) || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  if (!scope.viewAll && !scope.ownTeamMemberId) return null // deny

  try {
    const db = createServiceRoleClient()
    let q = db.from('atc_leads').select('*').eq('id', leadId)
    if (!scope.viewAll) q = applyScope(q, scope.ownTeamMemberId!)
    const { data, error } = await q.maybeSingle()
    if (error || !data) return null
    return mapAtcLead(data as Record<string, unknown>)
  } catch (err) {
    console.error('[getAuthorizedLeadById]', err instanceof Error ? err.message : err)
    return null
  }
}

/** Pure check: may this session mutate this lead? Founder: always; agent:
 *  only leads they created or are assigned to. Delegates to the shared
 *  canAccessLead so read and write authorization can never drift apart. */
export function canMutateLead(session: TeamSession, lead: AtcLead): boolean {
  return canAccessLead(session, {
    created_by_team_member_id: lead.created_by_team_member_id,
    assigned_to:               lead.assigned_to_team_member_id,
  })
}

// ── Lead detail bundle (lead + audit + pain points + run log) ────────

export interface AtcLeadDetail {
  lead:       AtcLead
  audit:      AtcAudit | null
  painPoints: AtcPainPoint[]
  runs:       AtcAgentRun[]
}

/** Full detail for one authorized lead. Children are only fetched AFTER
 *  the scoped lead read succeeds, so they inherit its authorization. */
export async function getAtcLeadDetail(
  session: TeamSession,
  leadId: string,
): Promise<AtcLeadDetail | null> {
  const lead = await getAuthorizedLeadById(session, leadId)
  if (!lead) return null

  const db = createServiceRoleClient()
  const [auditRes, painsRes, runsRes] = await Promise.all([
    db.from('atc_audits').select('*').eq('lead_id', lead.id).maybeSingle(),
    db.from('atc_pain_points').select('*').eq('lead_id', lead.id).order('created_at', { ascending: false }),
    db.from('atc_agent_runs').select('*').eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(50),
  ])

  return {
    lead,
    audit:      auditRes.data ? mapAudit(auditRes.data as Record<string, unknown>) : null,
    painPoints: ((painsRes.data ?? []) as Record<string, unknown>[]).map(mapPainPoint),
    runs:       ((runsRes.data ?? []) as Record<string, unknown>[]).map(mapRun),
  }
}
