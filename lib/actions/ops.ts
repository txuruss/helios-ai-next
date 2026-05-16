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
  id:            string
  business_id:   string | null
  source:        string
  event_type:    string
  severity:      string
  title:         string
  description:   string | null
  status:        string
  related_table: string | null
  related_id:    string | null
  metadata:      Record<string, unknown>
  created_at:    string
  resolved_at:   string | null
}

export interface OpsTask {
  id:            string
  business_id:   string | null
  title:         string
  description:   string | null
  task_type:     string
  priority:      string
  status:        string
  related_table: string | null
  related_id:    string | null
  assigned_to:   string | null
  due_at:        string | null
  metadata:      Record<string, unknown>
  created_at:    string
  completed_at:  string | null
}

export interface OpsAlert {
  id:              string
  business_id:     string | null
  alert_type:      string
  severity:        string
  title:           string
  message:         string | null
  status:          string
  related_table:   string | null
  related_id:      string | null
  metadata:        Record<string, unknown>
  created_at:      string
  acknowledged_at: string | null
  resolved_at:     string | null
}

export interface ApprovalItem {
  id:            string
  business_id:   string | null
  approval_type: string
  title:         string
  description:   string | null
  content:       string | null
  status:        string
  requested_by:  string | null
  reviewed_by:   string | null
  related_table: string | null
  related_id:    string | null
  metadata:      Record<string, unknown>
  created_at:    string
  reviewed_at:   string | null
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

// ── getOpsEvents ──────────────────────────────────────────────────

export async function getOpsEvents(limit = 30, status?: string): Promise<{
  events: OpsEvent[]; error: string | null
}> {
  const auth = await requireAuth()
  if (!auth.ok) return { events: [], error: auth.error }
  const db = createServiceRoleClient()
  try {
    let query = db.from('ops_events').select('*')
      .eq('business_id', auth.businessId)
      .order('created_at', { ascending: false }).limit(limit)
    if (status) query = query.eq('status', status)
    const { data, error } = await query
    if (error) throw error
    return { events: (data ?? []) as OpsEvent[], error: null }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'events_error', business_id: auth.businessId })
    return { events: [], error: 'Could not load ops events.' }
  }
}

// ── getOpsTasks ───────────────────────────────────────────────────

export async function getOpsTasks(limit = 30, status?: string): Promise<{
  tasks: OpsTask[]; error: string | null
}> {
  const auth = await requireAuth()
  if (!auth.ok) return { tasks: [], error: auth.error }
  const db = createServiceRoleClient()
  try {
    let query = db.from('ops_tasks').select('*')
      .eq('business_id', auth.businessId)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false }).limit(limit)
    if (status) query = query.eq('status', status)
    const { data, error } = await query
    if (error) throw error
    return { tasks: (data ?? []) as OpsTask[], error: null }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'tasks_error', business_id: auth.businessId })
    return { tasks: [], error: 'Could not load ops tasks.' }
  }
}

// ── getOpsAlerts ──────────────────────────────────────────────────

export async function getOpsAlerts(limit = 30, status?: string): Promise<{
  alerts: OpsAlert[]; error: string | null
}> {
  const auth = await requireAuth()
  if (!auth.ok) return { alerts: [], error: auth.error }
  const db = createServiceRoleClient()
  try {
    let query = db.from('ops_alerts').select('*')
      .eq('business_id', auth.businessId)
      .order('severity', { ascending: false })
      .order('created_at', { ascending: false }).limit(limit)
    if (status) query = query.eq('status', status)
    const { data, error } = await query
    if (error) throw error
    return { alerts: (data ?? []) as OpsAlert[], error: null }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'alerts_error', business_id: auth.businessId })
    return { alerts: [], error: 'Could not load ops alerts.' }
  }
}

// ── getApprovalItems ──────────────────────────────────────────────

export async function getApprovalItems(limit = 30, status?: string): Promise<{
  items: ApprovalItem[]; error: string | null
}> {
  const auth = await requireAuth()
  if (!auth.ok) return { items: [], error: auth.error }
  const db = createServiceRoleClient()
  try {
    let query = db.from('approval_items').select('*')
      .eq('business_id', auth.businessId)
      .order('created_at', { ascending: false }).limit(limit)
    if (status) query = query.eq('status', status)
    const { data, error } = await query
    if (error) throw error
    return { items: (data ?? []) as ApprovalItem[], error: null }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'approvals_error', business_id: auth.businessId })
    return { items: [], error: 'Could not load approval items.' }
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
