// ── Pass 30: Mock data for /admin/mission-control scaffolding ────
//
// Used only when no live data source is wired. These shapes are intended
// to migrate to real Supabase queries later — they DO NOT reflect any
// production data and are safe to render.
//
// SECURITY: no secrets, no PII beyond fake demo names. Safe to import
// from both server and client components.

// ── Mission Control overview (founder KPIs) ──────────────────────

export interface AdminKpi {
  key:    string
  label:  string
  value:  string
  delta?: string
  tone:   'neutral' | 'success' | 'warning' | 'danger'
  hint?:  string
}

export const MOCK_ADMIN_KPIS: AdminKpi[] = [
  { key: 'audits_today',   label: 'New audits today',    value: '3',     delta: '+2 vs yesterday', tone: 'success' },
  { key: 'new_leads',      label: 'New leads (7d)',       value: '24',    delta: '+8 vs prior 7d',  tone: 'success' },
  { key: 'active_clients', label: 'Active clients',       value: '14',    delta: '+1 this week',    tone: 'neutral' },
  { key: 'follow_ups',     label: 'Pending follow-ups',   value: '11',    delta: '5 overdue',       tone: 'warning' },
  { key: 'agent_runs',     label: 'Agent runs (24h)',     value: '37',    delta: '2 failed',        tone: 'warning' },
  { key: 'booked_calls',   label: 'Booked calls (7d)',    value: '9',     delta: '+3 vs prior 7d',  tone: 'success' },
  { key: 'open_delivery',  label: 'Open delivery tasks',  value: '18',    delta: '3 due this week', tone: 'neutral' },
  { key: 'setup_revenue',  label: 'Setup revenue (mtd)',  value: '$11.4k',delta: '+$3.5k vs prior', tone: 'success' },
  { key: 'estimated_mrr',  label: 'Estimated MRR',        value: '$7.9k', delta: '+$0.6k vs prior', tone: 'success' },
  { key: 'alerts',         label: 'Alerts needing attention', value: '4', delta: '1 critical',      tone: 'danger'  },
]

// ── Content pipeline (briefs, drafts, scheduled, published) ──────

export type ContentStage = 'brief' | 'draft' | 'review' | 'scheduled' | 'published'

export interface AdminContentItem {
  id:        string
  title:     string
  channel:   'blog' | 'newsletter' | 'case_study' | 'guide'
  stage:     ContentStage
  owner:     string
  due_date:  string | null
}

export const MOCK_ADMIN_CONTENT: AdminContentItem[] = [
  { id: 'c1', title: 'Why local barbershops miss 30% of bookings',  channel: 'blog',       stage: 'draft',     owner: 'Founder',    due_date: '2026-05-22' },
  { id: 'c2', title: 'Helios for spas — full launch checklist',     channel: 'guide',      stage: 'review',    owner: 'Analyst',    due_date: '2026-05-20' },
  { id: 'c3', title: 'Case study: Sunrise Beauty Spa',              channel: 'case_study', stage: 'scheduled', owner: 'Founder',    due_date: '2026-05-25' },
  { id: 'c4', title: 'May newsletter — booking automation tips',    channel: 'newsletter', stage: 'brief',     owner: 'Founder',    due_date: '2026-05-28' },
  { id: 'c5', title: 'AI replies that actually book customers',     channel: 'blog',       stage: 'published', owner: 'Founder',    due_date: null         },
]

// ── Social schedule (founder presence across channels) ───────────

export interface AdminSocialPost {
  id:          string
  channel:     'twitter' | 'linkedin' | 'instagram' | 'tiktok' | 'youtube'
  caption:     string
  status:      'draft' | 'scheduled' | 'posted'
  scheduled_at: string | null
}

export const MOCK_ADMIN_SOCIAL: AdminSocialPost[] = [
  { id: 's1', channel: 'linkedin',  caption: 'How we cut booking lag from 45 min to 30 sec for Reef Dental.',   status: 'scheduled', scheduled_at: '2026-05-19T14:00:00Z' },
  { id: 's2', channel: 'instagram', caption: 'Helios installs AI booking for local businesses. Here is a peek.', status: 'draft',     scheduled_at: null                  },
  { id: 's3', channel: 'twitter',   caption: '24/7 replies. 1 dashboard. 0 missed customers.',                   status: 'posted',    scheduled_at: '2026-05-15T18:30:00Z' },
  { id: 's4', channel: 'tiktok',    caption: 'Before/after of a Helios install in a Kingston salon.',            status: 'scheduled', scheduled_at: '2026-05-21T16:00:00Z' },
]

// ── Notifications (admin-facing) ─────────────────────────────────

export type AdminNotificationLevel = 'info' | 'warning' | 'critical'

export interface AdminNotification {
  id:        string
  level:     AdminNotificationLevel
  source:    string
  message:   string
  created_at: string
  acknowledged: boolean
}

export const MOCK_ADMIN_NOTIFICATIONS: AdminNotification[] = [
  { id: 'n1', level: 'critical', source: 'audits',     message: 'Audit for Atlas Auto Repairs has been pending review for 3 days.', created_at: '2026-05-15T10:00:00Z', acknowledged: false },
  { id: 'n2', level: 'warning',  source: 'delivery',   message: 'Reef Dental Care launch date at risk — QA blocker pending.',       created_at: '2026-05-17T09:30:00Z', acknowledged: false },
  { id: 'n3', level: 'info',     source: 'leads',      message: '2 inbound leads from /audit funnel today.',                        created_at: '2026-05-17T08:00:00Z', acknowledged: false },
  { id: 'n4', level: 'warning',  source: 'relevance',  message: '2 Relevance AI runs failed in the last 24h.',                      created_at: '2026-05-17T07:15:00Z', acknowledged: false },
]

// ── Revenue snapshot ─────────────────────────────────────────────

export interface AdminRevenueMonth {
  month:        string
  setup_usd:    number
  monthly_usd:  number
  active_subs:  number
}

export const MOCK_ADMIN_REVENUE: AdminRevenueMonth[] = [
  { month: '2026-02', setup_usd:  4500, monthly_usd: 4200, active_subs:  8 },
  { month: '2026-03', setup_usd:  7000, monthly_usd: 5400, active_subs: 10 },
  { month: '2026-04', setup_usd:  8500, monthly_usd: 6900, active_subs: 12 },
  { month: '2026-05', setup_usd: 11400, monthly_usd: 7900, active_subs: 14 },
]

// ── Bookings preview (sales/strategy calls) ──────────────────────

export interface AdminCallBooking {
  id:        string
  contact:   string
  business:  string
  channel:   'cal.com' | 'manual'
  scheduled_at: string
  status:    'upcoming' | 'completed' | 'no_show'
}

export const MOCK_ADMIN_CALLS: AdminCallBooking[] = [
  { id: 'b1', contact: 'Jermaine D.',  business: 'Atlas Auto Repairs',  channel: 'cal.com', scheduled_at: '2026-05-19T15:00:00Z', status: 'upcoming'  },
  { id: 'b2', contact: 'Imani P.',     business: 'Crown Hair Studio',   channel: 'cal.com', scheduled_at: '2026-05-20T14:30:00Z', status: 'upcoming'  },
  { id: 'b3', contact: 'Dr. Wallace',  business: 'Reef Dental Care',    channel: 'manual',  scheduled_at: '2026-05-15T10:00:00Z', status: 'completed' },
]
