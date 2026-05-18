'use server'

import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { getBusinessPlan } from '@/lib/billing/limits'
import { captureApiError } from '@/lib/logging/api'

type DbRow = Record<string, unknown>

// ── Auth helper ───────────────────────────────────────────────────

async function requireAuth(): Promise<
  { ok: true;  userId: string; businessId: string; plan: string } |
  { ok: false; error: string }
> {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated.' }

  const db = createServiceRoleClient()
  const { data: membership } = await db
    .from('business_members').select('business_id').eq('user_id', user.id).limit(1).single()
  if (!membership) return { ok: false, error: 'No business found.' }

  const businessId = (membership as DbRow).business_id as string
  const plan       = await getBusinessPlan(db, businessId)
  return { ok: true, userId: user.id, businessId, plan }
}

// ── Shared types ──────────────────────────────────────────────────

export interface OpsEvent {
  id:                 string
  business_id:        string | null
  source:             string
  event_type:         string
  severity:           string
  title:              string
  description:        string | null
  status:             string
  related_table:      string | null
  related_id:         string | null
  metadata:           Record<string, unknown>
  created_at:         string
  resolved_at:        string | null
  // Phase 14 SLA fields
  sla_due_at:         string | null
  escalation_level:   number
  escalated_at:       string | null
  notified_at:        string | null
  notification_status: string | null
  assigned_user_name: string | null
  assigned_to:        string | null
}

export interface OpsTask {
  id:                 string
  business_id:        string | null
  title:              string
  description:        string | null
  task_type:          string
  priority:           string
  status:             string
  related_table:      string | null
  related_id:         string | null
  assigned_to:        string | null
  due_at:             string | null
  metadata:           Record<string, unknown>
  created_at:         string
  completed_at:       string | null
  // Phase 14 SLA fields
  sla_due_at:          string | null
  overdue_at:          string | null
  escalation_level:    number
  escalated_at:        string | null
  notified_at:         string | null
  notification_status: string | null
  assigned_user_name:  string | null
}

export interface OpsAlert {
  id:                  string
  business_id:         string | null
  alert_type:          string
  severity:            string
  title:               string
  message:             string | null
  status:              string
  related_table:       string | null
  related_id:          string | null
  metadata:            Record<string, unknown>
  created_at:          string
  acknowledged_at:     string | null
  resolved_at:         string | null
  // Phase 14 SLA fields
  sla_due_at:          string | null
  escalation_level:    number
  escalated_at:        string | null
  notified_at:         string | null
  notification_status: string | null
  assigned_to:         string | null
  assigned_user_name:  string | null
}

export interface ApprovalItem {
  id:                  string
  business_id:         string | null
  approval_type:       string
  title:               string
  description:         string | null
  content:             string | null
  status:              string
  requested_by:        string | null
  reviewed_by:         string | null
  related_table:       string | null
  related_id:          string | null
  priority:            string
  assigned_to:         string | null
  source_table:        string | null
  source_id:           string | null
  metadata:            Record<string, unknown>
  created_at:          string
  reviewed_at:         string | null
  // Phase 14 SLA fields
  sla_due_at:          string | null
  escalation_level:    number
  escalated_at:        string | null
  notified_at:         string | null
  notification_status: string | null
  assigned_user_name:  string | null
}

export interface OpsOverviewMetrics {
  openEvents:       number
  activeTasks:      number
  activeAlerts:     number
  pendingApprovals: number
  criticalCount:    number
  resolvedToday:    number
}

export interface SystemHealthItem {
  name:      string
  status:    'healthy' | 'degraded' | 'unconfigured' | 'unknown'
  detail:    string
}

// ── getOpsOverview ────────────────────────────────────────────────

export async function getOpsOverview(): Promise<{
  metrics:  OpsOverviewMetrics
  error:    string | null
}> {
  const auth = await requireAuth()
  if (!auth.ok) return { metrics: zeroMetrics(), error: auth.error }

  const db = createServiceRoleClient()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  try {
    const [eventsRes, tasksRes, alertsRes, approvalsRes, resolvedRes] = await Promise.all([
      db.from('ops_events').select('*', { count: 'exact', head: true })
        .eq('business_id', auth.businessId).eq('status', 'open'),
      db.from('ops_tasks').select('*', { count: 'exact', head: true })
        .eq('business_id', auth.businessId).in('status', ['pending','in_progress']),
      db.from('ops_alerts').select('*', { count: 'exact', head: true })
        .eq('business_id', auth.businessId).eq('status', 'active'),
      db.from('approval_items').select('*', { count: 'exact', head: true })
        .eq('business_id', auth.businessId).eq('status', 'pending'),
      db.from('ops_events').select('*', { count: 'exact', head: true })
        .eq('business_id', auth.businessId).eq('status', 'resolved')
        .gte('resolved_at', today.toISOString()),
    ])

    const critRes = await db.from('ops_alerts').select('*', { count: 'exact', head: true })
      .eq('business_id', auth.businessId).eq('severity', 'critical').eq('status', 'active')

    return {
      metrics: {
        openEvents:       eventsRes.count ?? 0,
        activeTasks:      tasksRes.count ?? 0,
        activeAlerts:     alertsRes.count ?? 0,
        pendingApprovals: approvalsRes.count ?? 0,
        criticalCount:    critRes.count ?? 0,
        resolvedToday:    resolvedRes.count ?? 0,
      },
      error: null,
    }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'overview_error', business_id: auth.businessId })
    return { metrics: zeroMetrics(), error: 'Could not load Ops overview.' }
  }
}

function zeroMetrics(): OpsOverviewMetrics {
  return { openEvents: 0, activeTasks: 0, activeAlerts: 0, pendingApprovals: 0, criticalCount: 0, resolvedToday: 0 }
}

// ── Paginated result type ─────────────────────────────────────────

export interface PaginatedOpsResult<T> {
  rows:          T[]
  total_count:   number
  page:          number
  pageSize:      number
  has_next:      boolean
  has_previous:  boolean
  error:         string | null
}

export interface OpsSearchParams {
  search?:          string
  status?:          string
  severity?:        string
  source?:          string
  priority?:        string
  date_from?:       string
  date_to?:         string
  page?:            number
  pageSize?:        number
  include_snoozed?: boolean
  // legacy compat
  limit?:           number
}

function emptyPage<T>(error: string | null = null): PaginatedOpsResult<T> {
  return { rows: [], total_count: 0, page: 1, pageSize: 25, has_next: false, has_previous: false, error }
}

// ── getOpsEvents ──────────────────────────────────────────────────

export async function getOpsEvents(params: OpsSearchParams = {}): Promise<PaginatedOpsResult<OpsEvent>> {
  const auth = await requireAuth()
  if (!auth.ok) return emptyPage(auth.error)
  const db  = createServiceRoleClient()
  const ps  = params.pageSize ?? params.limit ?? 25
  const pg  = params.page ?? 1
  const from = (pg - 1) * ps
  const to   = from + ps - 1

  try {
    let query = db.from('ops_events').select('*', { count: 'exact' })
      .eq('business_id', auth.businessId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (params.status)   query = query.eq('status', params.status)
    if (params.severity) query = query.eq('severity', params.severity)
    if (params.source)   query = query.eq('source', params.source)
    if (params.date_from) query = query.gte('created_at', params.date_from)
    if (params.date_to)   query = query.lte('created_at', params.date_to)
    // FTS: use textSearch if search >= 3 chars and search_vector column exists; else ilike
    if (params.search && params.search.length >= 3) {
      query = (query as ReturnType<typeof db.from>).textSearch('search_vector', params.search.trim(), { type: 'websearch', config: 'english' }) as typeof query
    } else if (params.search) {
      query = query.ilike('title', `%${params.search}%`)
    }
    if (!params.include_snoozed) {
      query = query.or(`snoozed_until.is.null,snoozed_until.lt.${new Date().toISOString()}`)
    }

    let { data, count, error } = await query
    // If FTS fails (column not yet migrated), fall back to ilike
    if (error && params.search && params.search.length >= 3) {
      let fallbackQuery = db.from('ops_events').select('*', { count: 'exact' })
        .eq('business_id', auth.businessId)
        .ilike('title', `%${params.search}%`)
        .order('created_at', { ascending: false }).range(from, to)
      if (params.status)   fallbackQuery = fallbackQuery.eq('status', params.status)
      const fallback = await fallbackQuery
      data = fallback.data; count = fallback.count; error = fallback.error
    }
    if (error) throw error
    const total = count ?? 0
    return { rows: (data ?? []) as OpsEvent[], total_count: total, page: pg, pageSize: ps, has_next: from + ps < total, has_previous: pg > 1, error: null }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'events_error', business_id: auth.businessId })
    return emptyPage('Could not load ops events.')
  }
}

// ── getOpsTasks ───────────────────────────────────────────────────

export async function getOpsTasks(params: OpsSearchParams = {}): Promise<PaginatedOpsResult<OpsTask>> {
  const auth = await requireAuth()
  if (!auth.ok) return emptyPage(auth.error)
  const db  = createServiceRoleClient()
  const ps  = params.pageSize ?? params.limit ?? 25
  const pg  = params.page ?? 1
  const from = (pg - 1) * ps
  const to   = from + ps - 1

  try {
    let query = db.from('ops_tasks').select('*', { count: 'exact' })
      .eq('business_id', auth.businessId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (params.status)   query = query.eq('status', params.status)
    if (params.priority) query = query.eq('priority', params.priority)
    if (params.date_from) query = query.gte('created_at', params.date_from)
    if (params.date_to)   query = query.lte('created_at', params.date_to)
    if (params.search && params.search.length >= 3) {
      query = (query as ReturnType<typeof db.from>).textSearch('search_vector', params.search.trim(), { type: 'websearch', config: 'english' }) as typeof query
    } else if (params.search) {
      query = query.ilike('title', `%${params.search}%`)
    }
    if (!params.include_snoozed) {
      query = query.or(`snoozed_until.is.null,snoozed_until.lt.${new Date().toISOString()}`)
    }

    let { data, count, error } = await query
    if (error && params.search && params.search.length >= 3) {
      const fb = await db.from('ops_tasks').select('*', { count: 'exact' })
        .eq('business_id', auth.businessId).ilike('title', `%${params.search}%`)
        .order('created_at', { ascending: false }).range(from, to)
      data = fb.data; count = fb.count; error = fb.error
    }
    if (error) throw error
    const total = count ?? 0
    return { rows: (data ?? []) as OpsTask[], total_count: total, page: pg, pageSize: ps, has_next: from + ps < total, has_previous: pg > 1, error: null }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'tasks_error', business_id: auth.businessId })
    return emptyPage('Could not load ops tasks.')
  }
}

// ── getOpsAlerts ──────────────────────────────────────────────────

export async function getOpsAlerts(params: OpsSearchParams = {}): Promise<PaginatedOpsResult<OpsAlert>> {
  const auth = await requireAuth()
  if (!auth.ok) return emptyPage(auth.error)
  const db  = createServiceRoleClient()
  const ps  = params.pageSize ?? params.limit ?? 25
  const pg  = params.page ?? 1
  const from = (pg - 1) * ps
  const to   = from + ps - 1

  try {
    let query = db.from('ops_alerts').select('*', { count: 'exact' })
      .eq('business_id', auth.businessId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (params.status)   query = query.eq('status', params.status)
    if (params.severity) query = query.eq('severity', params.severity)
    if (params.date_from) query = query.gte('created_at', params.date_from)
    if (params.date_to)   query = query.lte('created_at', params.date_to)
    if (params.search && params.search.length >= 3) {
      query = (query as ReturnType<typeof db.from>).textSearch('search_vector', params.search.trim(), { type: 'websearch', config: 'english' }) as typeof query
    } else if (params.search) {
      query = query.ilike('title', `%${params.search}%`)
    }
    if (!params.include_snoozed) {
      query = query.or(`snoozed_until.is.null,snoozed_until.lt.${new Date().toISOString()}`)
    }

    let { data, count, error } = await query
    if (error && params.search && params.search.length >= 3) {
      const fb = await db.from('ops_alerts').select('*', { count: 'exact' })
        .eq('business_id', auth.businessId).ilike('title', `%${params.search}%`)
        .order('created_at', { ascending: false }).range(from, to)
      data = fb.data; count = fb.count; error = fb.error
    }
    if (error) throw error
    const total = count ?? 0
    return { rows: (data ?? []) as OpsAlert[], total_count: total, page: pg, pageSize: ps, has_next: from + ps < total, has_previous: pg > 1, error: null }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'alerts_error', business_id: auth.businessId })
    return emptyPage('Could not load ops alerts.')
  }
}

// ── getApprovalItems ──────────────────────────────────────────────

export async function getApprovalItems(params: OpsSearchParams = {}): Promise<PaginatedOpsResult<ApprovalItem>> {
  const auth = await requireAuth()
  if (!auth.ok) return emptyPage(auth.error)
  const db  = createServiceRoleClient()
  const ps  = params.pageSize ?? params.limit ?? 25
  const pg  = params.page ?? 1
  const from = (pg - 1) * ps
  const to   = from + ps - 1

  try {
    let query = db.from('approval_items').select('*', { count: 'exact' })
      .eq('business_id', auth.businessId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (params.status)   query = query.eq('status', params.status)
    if (params.priority) query = query.eq('priority', params.priority)
    if (params.date_from) query = query.gte('created_at', params.date_from)
    if (params.date_to)   query = query.lte('created_at', params.date_to)
    if (params.search && params.search.length >= 3) {
      query = (query as ReturnType<typeof db.from>).textSearch('search_vector', params.search.trim(), { type: 'websearch', config: 'english' }) as typeof query
    } else if (params.search) {
      query = query.ilike('title', `%${params.search}%`)
    }
    if (!params.include_snoozed) {
      query = query.or(`snoozed_until.is.null,snoozed_until.lt.${new Date().toISOString()}`)
    }

    let { data, count, error } = await query
    if (error && params.search && params.search.length >= 3) {
      const fb = await db.from('approval_items').select('*', { count: 'exact' })
        .eq('business_id', auth.businessId).ilike('title', `%${params.search}%`)
        .order('created_at', { ascending: false }).range(from, to)
      data = fb.data; count = fb.count; error = fb.error
    }
    if (error) throw error
    const total = count ?? 0
    return { rows: (data ?? []) as ApprovalItem[], total_count: total, page: pg, pageSize: ps, has_next: from + ps < total, has_previous: pg > 1, error: null }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'approvals_error', business_id: auth.businessId })
    return emptyPage('Could not load approval items.')
  }
}

// ── Status updaters ───────────────────────────────────────────────

export async function updateOpsEventStatus(
  id: string, status: string,
): Promise<{ success?: string; error?: string }> {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const db = createServiceRoleClient()
  try {
    const updates: Record<string, unknown> = { status }
    if (status === 'resolved') updates.resolved_at = new Date().toISOString()
    await db.from('ops_events').update(updates).eq('id', id).eq('business_id', auth.businessId)
    return { success: `Event ${status}.` }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'update_event_error', business_id: auth.businessId })
    return { error: 'Could not update event.' }
  }
}

export async function updateOpsAlertStatus(
  id: string, status: string,
): Promise<{ success?: string; error?: string }> {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const db = createServiceRoleClient()
  try {
    const updates: Record<string, unknown> = { status }
    if (status === 'acknowledged') updates.acknowledged_at = new Date().toISOString()
    if (status === 'resolved')     updates.resolved_at     = new Date().toISOString()
    await db.from('ops_alerts').update(updates).eq('id', id).eq('business_id', auth.businessId)
    return { success: `Alert ${status}.` }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'update_alert_error', business_id: auth.businessId })
    return { error: 'Could not update alert.' }
  }
}

export async function updateOpsTaskStatus(
  id: string, status: string,
): Promise<{ success?: string; error?: string }> {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const db = createServiceRoleClient()
  try {
    const updates: Record<string, unknown> = { status }
    if (status === 'completed') updates.completed_at = new Date().toISOString()
    await db.from('ops_tasks').update(updates).eq('id', id).eq('business_id', auth.businessId)
    return { success: `Task ${status}.` }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'update_task_error', business_id: auth.businessId })
    return { error: 'Could not update task.' }
  }
}

export async function updateApprovalItemStatus(
  id: string, status: 'approved' | 'rejected',
): Promise<{ success?: string; error?: string }> {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const db = createServiceRoleClient()
  try {
    await db.from('approval_items').update({
      status, reviewed_by: auth.userId, reviewed_at: new Date().toISOString(),
    }).eq('id', id).eq('business_id', auth.businessId)
    return { success: `Item ${status}.` }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'update_approval_error', business_id: auth.businessId })
    return { error: 'Could not update approval.' }
  }
}

// ── Bulk actions ──────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function bulkResolveOpsEvents(ids: string[]): Promise<{ updated: number; error?: string }> {
  if (!ids.length || ids.length > 50) return { updated: 0, error: 'Select 1–50 events.' }
  if (!ids.every((id) => UUID_RE.test(id))) return { updated: 0, error: 'Invalid IDs.' }
  const auth = await requireAuth()
  if (!auth.ok) return { updated: 0, error: auth.error }
  const db = createServiceRoleClient()
  try {
    const { data } = await db.from('ops_events')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .in('id', ids).eq('business_id', auth.businessId).select('id')
    return { updated: (data ?? []).length }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'bulk_resolve_error', business_id: auth.businessId })
    return { updated: 0, error: 'Bulk resolve failed.' }
  }
}

export async function bulkDismissTasks(ids: string[]): Promise<{ updated: number; error?: string }> {
  if (!ids.length || ids.length > 50) return { updated: 0, error: 'Select 1–50 tasks.' }
  if (!ids.every((id) => UUID_RE.test(id))) return { updated: 0, error: 'Invalid IDs.' }
  const auth = await requireAuth()
  if (!auth.ok) return { updated: 0, error: auth.error }
  const db = createServiceRoleClient()
  try {
    const { data } = await db.from('ops_tasks')
      .update({ status: 'cancelled' })
      .in('id', ids).eq('business_id', auth.businessId).select('id')
    return { updated: (data ?? []).length }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'bulk_dismiss_error', business_id: auth.businessId })
    return { updated: 0, error: 'Bulk dismiss failed.' }
  }
}

// ── System health ─────────────────────────────────────────────────
// Checks env-var presence + DB connection rows. Returns safe display-only status.

export interface SystemHealthSummary {
  items:  SystemHealthItem[]
  error:  string | null
}

export async function getSystemHealthSummary(): Promise<SystemHealthSummary> {
  const auth = await requireAuth()
  if (!auth.ok) return { items: [], error: auth.error }

  const db = createServiceRoleClient()

  const [
    widgetRes, calcomRes, waConnRes, stripeRes, agentRes,
  ] = await Promise.all([
    db.from('widget_settings').select('is_enabled').eq('business_id', auth.businessId).single(),
    db.from('calcom_connections').select('is_connected').eq('business_id', auth.businessId).single(),
    db.from('whatsapp_connections').select('is_enabled, status').eq('business_id', auth.businessId).single(),
    db.from('subscriptions').select('status, plan').eq('business_id', auth.businessId).single(),
    db.from('agent_runs').select('status, created_at').eq('business_id', auth.businessId)
      .order('created_at', { ascending: false }).limit(1).single(),
  ]).catch(() => [null, null, null, null, null])

  const items: SystemHealthItem[] = [
    {
      name:   'Chat Widget',
      status: (widgetRes as { data?: { is_enabled?: boolean } } | null)?.data?.is_enabled ? 'healthy' : 'degraded',
      detail: (widgetRes as { data?: { is_enabled?: boolean } } | null)?.data?.is_enabled ? 'Active' : 'Disabled',
    },
    {
      name:   'Anthropic AI',
      status: process.env.ANTHROPIC_API_KEY ? 'healthy' : 'unconfigured',
      detail: process.env.ANTHROPIC_API_KEY ? 'API key configured' : 'ANTHROPIC_API_KEY missing',
    },
    {
      name:   'Cal.com',
      status: (calcomRes as { data?: { is_connected?: boolean } } | null)?.data?.is_connected
        ? 'healthy' : process.env.CALCOM_API_KEY ? 'degraded' : 'unconfigured',
      detail: (calcomRes as { data?: { is_connected?: boolean } } | null)?.data?.is_connected
        ? 'Connected' : 'Not connected',
    },
    {
      name:   'WhatsApp',
      status: (waConnRes as { data?: { is_enabled?: boolean; status?: string } } | null)?.data?.is_enabled
        ? 'healthy' : process.env.META_ACCESS_TOKEN ? 'degraded' : 'unconfigured',
      detail: (waConnRes as { data?: { is_enabled?: boolean } } | null)?.data?.is_enabled
        ? 'Enabled' : 'Not enabled',
    },
    {
      name:   'Stripe',
      status: process.env.STRIPE_SECRET_KEY ? 'healthy' : 'unconfigured',
      detail: (stripeRes as { data?: { status?: string; plan?: string } } | null)?.data?.plan
        ? `Plan: ${(stripeRes as { data?: { plan?: string } } | null)?.data?.plan}` : 'Not configured',
    },
    {
      name:   'Relevance AI',
      status: process.env.RELEVANCE_API_KEY ? 'healthy' : 'unconfigured',
      detail: (agentRes as { data?: { status?: string } } | null)?.data?.status
        ? `Last run: ${(agentRes as { data?: { status?: string } } | null)?.data?.status}` : 'No runs yet',
    },
    {
      name:   'PostHog',
      status: process.env.NEXT_PUBLIC_POSTHOG_KEY ? 'healthy' : 'unconfigured',
      detail: process.env.NEXT_PUBLIC_POSTHOG_KEY ? 'Analytics active' : 'NEXT_PUBLIC_POSTHOG_KEY missing',
    },
    {
      name:   'Sentry',
      status: process.env.NEXT_PUBLIC_SENTRY_DSN ? 'healthy' : 'unconfigured',
      detail: process.env.NEXT_PUBLIC_SENTRY_DSN ? 'Error monitoring active' : 'Not configured',
    },
  ]

  return { items, error: null }
}

// ── Client systems summary ────────────────────────────────────────

export interface ClientSystem {
  name:          string
  type:          string
  status:        'active' | 'inactive' | 'unconfigured'
  lastActivity:  string | null
}

export async function getClientSystemsSummary(): Promise<{
  systems: ClientSystem[]
  error:   string | null
}> {
  const auth = await requireAuth()
  if (!auth.ok) return { systems: [], error: auth.error }

  const db = createServiceRoleClient()
  try {
    const [widgetRes, waRes, calcomRes] = await Promise.all([
      db.from('widget_settings').select('is_enabled, updated_at').eq('business_id', auth.businessId).single(),
      db.from('whatsapp_connections').select('is_enabled, updated_at').eq('business_id', auth.businessId).single(),
      db.from('calcom_connections').select('is_connected, updated_at').eq('business_id', auth.businessId).single(),
    ])

    const sys = (d: { data?: { updated_at?: string } } | null) =>
      (d as { data?: { updated_at?: string } } | null)?.data?.updated_at ?? null

    const systems: ClientSystem[] = [
      {
        name:         'Chat Widget',
        type:         'widget',
        status:       (widgetRes as { data?: { is_enabled?: boolean } } | null)?.data?.is_enabled ? 'active' : 'inactive',
        lastActivity: sys(widgetRes as { data?: { updated_at?: string } } | null),
      },
      {
        name:         'WhatsApp',
        type:         'whatsapp',
        status:       (waRes as { data?: { is_enabled?: boolean } } | null)?.data?.is_enabled ? 'active' : 'inactive',
        lastActivity: sys(waRes as { data?: { updated_at?: string } } | null),
      },
      {
        name:         'Cal.com Booking',
        type:         'calcom',
        status:       (calcomRes as { data?: { is_connected?: boolean } } | null)?.data?.is_connected ? 'active' : 'inactive',
        lastActivity: sys(calcomRes as { data?: { updated_at?: string } } | null),
      },
    ]

    return { systems, error: null }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'client_systems_error', business_id: auth.businessId })
    return { systems: [], error: 'Could not load client systems.' }
  }
}

// ── Phase 13: Automation Rules ────────────────────────────────────

import type { AutomationRule } from '@/lib/ops/automation'

export async function getAutomationRules(): Promise<{
  rules: AutomationRule[]
  error: string | null
}> {
  const auth = await requireAuth()
  if (!auth.ok) return { rules: [], error: auth.error }
  const db = createServiceRoleClient()
  try {
    const { data, error } = await db
      .from('ops_automation_rules')
      .select('*')
      .or(`business_id.eq.${auth.businessId},business_id.is.null`)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
    if (error) throw error
    return { rules: (data ?? []) as AutomationRule[], error: null }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'get_rules_error', business_id: auth.businessId })
    return { rules: [], error: 'Could not load automation rules.' }
  }
}

export async function toggleAutomationRule(
  id: string, isEnabled: boolean,
): Promise<{ success?: string; error?: string }> {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const db = createServiceRoleClient()
  try {
    await db.from('ops_automation_rules')
      .update({ is_enabled: isEnabled })
      .eq('id', id).eq('business_id', auth.businessId)
    return { success: `Rule ${isEnabled ? 'enabled' : 'disabled'}.` }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'toggle_rule_error', business_id: auth.businessId })
    return { error: 'Could not update rule.' }
  }
}

export async function seedDefaultRules(): Promise<{ seeded: number; error?: string }> {
  const auth = await requireAuth()
  if (!auth.ok) return { seeded: 0, error: auth.error }
  const db = createServiceRoleClient()
  const { seedDefaultAutomationRules } = await import('@/lib/ops/automation')
  const result = await seedDefaultAutomationRules(auth.businessId, db)
  return { seeded: result.seeded, error: result.error ?? undefined }
}

export async function runOpsAutomationNow(): Promise<{
  processed: number; errors: number; error?: string
}> {
  const auth = await requireAuth()
  if (!auth.ok) return { processed: 0, errors: 0, error: auth.error }
  const { processUnprocessedOpsEvents } = await import('@/lib/ops/automation')
  return processUnprocessedOpsEvents(auth.businessId, 50)
}

// ── Phase 13: Bulk actions ────────────────────────────────────────

export async function bulkUpdateOpsEvents(
  ids: string[], action: 'resolve' | 'ignore',
): Promise<{ updated: number; error?: string }> {
  if (!ids.length || ids.length > 50) return { updated: 0, error: 'Select 1–50.' }
  if (!ids.every((id) => UUID_RE.test(id))) return { updated: 0, error: 'Invalid IDs.' }
  const auth = await requireAuth()
  if (!auth.ok) return { updated: 0, error: auth.error }
  const db = createServiceRoleClient()
  try {
    const now = new Date().toISOString()
    const updates = action === 'resolve'
      ? { status: 'resolved', resolved_at: now }
      : { status: 'resolved', ignored_at: now }
    const { data } = await db.from('ops_events')
      .update(updates).in('id', ids).eq('business_id', auth.businessId).select('id')
    return { updated: (data ?? []).length }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'bulk_events_error', business_id: auth.businessId })
    return { updated: 0, error: 'Bulk event update failed.' }
  }
}

export async function bulkUpdateOpsAlerts(
  ids: string[], action: 'acknowledge' | 'resolve' | 'ignore',
): Promise<{ updated: number; error?: string }> {
  if (!ids.length || ids.length > 50) return { updated: 0, error: 'Select 1–50.' }
  if (!ids.every((id) => UUID_RE.test(id))) return { updated: 0, error: 'Invalid IDs.' }
  const auth = await requireAuth()
  if (!auth.ok) return { updated: 0, error: auth.error }
  const db = createServiceRoleClient()
  try {
    const now = new Date().toISOString()
    const updates: Record<string, unknown> =
      action === 'acknowledge' ? { status: 'acknowledged', acknowledged_at: now, acknowledged_by: auth.userId } :
      action === 'resolve'     ? { status: 'resolved', resolved_at: now, resolved_by: auth.userId } :
                                 { status: 'resolved', resolved_at: now }
    const { data } = await db.from('ops_alerts')
      .update(updates).in('id', ids).eq('business_id', auth.businessId).select('id')
    return { updated: (data ?? []).length }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'bulk_alerts_error', business_id: auth.businessId })
    return { updated: 0, error: 'Bulk alert update failed.' }
  }
}

export async function bulkUpdateOpsTasks(
  ids: string[], action: 'start' | 'complete' | 'dismiss',
): Promise<{ updated: number; error?: string }> {
  if (!ids.length || ids.length > 50) return { updated: 0, error: 'Select 1–50.' }
  if (!ids.every((id) => UUID_RE.test(id))) return { updated: 0, error: 'Invalid IDs.' }
  const auth = await requireAuth()
  if (!auth.ok) return { updated: 0, error: auth.error }
  const db = createServiceRoleClient()
  try {
    const now = new Date().toISOString()
    const updates: Record<string, unknown> =
      action === 'start'    ? { status: 'in_progress' } :
      action === 'complete' ? { status: 'completed', completed_at: now, completed_by: auth.userId } :
                              { status: 'cancelled', dismissed_at: now, dismissed_by: auth.userId }
    const { data } = await db.from('ops_tasks')
      .update(updates).in('id', ids).eq('business_id', auth.businessId).select('id')
    return { updated: (data ?? []).length }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'bulk_tasks_error', business_id: auth.businessId })
    return { updated: 0, error: 'Bulk task update failed.' }
  }
}

export async function bulkUpdateApprovals(
  ids: string[], action: 'approve' | 'reject' | 'archive',
): Promise<{ updated: number; error?: string }> {
  if (!ids.length || ids.length > 50) return { updated: 0, error: 'Select 1–50.' }
  if (!ids.every((id) => UUID_RE.test(id))) return { updated: 0, error: 'Invalid IDs.' }
  const auth = await requireAuth()
  if (!auth.ok) return { updated: 0, error: auth.error }
  const db = createServiceRoleClient()
  try {
    const now = new Date().toISOString()
    const updates: Record<string, unknown> =
      action === 'approve' ? { status: 'approved', reviewed_by: auth.userId, reviewed_at: now } :
      action === 'reject'  ? { status: 'rejected', reviewed_by: auth.userId, reviewed_at: now } :
                             { status: 'expired', reviewed_at: now }
    const { data } = await db.from('approval_items')
      .update(updates).in('id', ids).eq('business_id', auth.businessId).select('id')
    return { updated: (data ?? []).length }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'bulk_approvals_error', business_id: auth.businessId })
    return { updated: 0, error: 'Bulk approval update failed.' }
  }
}

// ── Phase 13: Assignment ──────────────────────────────────────────

export async function assignOpsItem(
  table: 'ops_events' | 'ops_tasks' | 'ops_alerts' | 'approval_items',
  id: string,
  assignedTo: string | null,
): Promise<{ success?: string; error?: string }> {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const db = createServiceRoleClient()
  try {
    // Resolve assigned user name for display
    let assignedUserName: string | null = null
    if (assignedTo) {
      const { data: profile } = await db
        .from('profiles').select('email, full_name').eq('id', assignedTo).single()
      const p = profile as { email?: string; full_name?: string } | null
      assignedUserName = p?.full_name ?? p?.email ?? null
    }

    await db.from(table).update({
      assigned_to:        assignedTo,
      assigned_user_name: assignedUserName,
    }).eq('id', id).eq('business_id', auth.businessId)

    // Audit trail (fire-and-forget)
    void import('@/lib/ops/audit').then(({ auditAssignmentChange }) =>
      auditAssignmentChange({ businessId: auth.businessId, userId: auth.userId, table, targetId: id, beforeUserId: null, afterUserId: assignedTo, db })
    ).catch(() => undefined)

    // Notify assigned user (fire-and-forget)
    if (assignedTo) {
      void import('@/lib/ops/notifications').then(({ notifyAssignedUser }) =>
        notifyAssignedUser({ userId: assignedTo, title: 'A conversation item was assigned to you', description: null, section: 'activity', businessId: auth.businessId, db })
      ).catch(() => undefined)
    }

    return { success: assignedTo ? 'Item assigned.' : 'Assignment removed.' }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'assign_item_error', business_id: auth.businessId })
    return { error: 'Could not assign item.' }
  }
}

export interface BusinessMember {
  user_id:   string
  email:     string
  full_name: string | null
  role:      string
}

export async function getBusinessMembersForAssignment(): Promise<{
  members: BusinessMember[]
  error:   string | null
}> {
  const auth = await requireAuth()
  if (!auth.ok) return { members: [], error: auth.error }
  const db = createServiceRoleClient()
  try {
    const { data } = await db
      .from('business_members')
      .select('user_id, role, profiles(email, full_name)')
      .eq('business_id', auth.businessId)
      .limit(20)

    const members = ((data ?? []) as DbRow[]).map((m) => {
      const profile = m.profiles as { email?: string; full_name?: string } | null
      return {
        user_id:   m.user_id as string,
        email:     profile?.email ?? '',
        full_name: profile?.full_name ?? null,
        role:      m.role as string,
      }
    })

    return { members, error: null }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'get_members_error', business_id: auth.businessId })
    return { members: [], error: 'Could not load team members.' }
  }
}

// ── Phase 13: Export log ──────────────────────────────────────────

export async function logOpsExport(
  exportType: string,
  format:     string,
  rowCount:   number,
  filters:    Record<string, unknown>,
): Promise<void> {
  const auth = await requireAuth()
  if (!auth.ok) return
  const db = createServiceRoleClient()
  try {
    await db.from('ops_exports').insert({
      business_id:  auth.businessId,
      export_type:  exportType,
      format,
      status:       'completed',
      requested_by: auth.userId,
      filters,
      row_count:    rowCount,
    })
  } catch { /* silent */ }
}

// ── Phase 14: SLA policies ────────────────────────────────────────

import type { SlaPolicy, SlaSummary, SlaCheckResult } from '@/lib/ops/sla'

export async function getSlaPolicies(): Promise<{
  policies: SlaPolicy[]
  error:    string | null
}> {
  const auth = await requireAuth()
  if (!auth.ok) return { policies: [], error: auth.error }
  const db = createServiceRoleClient()
  try {
    const { data, error } = await db
      .from('ops_sla_policies').select('*')
      .or(`business_id.eq.${auth.businessId},business_id.is.null`)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
    if (error) throw error
    return { policies: (data ?? []) as SlaPolicy[], error: null }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'get_sla_policies_error', business_id: auth.businessId })
    return { policies: [], error: 'Could not load SLA policies.' }
  }
}

export async function toggleSlaPolicy(id: string, isEnabled: boolean): Promise<{ success?: string; error?: string }> {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const db = createServiceRoleClient()
  try {
    await db.from('ops_sla_policies').update({ is_enabled: isEnabled }).eq('id', id).eq('business_id', auth.businessId)
    return { success: `SLA policy ${isEnabled ? 'enabled' : 'disabled'}.` }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'toggle_sla_error', business_id: auth.businessId })
    return { error: 'Could not update SLA policy.' }
  }
}

export async function seedDefaultSlaPoliciesAction(): Promise<{ seeded: number; error?: string }> {
  const auth = await requireAuth()
  if (!auth.ok) return { seeded: 0, error: auth.error }
  const db = createServiceRoleClient()
  const { seedDefaultSlaPolicies } = await import('@/lib/ops/sla')
  const result = await seedDefaultSlaPolicies(auth.businessId, db)
  return { seeded: result.seeded, error: result.error ?? undefined }
}

// ── Phase 14: Notification rules ──────────────────────────────────

import type { NotificationRule } from '@/lib/ops/notifications'

export async function getNotificationRules(): Promise<{
  rules: NotificationRule[]
  error: string | null
}> {
  const auth = await requireAuth()
  if (!auth.ok) return { rules: [], error: auth.error }
  const db = createServiceRoleClient()
  try {
    const { data, error } = await db
      .from('ops_notification_rules').select('*')
      .or(`business_id.eq.${auth.businessId},business_id.is.null`)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
    if (error) throw error
    return { rules: (data ?? []) as NotificationRule[], error: null }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'get_notification_rules_error', business_id: auth.businessId })
    return { rules: [], error: 'Could not load notification rules.' }
  }
}

export async function toggleNotificationRule(id: string, isEnabled: boolean): Promise<{ success?: string; error?: string }> {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const db = createServiceRoleClient()
  try {
    await db.from('ops_notification_rules').update({ is_enabled: isEnabled }).eq('id', id).eq('business_id', auth.businessId)
    return { success: `Notification rule ${isEnabled ? 'enabled' : 'disabled'}.` }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'toggle_notification_error', business_id: auth.businessId })
    return { error: 'Could not update notification rule.' }
  }
}

export async function seedDefaultNotificationRulesAction(): Promise<{ seeded: number; error?: string }> {
  const auth = await requireAuth()
  if (!auth.ok) return { seeded: 0, error: auth.error }
  const db = createServiceRoleClient()
  const { seedDefaultNotificationRules } = await import('@/lib/ops/notifications')
  const result = await seedDefaultNotificationRules(auth.businessId, db)
  return { seeded: result.seeded, error: result.error ?? undefined }
}

// ── Phase 14: Audit trail ─────────────────────────────────────────

import type { AuditTrailRow } from '@/lib/ops/audit'

export async function getOpsAuditTrailAction(
  params: { limit?: number; search?: string; page?: number; pageSize?: number } = {},
): Promise<{
  rows:        AuditTrailRow[]
  total_count: number
  error:       string | null
}> {
  const auth = await requireAuth()
  if (!auth.ok) return { rows: [], total_count: 0, error: auth.error }
  const db = createServiceRoleClient()
  const ps  = params.pageSize ?? params.limit ?? 50
  const pg  = params.page ?? 1
  const from = (pg - 1) * ps
  const to   = from + ps - 1
  try {
    let query = db.from('ops_audit_trail').select('*', { count: 'exact' })
      .eq('business_id', auth.businessId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (params.search && params.search.length >= 3) {
      query = (query as ReturnType<typeof db.from>).textSearch('search_vector', params.search.trim(), { type: 'websearch', config: 'english' }) as typeof query
    } else if (params.search) {
      query = query.ilike('action', `%${params.search}%`)
    }

    let { data, count, error } = await query
    // Fallback to ilike if FTS column not yet migrated
    if (error && params.search && params.search.length >= 3) {
      const fb = await db.from('ops_audit_trail').select('*', { count: 'exact' })
        .eq('business_id', auth.businessId)
        .ilike('action', `%${params.search}%`)
        .order('created_at', { ascending: false })
        .range(from, to)
      data = fb.data; count = fb.count; error = fb.error
    }
    if (error) throw error
    return { rows: (data ?? []) as AuditTrailRow[], total_count: count ?? 0, error: null }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'audit_trail_error', business_id: auth.businessId })
    return { rows: [], total_count: 0, error: 'Could not load audit trail.' }
  }
}

// ── Phase 14: SLA check + escalation ─────────────────────────────

export async function runSlaCheckNow(): Promise<{
  checked: number; breached: number; escalated: number; notified: number; error?: string
}> {
  const auth = await requireAuth()
  if (!auth.ok) return { checked: 0, breached: 0, escalated: 0, notified: 0, error: auth.error }
  const db = createServiceRoleClient()
  try {
    const { processSlaBreaches } = await import('@/lib/ops/sla')
    const result = await processSlaBreaches(auth.businessId, db)
    return result
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'sla_check_error', business_id: auth.businessId })
    return { checked: 0, breached: 0, escalated: 0, notified: 0, error: 'SLA check failed.' }
  }
}

export async function getSlaDashboardSummary(): Promise<{
  summary: SlaSummary
  error:   string | null
}> {
  const auth = await requireAuth()
  if (!auth.ok) return { summary: { breached: 0, due_soon: 0, escalated: 0, on_track: 0 }, error: auth.error }
  const db = createServiceRoleClient()
  try {
    const { getSlaSummary } = await import('@/lib/ops/sla')
    const summary = await getSlaSummary(auth.businessId, db)
    return { summary, error: null }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'sla_summary_error', business_id: auth.businessId })
    return { summary: { breached: 0, due_soon: 0, escalated: 0, on_track: 0 }, error: null }
  }
}

// ── Phase 15: Automation Rule CRUD ────────────────────────────────

export async function createAutomationRule(
  data: import('@/lib/validation/ops').CreateAutomationRuleInput,
): Promise<{ id?: string; error?: string }> {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const db = createServiceRoleClient()
  try {
    const { data: row, error } = await db.from('ops_automation_rules').insert({
      business_id:                auth.businessId,
      created_by:                 auth.userId,
      name:                       data.name,
      description:                data.description ?? null,
      trigger_source:             data.trigger_source ?? null,
      trigger_event_type:         data.trigger_event_type ?? null,
      trigger_severity:           data.trigger_severity ?? null,
      action_type:                data.action_type,
      action_title_template:      data.action_title_template,
      action_description_template: data.action_description_template ?? null,
      priority:                   data.priority ?? 'normal',
      is_enabled:                 data.is_enabled ?? true,
      metadata:                   {},
    }).select('id').single()
    if (error) throw error
    const id = (row as { id: string }).id
    void import('@/lib/ops/audit').then(({ createOpsAuditLog }) =>
      createOpsAuditLog({ businessId: auth.businessId, actorUserId: auth.userId, action: 'automation_rule_created', targetTable: 'ops_automation_rules', targetId: id, afterState: { name: data.name } }, db)
    ).catch(() => undefined)
    return { id }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'create_rule_error', business_id: auth.businessId })
    return { error: 'Could not create automation rule.' }
  }
}

export async function updateAutomationRule(
  id: string,
  data: Partial<import('@/lib/validation/ops').CreateAutomationRuleInput>,
): Promise<{ success?: string; error?: string }> {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const db = createServiceRoleClient()
  try {
    const { error } = await db.from('ops_automation_rules')
      .update({ ...data, updated_by: auth.userId })
      .eq('id', id).eq('business_id', auth.businessId).is('deleted_at', null)
    if (error) throw error
    void import('@/lib/ops/audit').then(({ createOpsAuditLog }) =>
      createOpsAuditLog({ businessId: auth.businessId, actorUserId: auth.userId, action: 'automation_rule_updated', targetTable: 'ops_automation_rules', targetId: id }, db)
    ).catch(() => undefined)
    return { success: 'Rule updated.' }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'update_rule_error', business_id: auth.businessId })
    return { error: 'Could not update automation rule.' }
  }
}

export async function deleteAutomationRule(id: string): Promise<{ success?: string; error?: string }> {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const db = createServiceRoleClient()
  try {
    await db.from('ops_automation_rules')
      .update({ deleted_at: new Date().toISOString(), updated_by: auth.userId })
      .eq('id', id).eq('business_id', auth.businessId)
    void import('@/lib/ops/audit').then(({ createOpsAuditLog }) =>
      createOpsAuditLog({ businessId: auth.businessId, actorUserId: auth.userId, action: 'automation_rule_deleted', targetTable: 'ops_automation_rules', targetId: id }, db)
    ).catch(() => undefined)
    return { success: 'Rule deleted.' }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'delete_rule_error', business_id: auth.businessId })
    return { error: 'Could not delete automation rule.' }
  }
}

export async function duplicateAutomationRule(id: string): Promise<{ newId?: string; error?: string }> {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const db = createServiceRoleClient()
  try {
    const { data: orig } = await db.from('ops_automation_rules').select('*').eq('id', id).eq('business_id', auth.businessId).single()
    if (!orig) return { error: 'Rule not found.' }
    const r = orig as DbRow
    const { data: row, error } = await db.from('ops_automation_rules').insert({
      business_id:                auth.businessId,
      created_by:                 auth.userId,
      name:                       `Copy of ${r.name as string}`,
      description:                r.description,
      trigger_source:             r.trigger_source,
      trigger_event_type:         r.trigger_event_type,
      trigger_severity:           r.trigger_severity,
      action_type:                r.action_type,
      action_title_template:      r.action_title_template,
      action_description_template: r.action_description_template,
      priority:                   r.priority,
      is_enabled:                 false,
      metadata:                   {},
    }).select('id').single()
    if (error) throw error
    return { newId: (row as { id: string }).id }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'duplicate_rule_error', business_id: auth.businessId })
    return { error: 'Could not duplicate rule.' }
  }
}

// ── Phase 15: SLA Policy CRUD ─────────────────────────────────────

export async function createSlaPolicy(
  data: import('@/lib/validation/ops').CreateSlaPolicyInput,
): Promise<{ id?: string; error?: string }> {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const db = createServiceRoleClient()
  try {
    const { data: row, error } = await db.from('ops_sla_policies').insert({
      business_id:        auth.businessId,
      created_by:         auth.userId,
      name:               data.name,
      target_type:        data.target_type,
      source:             data.source ?? null,
      severity:           data.severity ?? null,
      priority:           data.priority ?? null,
      response_minutes:   data.response_minutes,
      escalation_minutes: data.escalation_minutes ?? null,
      is_enabled:         data.is_enabled ?? true,
      metadata:           {},
    }).select('id').single()
    if (error) throw error
    const id = (row as { id: string }).id
    void import('@/lib/ops/audit').then(({ createOpsAuditLog }) =>
      createOpsAuditLog({ businessId: auth.businessId, actorUserId: auth.userId, action: 'sla_policy_created', targetTable: 'ops_sla_policies', targetId: id, afterState: { name: data.name } }, db)
    ).catch(() => undefined)
    return { id }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'create_sla_error', business_id: auth.businessId })
    return { error: 'Could not create SLA policy.' }
  }
}

export async function updateSlaPolicy(
  id: string,
  data: Partial<import('@/lib/validation/ops').CreateSlaPolicyInput>,
): Promise<{ success?: string; error?: string }> {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const db = createServiceRoleClient()
  try {
    await db.from('ops_sla_policies')
      .update({ ...data, updated_by: auth.userId })
      .eq('id', id).eq('business_id', auth.businessId).is('deleted_at', null)
    void import('@/lib/ops/audit').then(({ createOpsAuditLog }) =>
      createOpsAuditLog({ businessId: auth.businessId, actorUserId: auth.userId, action: 'sla_policy_updated', targetTable: 'ops_sla_policies', targetId: id }, db)
    ).catch(() => undefined)
    return { success: 'SLA policy updated.' }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'update_sla_error', business_id: auth.businessId })
    return { error: 'Could not update SLA policy.' }
  }
}

export async function deleteSlaPolicy(id: string): Promise<{ success?: string; error?: string }> {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const db = createServiceRoleClient()
  try {
    await db.from('ops_sla_policies')
      .update({ deleted_at: new Date().toISOString(), updated_by: auth.userId })
      .eq('id', id).eq('business_id', auth.businessId)
    void import('@/lib/ops/audit').then(({ createOpsAuditLog }) =>
      createOpsAuditLog({ businessId: auth.businessId, actorUserId: auth.userId, action: 'sla_policy_deleted', targetTable: 'ops_sla_policies', targetId: id }, db)
    ).catch(() => undefined)
    return { success: 'SLA policy deleted.' }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'delete_sla_error', business_id: auth.businessId })
    return { error: 'Could not delete SLA policy.' }
  }
}

// ── Phase 15: Notification Rule CRUD ─────────────────────────────

export async function createNotificationRule(
  data: import('@/lib/validation/ops').CreateNotificationRuleInput,
): Promise<{ id?: string; error?: string }> {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const db = createServiceRoleClient()
  try {
    const { data: row, error } = await db.from('ops_notification_rules').insert({
      business_id:       auth.businessId,
      created_by:        auth.userId,
      name:              data.name,
      description:       data.description ?? null,
      trigger_type:      data.trigger_type,
      source:            data.source ?? null,
      severity:          data.severity ?? null,
      priority:          data.priority ?? null,
      channel:           data.channel ?? 'email',
      recipient_type:    data.recipient_type ?? 'owner',
      recipient_user_id: data.recipient_user_id ?? null,
      recipient_email:   data.recipient_email ?? null,
      delay_minutes:     data.delay_minutes ?? 0,
      is_enabled:        data.is_enabled ?? true,
      metadata:          {},
    }).select('id').single()
    if (error) throw error
    const id = (row as { id: string }).id
    void import('@/lib/ops/audit').then(({ createOpsAuditLog }) =>
      createOpsAuditLog({ businessId: auth.businessId, actorUserId: auth.userId, action: 'notification_rule_created', targetTable: 'ops_notification_rules', targetId: id, afterState: { name: data.name } }, db)
    ).catch(() => undefined)
    return { id }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'create_notif_rule_error', business_id: auth.businessId })
    return { error: 'Could not create notification rule.' }
  }
}

export async function updateNotificationRule(
  id: string,
  data: Partial<import('@/lib/validation/ops').CreateNotificationRuleInput>,
): Promise<{ success?: string; error?: string }> {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const db = createServiceRoleClient()
  try {
    await db.from('ops_notification_rules')
      .update({ ...data, updated_by: auth.userId })
      .eq('id', id).eq('business_id', auth.businessId).is('deleted_at', null)
    void import('@/lib/ops/audit').then(({ createOpsAuditLog }) =>
      createOpsAuditLog({ businessId: auth.businessId, actorUserId: auth.userId, action: 'notification_rule_updated', targetTable: 'ops_notification_rules', targetId: id }, db)
    ).catch(() => undefined)
    return { success: 'Notification rule updated.' }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'update_notif_rule_error', business_id: auth.businessId })
    return { error: 'Could not update notification rule.' }
  }
}

export async function deleteNotificationRule(id: string): Promise<{ success?: string; error?: string }> {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const db = createServiceRoleClient()
  try {
    await db.from('ops_notification_rules')
      .update({ deleted_at: new Date().toISOString(), updated_by: auth.userId })
      .eq('id', id).eq('business_id', auth.businessId)
    void import('@/lib/ops/audit').then(({ createOpsAuditLog }) =>
      createOpsAuditLog({ businessId: auth.businessId, actorUserId: auth.userId, action: 'notification_rule_deleted', targetTable: 'ops_notification_rules', targetId: id }, db)
    ).catch(() => undefined)
    return { success: 'Notification rule deleted.' }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'delete_notif_rule_error', business_id: auth.businessId })
    return { error: 'Could not delete notification rule.' }
  }
}

// ── Phase 15: Export history ──────────────────────────────────────

export interface OpsExportRow {
  id:                string
  business_id:       string
  export_type:       string
  format:            string
  status:            string
  requested_by:      string | null
  filters:           Record<string, unknown>
  sanitized_filters: Record<string, unknown>
  row_count:         number
  created_at:        string
  completed_at:      string | null
}

export async function getOpsExports(
  params: { limit?: number; page?: number; pageSize?: number } = {},
): Promise<{
  exports:     OpsExportRow[]
  total_count: number
  error:       string | null
}> {
  const auth = await requireAuth()
  if (!auth.ok) return { exports: [], total_count: 0, error: auth.error }
  const db  = createServiceRoleClient()
  const ps  = params.pageSize ?? params.limit ?? 20
  const pg  = params.page ?? 1
  const from = (pg - 1) * ps
  const to   = from + ps - 1
  try {
    const { data, count, error } = await db
      .from('ops_exports').select('*', { count: 'exact' })
      .eq('business_id', auth.businessId)
      .order('created_at', { ascending: false })
      .range(from, to)
    if (error) throw error
    return { exports: (data ?? []) as OpsExportRow[], total_count: count ?? 0, error: null }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'get_exports_error', business_id: auth.businessId })
    return { exports: [], total_count: 0, error: 'Could not load export history.' }
  }
}

// ── Phase 16: Snooze actions ──────────────────────────────────────

export async function snoozeOpsItem(params: {
  table:         'ops_events' | 'ops_alerts' | 'ops_tasks' | 'approval_items'
  target_id:     string
  snoozed_until: string
  snooze_reason?: string
}): Promise<{ success?: string; error?: string }> {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const db = createServiceRoleClient()

  // Max 30-day snooze
  const maxDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  if (params.snoozed_until > maxDate) return { error: 'Snooze cannot exceed 30 days.' }

  try {
    await db.from(params.table).update({
      snoozed_until: params.snoozed_until,
      snooze_reason: params.snooze_reason ?? null,
    }).eq('id', params.target_id).eq('business_id', auth.businessId)

    void import('@/lib/ops/audit').then(({ createOpsAuditLog }) =>
      createOpsAuditLog({ businessId: auth.businessId, actorUserId: auth.userId, action: 'item_snoozed', targetTable: params.table, targetId: params.target_id, afterState: { snoozed_until: params.snoozed_until } }, db)
    ).catch(() => undefined)

    return { success: 'Item snoozed.' }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'snooze_error', business_id: auth.businessId })
    return { error: 'Could not snooze item.' }
  }
}

export async function unsnoozeOpsItem(
  table: 'ops_events' | 'ops_alerts' | 'ops_tasks' | 'approval_items',
  id:    string,
): Promise<{ success?: string; error?: string }> {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const db = createServiceRoleClient()
  try {
    await db.from(table).update({ snoozed_until: null, snooze_reason: null })
      .eq('id', id).eq('business_id', auth.businessId)
    void import('@/lib/ops/audit').then(({ createOpsAuditLog }) =>
      createOpsAuditLog({ businessId: auth.businessId, actorUserId: auth.userId, action: 'item_unsnoozed', targetTable: table, targetId: id }, db)
    ).catch(() => undefined)
    return { success: 'Item unsnoozed.' }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'unsnooze_error', business_id: auth.businessId })
    return { error: 'Could not unsnooze item.' }
  }
}

export async function bulkSnoozeOpsItems(
  table:    'ops_events' | 'ops_alerts' | 'ops_tasks' | 'approval_items',
  ids:      string[],
  snoozedUntil: string,
): Promise<{ updated: number; error?: string }> {
  if (!ids.length || ids.length > 50) return { updated: 0, error: 'Select 1–50 items.' }
  const auth = await requireAuth()
  if (!auth.ok) return { updated: 0, error: auth.error }
  const db = createServiceRoleClient()
  try {
    const { data } = await db.from(table)
      .update({ snoozed_until: snoozedUntil })
      .in('id', ids).eq('business_id', auth.businessId).select('id')
    return { updated: (data ?? []).length }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'bulk_snooze_error', business_id: auth.businessId })
    return { updated: 0, error: 'Bulk snooze failed.' }
  }
}

// ── Phase 16: Automation retry ────────────────────────────────────

export async function retryOpsEventAutomation(eventId: string): Promise<{ success?: string; error?: string }> {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const db = createServiceRoleClient()
  try {
    // Reset processed_at so it gets re-processed
    await db.from('ops_events')
      .update({ processed_at: null, automation_status: 'retrying', processing_error: null })
      .eq('id', eventId).eq('business_id', auth.businessId)

    // Fire automation (fire-and-forget)
    void import('@/lib/ops/automation').then(({ processOpsEvent }) =>
      processOpsEvent(eventId, db)
    ).catch(() => undefined)

    return { success: 'Automation retry queued.' }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'automation_retry_error', business_id: auth.businessId })
    return { error: 'Could not retry automation.' }
  }
}

// ── Phase 16: Production launch checks ───────────────────────────

export interface LaunchCheck {
  id:             string
  business_id:    string
  check_key:      string
  category:       string
  title:          string
  description:    string | null
  status:         string
  severity:       string
  result_summary: string | null
  last_checked_at: string | null
  metadata:       Record<string, unknown>
  created_at:     string
  updated_at:     string
}

const LAUNCH_CHECKS_DEF: Array<{
  key:         string
  category:    string
  title:       string
  description: string
  severity:    'low' | 'normal' | 'high' | 'critical'
  check:       () => boolean
}> = [
  { key: 'anthropic_key',   category: 'AI',          title: 'Anthropic API key',         description: 'ANTHROPIC_API_KEY is set.',           severity: 'critical', check: () => !!process.env.ANTHROPIC_API_KEY },
  { key: 'supabase_svc',    category: 'Database',    title: 'Supabase service role key',  description: 'SUPABASE_SERVICE_ROLE_KEY is set.',   severity: 'critical', check: () => !!process.env.SUPABASE_SERVICE_ROLE_KEY },
  { key: 'stripe_key',      category: 'Billing',     title: 'Stripe secret key',         description: 'STRIPE_SECRET_KEY is set.',           severity: 'high',     check: () => !!process.env.STRIPE_SECRET_KEY },
  { key: 'stripe_webhook',  category: 'Billing',     title: 'Stripe webhook secret',     description: 'STRIPE_WEBHOOK_SECRET is set.',       severity: 'high',     check: () => !!process.env.STRIPE_WEBHOOK_SECRET },
  { key: 'resend_key',      category: 'Email',       title: 'Resend API key',            description: 'RESEND_API_KEY is set.',             severity: 'normal',   check: () => !!process.env.RESEND_API_KEY },
  { key: 'meta_token',      category: 'WhatsApp',    title: 'Meta access token',         description: 'META_ACCESS_TOKEN is set.',          severity: 'normal',   check: () => !!process.env.META_ACCESS_TOKEN },
  { key: 'relevance_key',   category: 'Agents',      title: 'Relevance AI API key',      description: 'RELEVANCE_API_KEY is set.',          severity: 'normal',   check: () => !!process.env.RELEVANCE_API_KEY },
  { key: 'sentry_dsn',      category: 'Monitoring',  title: 'Sentry DSN',                description: 'NEXT_PUBLIC_SENTRY_DSN is set.',     severity: 'normal',   check: () => !!process.env.NEXT_PUBLIC_SENTRY_DSN },
  { key: 'posthog_key',     category: 'Analytics',   title: 'PostHog key',               description: 'NEXT_PUBLIC_POSTHOG_KEY is set.',    severity: 'low',      check: () => !!process.env.NEXT_PUBLIC_POSTHOG_KEY },
  { key: 'cron_secret',     category: 'Cron',        title: 'Ops cron secret',           description: 'OPS_CRON_SECRET is set.',            severity: 'normal',   check: () => !!process.env.OPS_CRON_SECRET },
  { key: 'calcom_key',      category: 'Bookings',    title: 'Cal.com API key',           description: 'CALCOM_API_KEY is set.',             severity: 'normal',   check: () => !!process.env.CALCOM_API_KEY },
  { key: 'app_url',         category: 'Config',      title: 'App URL configured',        description: 'NEXT_PUBLIC_APP_URL is set.',        severity: 'high',     check: () => !!process.env.NEXT_PUBLIC_APP_URL },
  { key: 'upstash_redis',   category: 'Rate Limit',  title: 'Upstash Redis configured',  description: 'UPSTASH_REDIS_REST_URL is set.',     severity: 'normal',   check: () => !!process.env.UPSTASH_REDIS_REST_URL },
]

export async function runProductionLaunchChecks(
  createTasksForFailures = false,
): Promise<{ checks: LaunchCheck[]; error: string | null }> {
  const auth = await requireAuth()
  if (!auth.ok) return { checks: [], error: auth.error }
  const db = createServiceRoleClient()

  const now = new Date().toISOString()
  const results: LaunchCheck[] = []

  try {
    for (const def of LAUNCH_CHECKS_DEF) {
      const passed = def.check()
      const status = passed ? 'passed' : def.severity === 'critical' ? 'failed' : 'warning'
      const summary = passed ? 'Configured' : 'Not configured'

      // Upsert check result
      await db.from('ops_launch_checks').upsert(
        {
          business_id:     auth.businessId,
          check_key:       def.key,
          category:        def.category,
          title:           def.title,
          description:     def.description,
          status,
          severity:        def.severity,
          result_summary:  summary,
          last_checked_at: now,
        },
        { onConflict: 'business_id,check_key' },
      )

      // Create ops_task for critical failures if requested
      if (!passed && createTasksForFailures && (def.severity === 'critical' || def.severity === 'high')) {
        void import('@/lib/ops/events').then(({ createOpsTask }) =>
          createOpsTask({ business_id: auth.businessId, title: `Configure: ${def.title}`, description: def.description, task_type: 'launch_check', priority: def.severity === 'critical' ? 'urgent' : 'high', metadata: { check_key: def.key } }, db)
        ).catch(() => undefined)
      }

      results.push({
        id: `${auth.businessId}_${def.key}`,
        business_id: auth.businessId,
        check_key: def.key,
        category: def.category,
        title: def.title,
        description: def.description,
        status,
        severity: def.severity,
        result_summary: summary,
        last_checked_at: now,
        metadata: {},
        created_at: now,
        updated_at: now,
      })
    }

    return { checks: results, error: null }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'launch_check_error', business_id: auth.businessId })
    return { checks: results, error: 'Some checks could not complete.' }
  }
}

export async function getProductionLaunchChecks(): Promise<{ checks: LaunchCheck[]; error: string | null }> {
  const auth = await requireAuth()
  if (!auth.ok) return { checks: [], error: auth.error }
  const db = createServiceRoleClient()
  try {
    const { data, error } = await db
      .from('ops_launch_checks').select('*')
      .eq('business_id', auth.businessId)
      .order('severity', { ascending: false })
    if (error) throw error
    return { checks: (data ?? []) as LaunchCheck[], error: null }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'get_checks_error', business_id: auth.businessId })
    return { checks: [], error: 'Could not load launch checks.' }
  }
}

// ── Phase 15: Bulk assignment to team member ──────────────────────

export async function bulkAssignOpsItems(
  table:      'ops_events' | 'ops_tasks' | 'ops_alerts' | 'approval_items',
  ids:        string[],
  assignedTo: string | null,
): Promise<{ updated: number; error?: string }> {
  if (!ids.length || ids.length > 50) return { updated: 0, error: 'Select 1–50 items.' }
  if (!ids.every((id) => UUID_RE.test(id))) return { updated: 0, error: 'Invalid IDs.' }
  if (assignedTo && !UUID_RE.test(assignedTo)) return { updated: 0, error: 'Invalid assignee.' }

  const auth = await requireAuth()
  if (!auth.ok) return { updated: 0, error: auth.error }

  const db = createServiceRoleClient()

  // Validate assignee is a business member (if assigning)
  if (assignedTo) {
    const { data: membership } = await db
      .from('business_members').select('user_id')
      .eq('business_id', auth.businessId).eq('user_id', assignedTo).single()
    if (!membership) return { updated: 0, error: 'Assignee is not a member of this business.' }
  }

  try {
    let assignedUserName: string | null = null
    if (assignedTo) {
      const { data: profile } = await db.from('profiles').select('email, full_name').eq('id', assignedTo).single()
      const p = profile as { email?: string; full_name?: string } | null
      assignedUserName = p?.full_name ?? p?.email ?? null
    }

    const { data, error } = await db.from(table)
      .update({ assigned_to: assignedTo, assigned_user_name: assignedUserName })
      .in('id', ids).eq('business_id', auth.businessId).select('id')
    if (error) throw error

    // Audit
    void import('@/lib/ops/audit').then(({ auditBulkAction }) =>
      auditBulkAction({ businessId: auth.businessId, userId: auth.userId, table, action: assignedTo ? 'bulk_assigned' : 'bulk_unassigned', count: (data ?? []).length, db })
    ).catch(() => undefined)

    // Notify assigned user (fire-and-forget)
    if (assignedTo) {
      void import('@/lib/ops/notifications').then(({ notifyAssignedUser }) =>
        notifyAssignedUser({ userId: assignedTo, title: `${ids.length} item${ids.length !== 1 ? 's' : ''} assigned to you`, description: null, section: 'activity', businessId: auth.businessId, db })
      ).catch(() => undefined)
    }

    return { updated: (data ?? []).length }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'bulk_assign_error', business_id: auth.businessId })
    return { updated: 0, error: 'Bulk assignment failed.' }
  }
}

// ── Phase 17: Ops cron run history ────────────────────────────────

export interface OpsCronRun {
  id:                  string
  business_id:         string | null
  job_name:            string
  status:              string
  checked_count:       number
  breached_count:      number
  escalated_count:     number
  notified_count:      number
  failed_count:        number | null
  skipped_count:       number | null
  error_message:       string | null
  duration_ms:         number | null
  trigger_source:      string | null
  cron_secret_type:    string | null
  verification_method: string | null
  request_source:      string | null
  businesses_checked:  number
  metadata:            Record<string, unknown>
  started_at:          string
  completed_at:        string | null
}

export async function getOpsCronRuns(params: {
  page?:      number
  pageSize?:  number
  status?:    string
  date_from?: string
  date_to?:   string
  search?:    string
} = {}): Promise<PaginatedOpsResult<OpsCronRun>> {
  const auth = await requireAuth()
  if (!auth.ok) return emptyPage(auth.error)
  const db  = createServiceRoleClient()
  const ps  = params.pageSize ?? 15
  const pg  = params.page ?? 1
  const from = (pg - 1) * ps
  const to   = from + ps - 1

  try {
    let query = db.from('ops_cron_runs').select('*', { count: 'exact' })
      .or(`business_id.eq.${auth.businessId},business_id.is.null`)
      .order('started_at', { ascending: false })
      .range(from, to)

    if (params.status)    query = query.eq('status', params.status)
    if (params.date_from) query = query.gte('started_at', params.date_from)
    if (params.date_to)   query = query.lte('started_at', params.date_to)

    if (params.search && params.search.length >= 3) {
      query = (query as ReturnType<typeof db.from>).textSearch('search_vector', params.search.trim(), { type: 'websearch', config: 'english' }) as typeof query
    } else if (params.search) {
      query = query.ilike('job_name', `%${params.search}%`)
    }

    let { data, count, error } = await query
    if (error && params.search && params.search.length >= 3) {
      const fb = await db.from('ops_cron_runs').select('*', { count: 'exact' })
        .or(`business_id.eq.${auth.businessId},business_id.is.null`)
        .ilike('job_name', `%${params.search}%`)
        .order('started_at', { ascending: false }).range(from, to)
      data = fb.data; count = fb.count; error = fb.error
    }
    if (error) throw error
    const total = count ?? 0
    return { rows: (data ?? []) as OpsCronRun[], total_count: total, page: pg, pageSize: ps, has_next: from + ps < total, has_previous: pg > 1, error: null }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'cron_history_error', business_id: auth.businessId })
    return emptyPage('Could not load cron history.')
  }
}

// ── Phase 17: Notification rule CRUD update for new fields ────────

export async function updateNotificationRuleTemplates(
  id:      string,
  subject: string | null,
  body:    string | null,
): Promise<{ success?: string; error?: string }> {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }

  // Validate templates server-side
  const { validateNotificationTemplate } = await import('@/lib/ops/notifications')
  if (subject) {
    const err = validateNotificationTemplate(subject, 256)
    if (err) return { error: `Subject: ${err}` }
  }
  if (body) {
    const err = validateNotificationTemplate(body, 2000)
    if (err) return { error: `Body: ${err}` }
  }

  const db = createServiceRoleClient()
  try {
    await db.from('ops_notification_rules').update({
      email_subject_template: subject ?? null,
      email_body_template:    body    ?? null,
      updated_by:             auth.userId,
    }).eq('id', id).eq('business_id', auth.businessId)
    return { success: 'Templates saved.' }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'template_save_error', business_id: auth.businessId })
    return { error: 'Could not save templates.' }
  }
}

export async function updateNotificationRuleRecipients(
  id:              string,
  recipientUserIds: string[],
  recipientEmails: string[],
): Promise<{ success?: string; error?: string }> {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }

  if (recipientUserIds.length + recipientEmails.length > 10) {
    return { error: 'Maximum 10 recipients allowed.' }
  }

  // Validate all user IDs are business members
  if (recipientUserIds.length > 0) {
    const db = createServiceRoleClient()
    const { data: members } = await db
      .from('business_members').select('user_id')
      .eq('business_id', auth.businessId)
      .in('user_id', recipientUserIds)
    const validIds = new Set(((members ?? []) as DbRow[]).map((m) => m.user_id as string))
    const invalid = recipientUserIds.filter((id) => !validIds.has(id))
    if (invalid.length > 0) return { error: 'Some selected users are not business members.' }
  }

  const db = createServiceRoleClient()
  try {
    await db.from('ops_notification_rules').update({
      recipient_user_ids: recipientUserIds,
      recipient_emails:   recipientEmails,
      updated_by:         auth.userId,
    }).eq('id', id).eq('business_id', auth.businessId)
    return { success: 'Recipients updated.' }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'recipients_save_error', business_id: auth.businessId })
    return { error: 'Could not update recipients.' }
  }
}

// ── Phase 17: Mark notification as dry-run ────────────────────────

export async function markNotificationDryRun(
  ruleId: string,
  status: 'success' | 'failed',
  error?: string,
): Promise<void> {
  const auth = await requireAuth()
  if (!auth.ok) return
  const db = createServiceRoleClient()
  try {
    await db.from('ops_notification_rules').update({
      last_dry_run_at:     new Date().toISOString(),
      last_dry_run_status: status,
      last_dry_run_error:  error ?? null,
    }).eq('id', ruleId).eq('business_id', auth.businessId)
  } catch { /* silent */ }
}

// ── Phase 18: Notification preview history ────────────────────────

export interface NotificationPreviewRow {
  id:                     string
  business_id:            string | null
  notification_rule_id:   string | null
  preview_type:           string
  source_rule_name:       string | null
  rendered_with_template: boolean
  dry_run_status:         string | null
  subject_preview:        string | null
  recipient_preview:      string | null
  created_at:             string
  exported_at:            string | null
  export_format:          string | null
}

export async function getNotificationPreviewHistory(params: {
  page?:         number
  pageSize?:     number
  rule_id?:      string
  preview_type?: string
  date_from?:    string
  date_to?:      string
  search?:       string
} = {}): Promise<PaginatedOpsResult<NotificationPreviewRow>> {
  const auth = await requireAuth()
  if (!auth.ok) return emptyPage(auth.error)
  const db  = createServiceRoleClient()
  const ps  = params.pageSize ?? 15
  const pg  = params.page ?? 1
  const from = (pg - 1) * ps
  const to   = from + ps - 1

  try {
    let query = db.from('ops_notification_previews')
      .select('id,business_id,notification_rule_id,preview_type,source_rule_name,rendered_with_template,dry_run_status,subject_preview,recipient_preview,created_at,exported_at,export_format', { count: 'exact' })
      .eq('business_id', auth.businessId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (params.rule_id)      query = query.eq('notification_rule_id', params.rule_id)
    if (params.preview_type) query = query.eq('preview_type', params.preview_type)
    if (params.date_from)    query = query.gte('created_at', params.date_from)
    if (params.date_to)      query = query.lte('created_at', params.date_to)

    if (params.search && params.search.length >= 3) {
      query = (query as ReturnType<typeof db.from>).textSearch('search_vector', params.search.trim(), { type: 'websearch', config: 'english' }) as typeof query
    } else if (params.search) {
      query = query.ilike('source_rule_name', `%${params.search}%`)
    }

    let { data, count, error } = await query
    if (error && params.search && params.search.length >= 3) {
      const fb = await db.from('ops_notification_previews')
        .select('id,business_id,notification_rule_id,preview_type,source_rule_name,rendered_with_template,dry_run_status,subject_preview,recipient_preview,created_at,exported_at,export_format', { count: 'exact' })
        .eq('business_id', auth.businessId)
        .ilike('source_rule_name', `%${params.search}%`)
        .order('created_at', { ascending: false }).range(from, to)
      data = fb.data; count = fb.count; error = fb.error
    }
    if (error) throw error
    const total = count ?? 0
    return { rows: (data ?? []) as NotificationPreviewRow[], total_count: total, page: pg, pageSize: ps, has_next: from + ps < total, has_previous: pg > 1, error: null }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'preview_history_error', business_id: auth.businessId })
    return emptyPage('Could not load preview history.')
  }
}

// ── Phase 18: Export history (searchable, paginated) ─────────────

// ── Phase 19: Notification delivery logs ─────────────────────────

export interface NotificationDeliveryLog {
  id:                      string
  business_id:             string | null
  notification_rule_id:    string | null
  recipient_type:          string | null
  recipient_masked:        string | null
  delivery_channel:        string
  delivery_status:         string
  provider:                string
  provider_message_id:     string | null
  attempt_count:           number
  last_attempt_at:         string | null
  next_retry_at:           string | null
  scheduled_for:           string | null
  sent_at:                 string | null
  failed_at:               string | null
  error_summary:           string | null
  created_at:              string
  updated_at:              string
}

export async function getNotificationDeliveryLogsAction(params: {
  page?:            number
  pageSize?:        number
  delivery_status?: string
  rule_id?:         string
  search?:          string
  date_from?:       string
  date_to?:         string
} = {}): Promise<PaginatedOpsResult<NotificationDeliveryLog>> {
  const auth = await requireAuth()
  if (!auth.ok) return emptyPage(auth.error)
  const db  = createServiceRoleClient()
  const ps  = params.pageSize ?? 15
  const pg  = params.page ?? 1
  const from = (pg - 1) * ps
  const to   = from + ps - 1

  try {
    let query = db.from('notification_delivery_logs')
      .select('id,business_id,notification_rule_id,recipient_type,recipient_masked,delivery_channel,delivery_status,provider,provider_message_id,attempt_count,last_attempt_at,next_retry_at,scheduled_for,sent_at,failed_at,error_summary,created_at,updated_at', { count: 'exact' })
      .eq('business_id', auth.businessId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (params.delivery_status) query = query.eq('delivery_status', params.delivery_status)
    if (params.rule_id)         query = query.eq('notification_rule_id', params.rule_id)
    if (params.date_from)       query = query.gte('created_at', params.date_from)
    if (params.date_to)         query = query.lte('created_at', params.date_to)

    if (params.search && params.search.length >= 3) {
      query = (query as ReturnType<typeof db.from>).textSearch('search_vector', params.search.trim(), { type: 'websearch', config: 'english' }) as typeof query
    } else if (params.search) {
      query = query.ilike('delivery_status', `%${params.search}%`)
    }

    let { data, count, error } = await query
    if (error && params.search && params.search.length >= 3) {
      const fb = await db.from('notification_delivery_logs')
        .select('id,business_id,notification_rule_id,recipient_type,recipient_masked,delivery_channel,delivery_status,provider,provider_message_id,attempt_count,last_attempt_at,next_retry_at,scheduled_for,sent_at,failed_at,error_summary,created_at,updated_at', { count: 'exact' })
        .eq('business_id', auth.businessId)
        .ilike('delivery_status', `%${params.search}%`)
        .order('created_at', { ascending: false }).range(from, to)
      data = fb.data; count = fb.count; error = fb.error
    }
    if (error) throw error
    const total = count ?? 0
    return { rows: (data ?? []) as NotificationDeliveryLog[], total_count: total, page: pg, pageSize: ps, has_next: from + ps < total, has_previous: pg > 1, error: null }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'delivery_logs_error', business_id: auth.businessId })
    return emptyPage('Could not load delivery logs.')
  }
}

export async function retryNotificationDeliveryAction(
  deliveryLogId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const db = createServiceRoleClient()
  try {
    const { retryNotificationDelivery } = await import('@/lib/ops/notification-delivery')
    const result = await retryNotificationDelivery({ logId: deliveryLogId, businessId: auth.businessId, db })
    return result
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'retry_delivery_error', business_id: auth.businessId })
    return { error: 'Retry failed.' }
  }
}

export async function processPendingNotificationsAction(): Promise<{
  processed: number; sent: number; failed: number; skipped: number; error?: string
}> {
  const auth = await requireAuth()
  if (!auth.ok) return { processed: 0, sent: 0, failed: 0, skipped: 0, error: auth.error }
  const db = createServiceRoleClient()
  try {
    const { processPendingNotifications } = await import('@/lib/ops/notification-delivery')
    return await processPendingNotifications(auth.businessId, db)
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'process_pending_error', business_id: auth.businessId })
    return { processed: 0, sent: 0, failed: 0, skipped: 0, error: 'Processing failed.' }
  }
}

// ── Phase 19: Webhook delivery logs ──────────────────────────────

export interface WebhookDeliveryLog {
  id:                  string
  business_id:         string | null
  provider:            string
  route_path:          string
  event_type:          string | null
  verification_status: string | null
  processing_status:   string
  status_code:         number | null
  duration_ms:         number | null
  request_id:          string | null
  external_event_id:   string | null
  error_summary:       string | null
  safe_summary:        string | null
  received_at:         string
  processed_at:        string | null
}

export async function getWebhookDeliveryLogsAction(params: {
  page?:                number
  pageSize?:            number
  provider?:            string
  verification_status?: string
  processing_status?:   string
  search?:              string
  date_from?:           string
  date_to?:             string
} = {}): Promise<PaginatedOpsResult<WebhookDeliveryLog>> {
  const auth = await requireAuth()
  if (!auth.ok) return emptyPage(auth.error)
  const db  = createServiceRoleClient()
  const ps  = params.pageSize ?? 20
  const pg  = params.page ?? 1
  const from = (pg - 1) * ps
  const to   = from + ps - 1

  try {
    let query = db.from('webhook_delivery_logs')
      .select('id,business_id,provider,route_path,event_type,verification_status,processing_status,status_code,duration_ms,request_id,external_event_id,error_summary,safe_summary,received_at,processed_at', { count: 'exact' })
      .or(`business_id.eq.${auth.businessId},business_id.is.null`)
      .order('received_at', { ascending: false })
      .range(from, to)

    if (params.provider)             query = query.eq('provider', params.provider)
    if (params.verification_status)  query = query.eq('verification_status', params.verification_status)
    if (params.processing_status)    query = query.eq('processing_status', params.processing_status)
    if (params.date_from)            query = query.gte('received_at', params.date_from)
    if (params.date_to)              query = query.lte('received_at', params.date_to)

    if (params.search && params.search.length >= 3) {
      query = (query as ReturnType<typeof db.from>).textSearch('search_vector', params.search.trim(), { type: 'websearch', config: 'english' }) as typeof query
    } else if (params.search) {
      query = query.ilike('provider', `%${params.search}%`)
    }

    let { data, count, error } = await query
    if (error && params.search && params.search.length >= 3) {
      const fb = await db.from('webhook_delivery_logs')
        .select('id,business_id,provider,route_path,event_type,verification_status,processing_status,status_code,duration_ms,request_id,external_event_id,error_summary,safe_summary,received_at,processed_at', { count: 'exact' })
        .or(`business_id.eq.${auth.businessId},business_id.is.null`)
        .ilike('provider', `%${params.search}%`)
        .order('received_at', { ascending: false }).range(from, to)
      data = fb.data; count = fb.count; error = fb.error
    }
    if (error) throw error
    const total = count ?? 0
    return { rows: (data ?? []) as WebhookDeliveryLog[], total_count: total, page: pg, pageSize: ps, has_next: from + ps < total, has_previous: pg > 1, error: null }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'webhook_logs_error', business_id: auth.businessId })
    return emptyPage('Could not load webhook logs.')
  }
}

export async function getOpsExportHistory(params: {
  page?:     number
  pageSize?: number
  search?:   string
  format?:   string
  status?:   string
} = {}): Promise<PaginatedOpsResult<Record<string, unknown>>> {
  const auth = await requireAuth()
  if (!auth.ok) return emptyPage(auth.error)
  const db  = createServiceRoleClient()
  const ps  = params.pageSize ?? 15
  const pg  = params.page ?? 1
  const from = (pg - 1) * ps
  const to   = from + ps - 1

  try {
    let query = db.from('ops_exports')
      .select('id,business_id,export_type,format,status,row_count,source_table,created_at', { count: 'exact' })
      .eq('business_id', auth.businessId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (params.format) query = query.eq('format', params.format)
    if (params.status) query = query.eq('status', params.status)

    if (params.search && params.search.length >= 3) {
      query = (query as ReturnType<typeof db.from>).textSearch('search_vector', params.search.trim(), { type: 'websearch', config: 'english' }) as typeof query
    } else if (params.search) {
      query = query.ilike('export_type', `%${params.search}%`)
    }

    let { data, count, error } = await query
    if (error && params.search && params.search.length >= 3) {
      const fb = await db.from('ops_exports')
        .select('id,business_id,export_type,format,status,row_count,source_table,created_at', { count: 'exact' })
        .eq('business_id', auth.businessId)
        .ilike('export_type', `%${params.search}%`)
        .order('created_at', { ascending: false }).range(from, to)
      data = fb.data; count = fb.count; error = fb.error
    }
    if (error) throw error
    const total = count ?? 0
    return { rows: (data ?? []) as Record<string, unknown>[], total_count: total, page: pg, pageSize: ps, has_next: from + ps < total, has_previous: pg > 1, error: null }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'export_history_error', business_id: auth.businessId })
    return emptyPage('Could not load export history.')
  }
}
