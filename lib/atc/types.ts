// ── Audit-to-Close Engine: shared types + constants ────────────────
// PURE module — no I/O, no 'server-only'. Safe to import from both
// server code and client components (labels, colors, type guards).
// Data access lives in lib/data/atc-leads.ts; generation in lib/atc/engine.ts.

// ── Lead statuses (pipeline order) ─────────────────────────────────

export const ATC_STATUSES = [
  'new', 'researching', 'audited', 'qualified', 'ready_for_outreach',
  'contacted', 'follow_up_needed', 'discovery_booked', 'proposal_sent',
  'closed', 'lost', 'archived',
] as const

export type AtcStatus = (typeof ATC_STATUSES)[number]

export function isAtcStatus(v: unknown): v is AtcStatus {
  return typeof v === 'string' && (ATC_STATUSES as readonly string[]).includes(v)
}

// Label + accent color per status (Mission Control palette).
export const ATC_STATUS_CONFIG: Record<AtcStatus, { label: string; color: string }> = {
  new:                { label: 'New',                color: '#3b9eff' },
  researching:        { label: 'Researching',        color: '#3b9eff' },
  audited:            { label: 'Audited',            color: '#8b7cf6' },
  qualified:          { label: 'Qualified',          color: '#ffae3c' },
  ready_for_outreach: { label: 'Ready for Outreach', color: '#ff7a18' },
  contacted:          { label: 'Contacted',          color: '#ffae3c' },
  follow_up_needed:   { label: 'Follow-Up Needed',   color: '#ffae3c' },
  discovery_booked:   { label: 'Discovery Booked',   color: '#22d093' },
  proposal_sent:      { label: 'Proposal Sent',      color: '#22d093' },
  closed:             { label: 'Closed',             color: '#22d093' },
  lost:               { label: 'Lost',               color: '#6a6a6e' },
  archived:           { label: 'Archived',           color: '#6a6a6e' },
}

// Statuses that count as "inactive" for KPI purposes.
export const ATC_INACTIVE_STATUSES: readonly AtcStatus[] = ['closed', 'lost', 'archived']

// ── Audit categories (10) ──────────────────────────────────────────

export const ATC_AUDIT_CATEGORIES = [
  { key: 'mobile_experience',           label: 'Mobile experience' },
  { key: 'cta_clarity',                 label: 'CTA clarity' },
  { key: 'booking_flow',                label: 'Booking flow' },
  { key: 'contact_visibility',          label: 'Contact visibility' },
  { key: 'whatsapp_visibility',         label: 'WhatsApp visibility' },
  { key: 'service_clarity',             label: 'Service clarity' },
  { key: 'trust_signals',               label: 'Trust signals' },
  { key: 'lead_capture',                label: 'Lead capture' },
  { key: 'follow_up_system',            label: 'Follow-up system' },
  { key: 'ai_automation_opportunity',   label: 'AI automation opportunity' },
] as const

export type AtcAuditCategoryKey = (typeof ATC_AUDIT_CATEGORIES)[number]['key']

// One assessed category inside audit_json.
export interface AtcAuditCategory {
  score:              number | null   // 0–10; null = not assessed
  issue:              string
  why_it_matters:     string
  suggested_fix:      string
  helios_opportunity: string
}

export type AtcAuditJson = Partial<Record<AtcAuditCategoryKey, AtcAuditCategory>>

// Which audit_json categories feed the named score columns.
export const ATC_SCORE_COLUMN_MAP: Record<string, AtcAuditCategoryKey> = {
  mobile_score:       'mobile_experience',
  cta_score:          'cta_clarity',
  booking_score:      'booking_flow',
  whatsapp_score:     'whatsapp_visibility',
  trust_score:        'trust_signals',
  lead_capture_score: 'lead_capture',
  automation_score:   'ai_automation_opportunity',
}

// ── Pain points (9 categories) ─────────────────────────────────────

export const ATC_PAIN_CATEGORIES = [
  { key: 'missed_lead_risk',       label: 'Missed lead risk' },
  { key: 'booking_friction',       label: 'Booking friction' },
  { key: 'slow_response_risk',     label: 'Slow response risk' },
  { key: 'weak_trust_signals',     label: 'Weak trust signals' },
  { key: 'poor_mobile_experience', label: 'Poor mobile experience' },
  { key: 'poor_conversion',        label: 'Poor conversion' },
  { key: 'no_automation',          label: 'No automation' },
  { key: 'weak_follow_up',         label: 'Weak follow-up' },
  { key: 'manual_owner_workload',  label: 'Manual owner workload' },
] as const

export type AtcPainCategoryKey = (typeof ATC_PAIN_CATEGORIES)[number]['key']

export function isPainCategory(v: unknown): v is AtcPainCategoryKey {
  return typeof v === 'string' && ATC_PAIN_CATEGORIES.some((c) => c.key === v)
}

export function painCategoryLabel(key: string): string {
  return ATC_PAIN_CATEGORIES.find((c) => c.key === key)?.label ?? key
}

export const ATC_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const
export type AtcSeverity = (typeof ATC_SEVERITIES)[number]

export function isSeverity(v: unknown): v is AtcSeverity {
  return typeof v === 'string' && (ATC_SEVERITIES as readonly string[]).includes(v)
}

export const SEVERITY_CONFIG: Record<AtcSeverity, { label: string; color: string }> = {
  low:      { label: 'Low',      color: '#3b9eff' },
  medium:   { label: 'Medium',   color: '#ffae3c' },
  high:     { label: 'High',     color: '#ff7a18' },
  critical: { label: 'Critical', color: '#ff8a7a' },
}

// ── Qualification ──────────────────────────────────────────────────

export type AtcFitLevel = 'poor' | 'possible' | 'good' | 'strong'
export type AtcCloseDifficulty = 'easy' | 'medium' | 'hard'
export type AtcPackageId = 'starter' | 'pro' | 'scale'

export const FIT_LEVEL_CONFIG: Record<AtcFitLevel, { label: string; color: string }> = {
  poor:     { label: 'Poor Fit',     color: '#6a6a6e' },
  possible: { label: 'Possible Fit', color: '#3b9eff' },
  good:     { label: 'Good Fit',     color: '#ffae3c' },
  strong:   { label: 'Strong Fit',   color: '#22d093' },
}

export const DIFFICULTY_CONFIG: Record<AtcCloseDifficulty, { label: string; color: string }> = {
  easy:   { label: 'Easy',   color: '#22d093' },
  medium: { label: 'Medium', color: '#ffae3c' },
  hard:   { label: 'Hard',   color: '#ff8a7a' },
}

// Stored in atc_leads.qualification_json.
export interface AtcQualification {
  fit_score:             number
  fit_level:             AtcFitLevel
  recommended_package:   AtcPackageId
  close_difficulty:      AtcCloseDifficulty
  qualification_summary: string
  objections:            string[]
  best_outreach_angle:   string
  // Transparent rule breakdown so the result is explainable, not a black box.
  signals:               Array<{ signal: string; points: number; note: string }>
}

// ── Offer (atc_leads.offer_json) ───────────────────────────────────
// Prices, package name, and deliverables are injected FROM CODE
// (lib/billing/packages.ts) — never written by the AI.

export interface AtcOffer {
  package_id:          AtcPackageId
  package_name:        string
  setup_price_label:   string    // e.g. "$2,500"
  monthly_price_label: string    // e.g. "$499/mo"
  diagnosis:           string    // business-specific, grounded in the audit
  main_pain_points:    string[]
  what_we_build:       string[]
  why_it_matters:      string
  timeline:            string
  deliverables:        string[]  // from PACKAGES[plan].setupIncludes
  monthly_covers:      string[]  // from PACKAGES[plan].monthlyIncludes
  cta:                 string
}

// ── Outreach drafts (atc_leads.outreach_json) ──────────────────────
// DRAFTS ONLY. Nothing in the engine sends anything — human approval
// and manual sending are required (see docs/security-guardrails.md).

export interface AtcOutreachMessages {
  cold_email:       { subject: string; body: string }
  follow_up_email:  { subject: string; body: string }
  instagram_dm:     string
  whatsapp_message: string
  call_script:      string
}

// ── Row shapes (as returned by the scoped data layer) ──────────────

export interface AtcLead {
  id:                         string
  business_name:              string
  industry:                   string | null
  location:                   string | null
  website_url:                string | null
  google_maps_url:            string | null
  phone:                      string | null
  email:                      string | null
  instagram_url:              string | null
  facebook_url:               string | null
  whatsapp_number:            string | null
  opening_hours:              string | null
  rating:                     number | null
  review_count:               number | null
  services:                   string | null
  notes:                      string | null
  source:                     string
  status:                     AtcStatus
  created_by_team_member_id:  string | null
  created_by_name:            string | null
  created_by_email:           string | null
  assigned_to_team_member_id: string | null
  assigned_to_name:           string | null
  fit_score:                  number | null
  fit_level:                  AtcFitLevel | null
  recommended_package:        AtcPackageId | null
  close_difficulty:           AtcCloseDifficulty | null
  qualification_json:         AtcQualification | null
  qualified_at:               string | null
  offer_json:                 AtcOffer | null
  offer_generated_at:         string | null
  outreach_json:              AtcOutreachMessages | null
  outreach_generated_at:      string | null
  created_at:                 string
  updated_at:                 string
  archived_at:                string | null
}

export interface AtcAudit {
  id:                 string
  lead_id:            string
  overall_score:      number | null
  mobile_score:       number | null
  booking_score:      number | null
  cta_score:          number | null
  trust_score:        number | null
  lead_capture_score: number | null
  whatsapp_score:     number | null
  automation_score:   number | null
  audit_summary:      string | null
  audit_json:         AtcAuditJson
  created_by_name:    string | null
  created_at:         string
  updated_at:         string
}

export interface AtcPainPoint {
  id:                   string
  lead_id:              string
  audit_id:             string | null
  category:             AtcPainCategoryKey
  severity:             AtcSeverity
  evidence:             string | null
  business_impact:      string | null
  recommended_solution: string | null
  sales_angle:          string | null
  created_at:           string
}

export interface AtcAgentRun {
  id:              string
  lead_id:         string | null
  agent_name:      string
  status:          'running' | 'completed' | 'failed'
  error_message:   string | null
  created_by_name: string | null
  created_at:      string
  completed_at:    string | null
}

// ── Stable result envelope for all generation actions ──────────────

export interface AtcActionResult<T = unknown> {
  ok:        boolean
  data?:     T
  warnings?: string[]
  errors?:   string[]
  runId?:    string
}

// Exact user-facing error when the AI provider key is not configured.
export const AI_KEY_MISSING_ERROR =
  'AI provider key missing. Add it to environment variables.'
