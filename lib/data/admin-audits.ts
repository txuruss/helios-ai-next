// ── Pass 34: Founder-only admin audit intake helpers ─────────────
//
// Reads from `public.audit_submissions` (Pass 34 migration) — the
// intake queue for public audit / business-registration submissions.
// This is distinct from `business_audits` (Phase 26), which holds the
// internal audit results generated for existing client businesses.
//
// SECURITY
// • Every public helper calls requireAdmin() before reading data.
//   Identity is derived from Supabase server-side; we reject anyone
//   who is not an active founder_admin in team_members.
// • Queries run through the service-role client so the audit-submissions
//   RLS (founder_admin SELECT only) is satisfied even when called from
//   environments where the founder row hasn't been seeded yet.
//   The service-role key never leaves the server.
// • Only whitelisted, normalized fields are surfaced to the UI.
//
// FALLBACK
// If the `audit_submissions` table is missing or the query errors,
// every helper resolves to empty/zero data plus an explanatory error
// string — the admin pages stay rendered instead of 500-ing.

import 'server-only'

import { requireAdmin } from '@/lib/auth/require-admin'
import { createServiceRoleClient } from '@/lib/supabase/server'

// ── Public types (UI-safe) ────────────────────────────────────────

export interface AdminAuditMetrics {
  total:        number
  newToday:     number
  pending:      number  // new + in_review
  inReview:     number  // status = 'in_review'
  completed:    number  // converted
  failed:       number  // archived
  highPriority: number  // priority in ('high', 'urgent') AND not archived/converted
  error:        string | null
}

export type AdminAuditStatus =
  | 'new'
  | 'in_review'
  | 'qualified'
  | 'contacted'
  | 'converted'
  | 'archived'
  | 'unknown'

export type AdminAuditPriority = 'low' | 'normal' | 'high' | 'urgent' | 'unknown'

export interface AdminAuditRow {
  id:                   string
  business_name:        string
  business_type:        string | null   // mapped from industry || business_type
  city:                 string | null
  country:              string | null
  location:             string | null
  website_url:          string | null
  recommended_plan:     string | null   // selected_plan
  source:               string
  status:               AdminAuditStatus
  priority:             AdminAuditPriority
  qualification_score:  number | null
  contact_name:         string | null
  email:                string | null
  created_at:           string
}

export interface AdminAuditTableResult {
  rows:  AdminAuditRow[]
  total: number
  error: string | null
}

// ── Internal helpers ──────────────────────────────────────────────

function startOfTodayIso(): string {
  const n = new Date()
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())).toISOString()
}

function normalizeStatus(raw: unknown): AdminAuditStatus {
  if (
    raw === 'new'        ||
    raw === 'in_review'  ||
    raw === 'qualified'  ||
    raw === 'contacted'  ||
    raw === 'converted'  ||
    raw === 'archived'
  ) return raw
  return 'unknown'
}

function normalizePriority(raw: unknown): AdminAuditPriority {
  if (raw === 'low' || raw === 'normal' || raw === 'high' || raw === 'urgent') return raw
  return 'unknown'
}

function toAdminAuditRow(raw: Record<string, unknown>): AdminAuditRow {
  // Prefer `industry` since the public form populates that; fall back to
  // `business_type` if a triage step set it instead.
  const businessType =
    (typeof raw.industry === 'string' && raw.industry) ||
    (typeof raw.business_type === 'string' && raw.business_type) ||
    null

  return {
    id:                  String(raw.id ?? ''),
    business_name:       typeof raw.business_name === 'string' ? raw.business_name : '(unknown business)',
    business_type:       businessType,
    city:                typeof raw.city     === 'string' ? raw.city     : null,
    country:             typeof raw.country  === 'string' ? raw.country  : null,
    location:            typeof raw.location === 'string' ? raw.location : null,
    website_url:         typeof raw.website  === 'string' ? raw.website  : null,
    recommended_plan:    typeof raw.selected_plan === 'string' ? raw.selected_plan : null,
    source:              typeof raw.source        === 'string' ? raw.source        : 'website',
    status:              normalizeStatus(raw.status),
    priority:            normalizePriority(raw.priority),
    qualification_score: typeof raw.qualification_score === 'number' ? raw.qualification_score : null,
    contact_name:        typeof raw.contact_name === 'string' ? raw.contact_name : null,
    email:               typeof raw.email        === 'string' ? raw.email        : null,
    created_at:          typeof raw.created_at   === 'string' ? raw.created_at   : new Date(0).toISOString(),
  }
}

const SELECT_COLS =
  'id, business_name, industry, business_type, city, country, location, website, ' +
  'selected_plan, source, status, priority, qualification_score, contact_name, email, created_at'

// ── getAdminAuditMetrics ──────────────────────────────────────────

export async function getAdminAuditMetrics(): Promise<AdminAuditMetrics> {
  await requireAdmin()

  const empty: AdminAuditMetrics = {
    total: 0, newToday: 0, pending: 0, inReview: 0,
    completed: 0, failed: 0, highPriority: 0, error: null,
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ...empty, error: 'Service role key not configured.' }
  }

  try {
    const db = createServiceRoleClient()
    const todayIso = startOfTodayIso()

    // head:true count-only queries — minimal data transfer.
    const [total, newToday, pending, inReview, completed, failed, highPriority] = await Promise.all([
      db.from('audit_submissions').select('id', { count: 'exact', head: true }).neq('status', 'archived'),
      db.from('audit_submissions').select('id', { count: 'exact', head: true }).gte('created_at', todayIso).neq('status', 'archived'),
      db.from('audit_submissions').select('id', { count: 'exact', head: true }).in('status', ['new', 'in_review']),
      db.from('audit_submissions').select('id', { count: 'exact', head: true }).eq('status', 'in_review'),
      db.from('audit_submissions').select('id', { count: 'exact', head: true }).eq('status', 'converted'),
      db.from('audit_submissions').select('id', { count: 'exact', head: true }).eq('status', 'archived'),
      db.from('audit_submissions').select('id', { count: 'exact', head: true })
        .in('priority', ['high', 'urgent'])
        .not('status', 'in', '(archived,converted)'),
    ])

    return {
      total:        total.count        ?? 0,
      newToday:     newToday.count     ?? 0,
      pending:      pending.count      ?? 0,
      inReview:     inReview.count     ?? 0,
      completed:    completed.count    ?? 0,
      failed:       failed.count       ?? 0,
      highPriority: highPriority.count ?? 0,
      error:        null,
    }
  } catch (err) {
    console.error('[getAdminAuditMetrics]', err instanceof Error ? err.message : err)
    return { ...empty, error: 'Audit submissions table is unavailable.' }
  }
}

// ── getLatestAdminAuditSubmissions ────────────────────────────────

export async function getLatestAdminAuditSubmissions(
  limit = 5,
): Promise<{ rows: AdminAuditRow[]; error: string | null }> {
  await requireAdmin()

  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 50)

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { rows: [], error: 'Service role key not configured.' }
  }

  try {
    const db = createServiceRoleClient()
    const { data, error } = await db
      .from('audit_submissions')
      .select(SELECT_COLS)
      .neq('status', 'archived')
      .order('created_at', { ascending: false })
      .limit(safeLimit)

    if (error) throw error
    return { rows: ((data ?? []) as Record<string, unknown>[]).map(toAdminAuditRow), error: null }
  } catch (err) {
    console.error('[getLatestAdminAuditSubmissions]', err instanceof Error ? err.message : err)
    return { rows: [], error: 'Audit submissions table is unavailable.' }
  }
}

// ── getAdminAuditTableRows ────────────────────────────────────────

export interface AdminAuditTableQuery {
  status?:  AdminAuditStatus | 'all'
  search?:  string
  limit?:   number
  offset?:  number
}

export async function getAdminAuditTableRows(
  query: AdminAuditTableQuery = {},
): Promise<AdminAuditTableResult> {
  await requireAdmin()

  const limit  = Math.min(Math.max(1, Math.floor(query.limit  ?? 50)), 200)
  const offset = Math.max(0, Math.floor(query.offset ?? 0))

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { rows: [], total: 0, error: 'Service role key not configured.' }
  }

  try {
    const db = createServiceRoleClient()
    let q = db.from('audit_submissions').select(SELECT_COLS, { count: 'exact' })

    if (query.status && query.status !== 'all') {
      q = q.eq('status', query.status)
    } else {
      q = q.neq('status', 'archived')
    }

    // Sanitize search before injecting into a PostgREST `or()` filter.
    if (query.search) {
      const s = query.search.replace(/[^A-Za-z0-9 _.\-@]/g, '').trim().slice(0, 80)
      if (s.length > 0) {
        q = q.or(
          `business_name.ilike.%${s}%,industry.ilike.%${s}%,city.ilike.%${s}%,email.ilike.%${s}%`,
        )
      }
    }

    const { data, error, count } = await q
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    return {
      rows:  ((data ?? []) as Record<string, unknown>[]).map(toAdminAuditRow),
      total: count ?? 0,
      error: null,
    }
  } catch (err) {
    console.error('[getAdminAuditTableRows]', err instanceof Error ? err.message : err)
    return { rows: [], total: 0, error: 'Audit submissions table is unavailable.' }
  }
}
