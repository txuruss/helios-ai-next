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

// ── Phase 13: Automation Rules ────────────────────────────────────

import type { AutomationRule } from '@/lib/ops/automation'
export type { AutomationRule }

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
export type { SlaPolicy, SlaSummary, SlaCheckResult }

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
export type { NotificationRule }

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
export type { AuditTrailRow }

export async function getOpsAuditTrailAction(limit = 50): Promise<{
  rows:  AuditTrailRow[]
  error: string | null
}> {
  const auth = await requireAuth()
  if (!auth.ok) return { rows: [], error: auth.error }
  const db = createServiceRoleClient()
  try {
    const { getOpsAuditTrail } = await import('@/lib/ops/audit')
    const rows = await getOpsAuditTrail({ businessId: auth.businessId, limit, db })
    return { rows, error: null }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'audit_trail_error', business_id: auth.businessId })
    return { rows: [], error: 'Could not load audit trail.' }
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

export async function getOpsExports(limit = 20): Promise<{
  exports: OpsExportRow[]
  error:   string | null
}> {
  const auth = await requireAuth()
  if (!auth.ok) return { exports: [], error: auth.error }
  const db = createServiceRoleClient()
  try {
    const { data, error } = await db
      .from('ops_exports').select('*')
      .eq('business_id', auth.businessId)
      .order('created_at', { ascending: false }).limit(limit)
    if (error) throw error
    return { exports: (data ?? []) as OpsExportRow[], error: null }
  } catch (err) {
    captureApiError(err, { route: 'actions/ops', error_type: 'get_exports_error', business_id: auth.businessId })
    return { exports: [], error: 'Could not load export history.' }
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
