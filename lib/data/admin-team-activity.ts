// ── Founder-only reads: outreach team activity rollup ──────────────
//
// SECURITY: requireFounderAdmin() gates every call — outreach agents are
// redirected before any query runs. This panel aggregates ACROSS agents,
// which is exactly why it must never be reachable by an agent; per-agent
// lead visibility (leadScopeFor) stays untouched for every other surface.
// DATA: real rows only (research_leads / admin_outreach_leads /
// research_runs), attributed via the ownership columns from migrations
// 20260608120000 + 20260609120000.
// RESILIENCE: a missing table/column degrades to zeros + a hint — the
// panel renders, it never crashes the Team page.

import 'server-only'

import { requireFounderAdmin } from '@/lib/auth/require-admin'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { INACTIVE_STATUSES, type OutreachReplyStatus } from '@/lib/admin/outreach'

export type ActivityRange = 'today' | 'week' | 'month' | 'all'

export const ACTIVITY_RANGES: { value: ActivityRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week',  label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'all',   label: 'All Time' },
]

export function parseActivityRange(raw: string | undefined): ActivityRange {
  return raw === 'today' || raw === 'week' || raw === 'month' || raw === 'all' ? raw : 'all'
}

export interface AgentActivityRow {
  teamMemberId:     string
  name:             string | null
  email:            string
  status:           string
  savedToday:       number
  savedInRange:     number
  totalSaved:       number
  contactedInRange: number   // outreach leads with last_contacted_at in range
  followUpsDue:     number   // due today or overdue, active statuses only
  lastActivity:     string | null  // ISO — latest save / outreach add / contact / run
}

export interface TeamActivityResult {
  rows:  AgentActivityRow[]
  error: string | null
}

// UTC-day boundaries, matching the `toISOString().slice(0, 10)` convention
// used across the outreach/research modules.
function startOfTodayIso(): string {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}
function rangeStartIso(range: ActivityRange): string | null {
  if (range === 'today') return startOfTodayIso()
  if (range === 'week')  return new Date(Date.now() - 7  * 86400000).toISOString()
  if (range === 'month') return new Date(Date.now() - 30 * 86400000).toISOString()
  return null // all time
}

function isMissingRelation(e: { code?: string; message?: string } | null): boolean {
  if (!e) return false
  if (e.code === '42P01' || e.code === '42703') return true
  const m = (e.message ?? '').toLowerCase()
  return m.includes('does not exist')
}

function maxIso(a: string | null, b: string | null | undefined): string | null {
  if (!b) return a
  if (!a) return b
  return b > a ? b : a
}

// Outreach-team activity, one row per outreach_agent. Range scopes the
// "saved" and "contacted" counts; savedToday / totalSaved / followUpsDue /
// lastActivity are fixed windows so the founder always sees the same anchors.
export async function getTeamActivity(range: ActivityRange): Promise<TeamActivityResult> {
  await requireFounderAdmin({ path: '/admin/team' })
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { rows: [], error: 'Server configuration error.' }
  }

  try {
    const db = createServiceRoleClient()

    const { data: agents, error: tmErr } = await db
      .from('team_members')
      .select('id, email, full_name, status')
      .eq('role', 'outreach_agent')
      .order('created_at', { ascending: true })
    if (tmErr) throw tmErr

    const agentRows = (agents ?? []) as { id: string; email: string; full_name: string | null; status: string }[]
    if (agentRows.length === 0) return { rows: [], error: null }
    const ids = agentRows.map((a) => a.id)

    const byId = new Map<string, AgentActivityRow>()
    for (const a of agentRows) {
      byId.set(a.id, {
        teamMemberId: a.id, name: a.full_name, email: a.email, status: a.status,
        savedToday: 0, savedInRange: 0, totalSaved: 0,
        contactedInRange: 0, followUpsDue: 0, lastActivity: null,
      })
    }

    const todayStart = startOfTodayIso()
    const todayDate  = todayStart.slice(0, 10)
    const rangeStart = rangeStartIso(range)
    let hint: string | null = null

    // ── Saved research leads (attribution: saved_by_team_member_id) ──
    const leads = await db
      .from('research_leads')
      .select('saved_by_team_member_id, saved_at')
      .eq('is_saved', true)
      .in('saved_by_team_member_id', ids)
    if (leads.error) {
      if (!isMissingRelation(leads.error)) throw leads.error
      hint = 'Research lead attribution unavailable — apply migration 20260608120000.'
    } else {
      for (const r of (leads.data ?? []) as { saved_by_team_member_id: string; saved_at: string | null }[]) {
        const row = byId.get(r.saved_by_team_member_id)
        if (!row) continue
        row.totalSaved++
        if (r.saved_at && r.saved_at >= todayStart) row.savedToday++
        if (r.saved_at && (!rangeStart || r.saved_at >= rangeStart)) row.savedInRange++
        row.lastActivity = maxIso(row.lastActivity, r.saved_at)
      }
    }

    // ── Outreach leads (attribution: created_by_team_member_id) ──────
    // "Contacted" uses last_contacted_at (set by Mark Contacted), so range
    // counts reflect the most recent touch per lead.
    const outreach = await db
      .from('admin_outreach_leads')
      .select('created_by_team_member_id, created_at, last_contacted_at, follow_up_date, reply_status, archived_at')
      .in('created_by_team_member_id', ids)
    if (outreach.error) {
      if (!isMissingRelation(outreach.error)) throw outreach.error
      hint = hint ?? 'Outreach attribution unavailable — apply migration 20260608120000.'
    } else {
      for (const r of (outreach.data ?? []) as {
        created_by_team_member_id: string; created_at: string | null
        last_contacted_at: string | null; follow_up_date: string | null
        reply_status: string | null; archived_at: string | null
      }[]) {
        const row = byId.get(r.created_by_team_member_id)
        if (!row) continue
        const lc = r.last_contacted_at
        if (lc && (!rangeStart || lc >= rangeStart)) row.contactedInRange++
        const inactive = INACTIVE_STATUSES.includes((r.reply_status ?? 'new') as OutreachReplyStatus)
        if (r.follow_up_date && r.follow_up_date.slice(0, 10) <= todayDate && !inactive && !r.archived_at) {
          row.followUpsDue++
        }
        row.lastActivity = maxIso(row.lastActivity, r.created_at)
        row.lastActivity = maxIso(row.lastActivity, lc)
      }
    }

    // ── Research runs (attribution: created_by_team_member_id) ───────
    const runs = await db
      .from('research_runs')
      .select('created_by_team_member_id, created_at')
      .in('created_by_team_member_id', ids)
    if (runs.error) {
      if (!isMissingRelation(runs.error)) throw runs.error
      hint = hint ?? 'Run attribution unavailable — apply migration 20260609120000.'
    } else {
      for (const r of (runs.data ?? []) as { created_by_team_member_id: string; created_at: string | null }[]) {
        const row = byId.get(r.created_by_team_member_id)
        if (row) row.lastActivity = maxIso(row.lastActivity, r.created_at)
      }
    }

    return { rows: agentRows.map((a) => byId.get(a.id)!), error: hint }
  } catch (err) {
    console.error('[getTeamActivity]', err instanceof Error ? err.message : err)
    return { rows: [], error: 'Could not load team activity.' }
  }
}
