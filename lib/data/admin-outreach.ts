// ── Founder-only reads: outreach CRM (admin_outreach_leads) ────────
//
// SECURITY: requireAdmin() gates every call; service-role client used.
// RESILIENCE: missing table → empty + migrationNeeded, never crashes.

import 'server-only'

import { requireAdmin } from '@/lib/auth/require-admin'
import { createServiceRoleClient } from '@/lib/supabase/server'
import {
  TODAYS_OUTREACH_TARGET, REPLIED_STATUSES, INACTIVE_STATUSES,
  type OutreachReplyStatus, type OutreachContactMethod,
} from '@/lib/admin/outreach'

export interface AdminOutreachLead {
  id:                 string
  business_name:      string
  niche:              string
  location:           string | null
  instagram_url:      string | null
  website_url:        string | null
  phone:              string | null
  email:              string | null
  contact_method:     OutreachContactMethod
  score:              number
  pain_found:         string | null
  outreach_angle:     string | null
  first_message_sent: boolean
  reply_status:       OutreachReplyStatus
  next_action:        string | null
  follow_up_date:     string | null   // YYYY-MM-DD
  last_contacted_at:  string | null   // ISO
  notes:              string | null
  created_at:         string
}

export interface AdminOutreachResult {
  rows:            AdminOutreachLead[]
  migrationNeeded: boolean
  error:           string | null
}

export interface OutreachSummary {
  todaysTarget:   number
  contactedToday: number
  newReplies:     number
  followUpsDue:   number
  hotLeads:       number
  callsBooked:    number
  migrationNeeded: boolean
}

export interface OutreachDailyReview {
  review_date:          string
  businesses_contacted: string | null
  replies:              string | null
  best_niche:           string | null
  best_outreach_angle:  string | null
  hottest_lead:         string | null
  follow_ups_due:       string | null
  improve_tomorrow:     string | null
  checklist:            Record<string, boolean>
}

function isMissingTable(e: { code?: string; message?: string } | null): boolean {
  if (!e) return false
  if (e.code === '42P01') return true
  const m = (e.message ?? '').toLowerCase()
  return m.includes('relation') && m.includes('does not exist')
}

const COLS =
  'id, business_name, niche, location, instagram_url, website_url, phone, email, contact_method, ' +
  'score, pain_found, outreach_angle, first_message_sent, reply_status, next_action, follow_up_date, ' +
  'last_contacted_at, notes, created_at'

function s(v: unknown): string | null { return typeof v === 'string' && v.length > 0 ? v : null }

function toLead(r: Record<string, unknown>): AdminOutreachLead {
  return {
    id:                 String(r.id ?? ''),
    business_name:      typeof r.business_name === 'string' ? r.business_name : '(unnamed)',
    niche:              typeof r.niche === 'string' ? r.niche : '—',
    location:           s(r.location),
    instagram_url:      s(r.instagram_url),
    website_url:        s(r.website_url),
    phone:              s(r.phone),
    email:              s(r.email),
    contact_method:     (typeof r.contact_method === 'string' ? r.contact_method : 'instagram') as OutreachContactMethod,
    score:              typeof r.score === 'number' ? r.score : 0,
    pain_found:         s(r.pain_found),
    outreach_angle:     s(r.outreach_angle),
    first_message_sent: r.first_message_sent === true,
    reply_status:       (typeof r.reply_status === 'string' ? r.reply_status : 'new') as OutreachReplyStatus,
    next_action:        s(r.next_action),
    follow_up_date:     s(r.follow_up_date),
    last_contacted_at:  s(r.last_contacted_at),
    notes:              s(r.notes),
    created_at:         typeof r.created_at === 'string' ? r.created_at : new Date(0).toISOString(),
  }
}

// Active outreach leads (not archived). Newest first.
export async function getAdminOutreachLeads(): Promise<AdminOutreachResult> {
  await requireAdmin({ path: '/admin/outreach' })
  const empty: AdminOutreachResult = { rows: [], migrationNeeded: false, error: null }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ...empty, error: 'Server configuration error.' }
  }

  try {
    const db = createServiceRoleClient()
    const { data, error } = await db
      .from('admin_outreach_leads')
      .select(COLS)
      .is('archived_at', null)
      .neq('reply_status', 'archived')
      .order('created_at', { ascending: false })

    if (error) {
      if (isMissingTable(error)) return { rows: [], migrationNeeded: true, error: null }
      throw error
    }
    const rows = ((data ?? []) as Record<string, unknown>[]).map((r) => toLead(r))
    return { rows, migrationNeeded: false, error: null }
  } catch (err) {
    console.error('[getAdminOutreachLeads]', err instanceof Error ? err.message : err)
    return { ...empty, error: 'Could not load outreach leads.' }
  }
}

// Lightweight rollup for KPI cards + Mission Control. Computed from a
// minimal column read; resilient to the missing table.
export async function getOutreachSummary(): Promise<OutreachSummary> {
  await requireAdmin({ path: '/admin/mission-control' })
  const empty: OutreachSummary = {
    todaysTarget: TODAYS_OUTREACH_TARGET, contactedToday: 0, newReplies: 0,
    followUpsDue: 0, hotLeads: 0, callsBooked: 0, migrationNeeded: false,
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return empty

  try {
    const db = createServiceRoleClient()
    const { data, error } = await db
      .from('admin_outreach_leads')
      .select('reply_status, score, follow_up_date, last_contacted_at')
      .is('archived_at', null)
      .neq('reply_status', 'archived')

    if (error) {
      if (isMissingTable(error)) return { ...empty, migrationNeeded: true }
      throw error
    }

    const today = new Date().toISOString().slice(0, 10)
    let contactedToday = 0, newReplies = 0, followUpsDue = 0, hotLeads = 0, callsBooked = 0

    for (const raw of (data ?? []) as Record<string, unknown>[]) {
      const status = typeof raw.reply_status === 'string' ? raw.reply_status : 'new'
      const score  = typeof raw.score === 'number' ? raw.score : 0
      const fu     = typeof raw.follow_up_date === 'string' ? raw.follow_up_date.slice(0, 10) : null
      const lc     = typeof raw.last_contacted_at === 'string' ? raw.last_contacted_at.slice(0, 10) : null

      if (lc === today) contactedToday++
      if (status === 'replied') newReplies++
      if (status === 'call_booked') callsBooked++
      if (fu && fu <= today && !INACTIVE_STATUSES.includes(status as OutreachReplyStatus)) followUpsDue++
      if (score >= 8 && !INACTIVE_STATUSES.includes(status as OutreachReplyStatus)) hotLeads++
    }

    return { todaysTarget: TODAYS_OUTREACH_TARGET, contactedToday, newReplies, followUpsDue, hotLeads, callsBooked, migrationNeeded: false }
  } catch (err) {
    console.error('[getOutreachSummary]', err instanceof Error ? err.message : err)
    return empty
  }
}

// Today's (or a given date's) end-of-day review, if persisted.
export async function getOutreachDailyReview(date?: string): Promise<OutreachDailyReview | null> {
  await requireAdmin({ path: '/admin/outreach' })
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  const day = date ?? new Date().toISOString().slice(0, 10)

  try {
    const db = createServiceRoleClient()
    const { data, error } = await db
      .from('admin_outreach_daily_reviews')
      .select('review_date, businesses_contacted, replies, best_niche, best_outreach_angle, hottest_lead, follow_ups_due, improve_tomorrow, checklist')
      .eq('review_date', day)
      .maybeSingle()

    if (error) {
      if (isMissingTable(error)) return null
      throw error
    }
    if (!data) return null
    const r = data as Record<string, unknown>
    const checklist: Record<string, boolean> = {}
    if (r.checklist && typeof r.checklist === 'object') {
      for (const [k, v] of Object.entries(r.checklist as Record<string, unknown>)) checklist[k] = v === true
    }
    return {
      review_date:          String(r.review_date ?? day),
      businesses_contacted: s(r.businesses_contacted),
      replies:              s(r.replies),
      best_niche:           s(r.best_niche),
      best_outreach_angle:  s(r.best_outreach_angle),
      hottest_lead:         s(r.hottest_lead),
      follow_ups_due:       s(r.follow_ups_due),
      improve_tomorrow:     s(r.improve_tomorrow),
      checklist,
    }
  } catch (err) {
    console.error('[getOutreachDailyReview]', err instanceof Error ? err.message : err)
    return null
  }
}
