// ── SLA engine — server-only ──────────────────────────────────────
// Fire-and-forget safe. SLA failures must never affect primary flows.

import 'server-only'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { captureApiError } from '@/lib/logging/api'

type DbClient = ReturnType<typeof createServiceRoleClient>
type DbRow    = Record<string, unknown>

// ── SLA defaults (minutes) ────────────────────────────────────────

export const SLA_DEFAULTS: Record<string, number> = {
  alert_critical:          15,
  alert_error:             60,
  alert_warning:           240,
  task_urgent:             30,
  task_high:               120,
  task_normal:             1440,
  task_low:                2880,
  approval_normal:         1440,
  approval_high:           240,
  handoff_requested:       10,
  booking_failed:          30,
  payment_failed:          60,
}

// ── SLA policy row ────────────────────────────────────────────────

export interface SlaPolicy {
  id:                 string
  business_id:        string | null
  name:               string
  target_type:        string
  source:             string | null
  severity:           string | null
  priority:           string | null
  response_minutes:   number
  escalation_minutes: number | null
  is_enabled:         boolean
  metadata:           Record<string, unknown>
  created_at:         string
  updated_at:         string
}

// ── SLA status ────────────────────────────────────────────────────

export type SlaStatus = 'on_track' | 'warning' | 'due_soon' | 'breached' | 'escalated' | 'resolved'

export function getSlaStatus(
  slaDueAt:        string | null,
  status:          string,
  escalationLevel: number,
): SlaStatus {
  const resolved = ['resolved','completed','approved','rejected','cancelled']
  if (resolved.includes(status)) return 'resolved'
  if (!slaDueAt)                 return 'on_track'
  if (escalationLevel > 0)       return 'escalated'
  const remaining = new Date(slaDueAt).getTime() - Date.now()
  if (remaining < 0)              return 'breached'
  if (remaining < 15 * 60_000)   return 'due_soon'
  if (remaining < 60 * 60_000)   return 'warning'
  return 'on_track'
}

export const SLA_STATUS_STYLE: Record<SlaStatus, { text: string; bg: string; dot: string }> = {
  on_track:  { text: 'text-[#22d093]', bg: 'bg-[#22d093]/10',  dot: 'bg-[#22d093]'  },
  warning:   { text: 'text-[#ffae3c]', bg: 'bg-[#ffae3c]/10',  dot: 'bg-[#ffae3c]'  },
  due_soon:  { text: 'text-[#ff7a18]', bg: 'bg-[#ff7a18]/10',  dot: 'bg-[#ff7a18]'  },
  breached:  { text: 'text-[#ff8a7a]', bg: 'bg-[#ff8a7a]/10',  dot: 'bg-[#ff8a7a]'  },
  escalated: { text: 'text-[#c084fc]', bg: 'bg-[#c084fc]/10',  dot: 'bg-[#c084fc]'  },
  resolved:  { text: 'text-[#6a6a6e]', bg: 'bg-white/[0.04]',  dot: 'bg-[#6a6a6e]'  },
}

// ── Get matching SLA policy ───────────────────────────────────────

export function getMatchingSlaPolicy(
  policies: SlaPolicy[],
  params: { target_type: string; source?: string; severity?: string; priority?: string },
): SlaPolicy | null {
  // Prefer more specific matches first
  const enabled = policies.filter((p) => p.is_enabled)

  // Exact match on all fields
  let match = enabled.find((p) =>
    p.target_type === params.target_type &&
    (p.source   === null || p.source   === params.source) &&
    (p.severity === null || p.severity === params.severity) &&
    (p.priority === null || p.priority === params.priority),
  )

  // Looser: ignore priority
  if (!match) match = enabled.find((p) =>
    p.target_type === params.target_type &&
    (p.source   === null || p.source   === params.source) &&
    (p.severity === null || p.severity === params.severity),
  )

  // Loosest: target_type only
  if (!match) match = enabled.find((p) => p.target_type === params.target_type)

  return match ?? null
}

// ── Default minutes from built-in table ──────────────────────────

function defaultMinutes(params: { target_type: string; severity?: string; priority?: string; source?: string }): number {
  const { target_type, severity, priority, source } = params

  if (source === 'whatsapp' && priority === 'handoff_requested') return 10
  if (source === 'whatsapp' && severity === 'handoff_requested')  return 10

  if (target_type === 'alert') {
    if (severity === 'critical') return SLA_DEFAULTS.alert_critical
    if (severity === 'error')    return SLA_DEFAULTS.alert_error
    return SLA_DEFAULTS.alert_warning
  }
  if (target_type === 'task') {
    if (priority === 'urgent') return SLA_DEFAULTS.task_urgent
    if (priority === 'high')   return SLA_DEFAULTS.task_high
    if (priority === 'low')    return SLA_DEFAULTS.task_low
    return SLA_DEFAULTS.task_normal
  }
  if (target_type === 'approval') {
    if (priority === 'high' || priority === 'urgent') return SLA_DEFAULTS.approval_high
    return SLA_DEFAULTS.approval_normal
  }
  if (target_type === 'event') {
    if (severity === 'critical') return SLA_DEFAULTS.alert_critical
    return 240 // 4h for events
  }
  return 1440
}

// ── Apply SLA to a specific item ──────────────────────────────────

export async function applySlaToOpsItem(params: {
  table:       'ops_alerts' | 'ops_tasks' | 'approval_items' | 'ops_events'
  id:          string
  target_type: string
  severity?:   string
  priority?:   string
  source?:     string
  businessId:  string | null
  db:          DbClient
}): Promise<void> {
  try {
    const { table, id, businessId, db } = params

    // Try to load a matching policy from DB
    let minutes = defaultMinutes(params)

    if (businessId) {
      const { data: policies } = await db
        .from('ops_sla_policies')
        .select('*')
        .or(`business_id.eq.${businessId},business_id.is.null`)
        .eq('is_enabled', true)
        .order('created_at', { ascending: true })

      if (policies?.length) {
        const match = getMatchingSlaPolicy(policies as SlaPolicy[], params)
        if (match) minutes = match.response_minutes
      }
    }

    const sla_due_at = new Date(Date.now() + minutes * 60_000).toISOString()
    await db.from(table).update({ sla_due_at }).eq('id', id)

  } catch (err) {
    console.error('[sla] applySlaToOpsItem error:', err instanceof Error ? err.message : err)
  }
}

// ── Process SLA breaches ──────────────────────────────────────────

export interface SlaCheckResult {
  checked:   number
  breached:  number
  escalated: number
  notified:  number
}

async function processTableSlaBreaches(
  table:      'ops_alerts' | 'ops_tasks' | 'approval_items',
  statusCol:  string,
  activeVals: string[],
  db:         DbClient,
  businessId: string,
): Promise<{ breached: number; escalated: number }> {
  const now = new Date().toISOString()
  let breached = 0; let escalated = 0

  const { data: items } = await db
    .from(table)
    .select('id, escalation_level, sla_due_at')
    .eq('business_id', businessId)
    .in(statusCol, activeVals)
    .lt('sla_due_at', now)
    .is('escalated_at', null)
    .limit(100)

  for (const item of ((items ?? []) as DbRow[])) {
    const newLevel = ((item.escalation_level as number) ?? 0) + 1
    await db.from(table).update({
      escalation_level: newLevel,
      escalated_at:     now,
    }).eq('id', item.id as string)
    breached++
    if (newLevel > 1) escalated++
  }

  return { breached, escalated }
}

export async function processSlaBreaches(
  businessId: string,
  db?:        DbClient,
): Promise<SlaCheckResult> {
  const client = db ?? createServiceRoleClient()
  let checked = 0; let breached = 0; let escalated = 0; const notified = 0

  try {
    const [a, t, ap] = await Promise.all([
      processTableSlaBreaches('ops_alerts',     'status', ['active'],              client, businessId),
      processTableSlaBreaches('ops_tasks',      'status', ['pending','in_progress'], client, businessId),
      processTableSlaBreaches('approval_items', 'status', ['pending'],             client, businessId),
    ])

    checked   = a.breached + t.breached + ap.breached
    breached  = checked
    escalated = a.escalated + t.escalated + ap.escalated

  } catch (err) {
    captureApiError(err, { route: 'ops/sla', error_type: 'sla_breach_error', business_id: businessId })
  }

  return { checked, breached, escalated, notified }
}

// ── SLA summary ───────────────────────────────────────────────────

export interface SlaSummary {
  breached:  number
  due_soon:  number
  escalated: number
  on_track:  number
}

export async function getSlaSummary(
  businessId: string,
  db?:        DbClient,
): Promise<SlaSummary> {
  const client = db ?? createServiceRoleClient()
  const now    = new Date().toISOString()
  const soon   = new Date(Date.now() + 60 * 60_000).toISOString() // 1h

  try {
    const [breachedAlerts, breachedTasks, dueSoonAlerts, dueSoonTasks, escalated] = await Promise.all([
      client.from('ops_alerts').select('*', { count: 'exact', head: true })
        .eq('business_id', businessId).eq('status', 'active').lt('sla_due_at', now),
      client.from('ops_tasks').select('*', { count: 'exact', head: true })
        .eq('business_id', businessId).in('status', ['pending','in_progress']).lt('sla_due_at', now),
      client.from('ops_alerts').select('*', { count: 'exact', head: true })
        .eq('business_id', businessId).eq('status', 'active').gte('sla_due_at', now).lte('sla_due_at', soon),
      client.from('ops_tasks').select('*', { count: 'exact', head: true })
        .eq('business_id', businessId).in('status', ['pending','in_progress']).gte('sla_due_at', now).lte('sla_due_at', soon),
      client.from('ops_alerts').select('*', { count: 'exact', head: true })
        .eq('business_id', businessId).gt('escalation_level', 0),
    ])

    const breach   = (breachedAlerts.count ?? 0) + (breachedTasks.count ?? 0)
    const soon_cnt = (dueSoonAlerts.count ?? 0) + (dueSoonTasks.count ?? 0)
    const esc      = escalated.count ?? 0

    return { breached: breach, due_soon: soon_cnt, escalated: esc, on_track: Math.max(0, 10 - breach - soon_cnt - esc) }
  } catch {
    return { breached: 0, due_soon: 0, escalated: 0, on_track: 0 }
  }
}

// ── Seed default SLA policies ─────────────────────────────────────

const DEFAULT_SLA_POLICIES = [
  { name: 'Critical alerts — 15 min',      target_type: 'alert',    severity: 'critical', response_minutes: 15,   escalation_minutes: 30 },
  { name: 'Error alerts — 1 hour',         target_type: 'alert',    severity: 'error',    response_minutes: 60,   escalation_minutes: 120 },
  { name: 'Warning alerts — 4 hours',      target_type: 'alert',    severity: 'warning',  response_minutes: 240,  escalation_minutes: null },
  { name: 'Urgent tasks — 30 min',         target_type: 'task',     priority: 'urgent',   response_minutes: 30,   escalation_minutes: 60 },
  { name: 'High-priority tasks — 2 hours', target_type: 'task',     priority: 'high',     response_minutes: 120,  escalation_minutes: 240 },
  { name: 'Normal tasks — 24 hours',       target_type: 'task',     priority: 'normal',   response_minutes: 1440, escalation_minutes: null },
  { name: 'Approvals — 24 hours',          target_type: 'approval', priority: null,       response_minutes: 1440, escalation_minutes: null },
  { name: 'Handoff requested — 10 min',    target_type: 'task',     source: 'whatsapp',   response_minutes: 10,   escalation_minutes: 20 },
  { name: 'Booking failed — 30 min',       target_type: 'task',     source: 'calcom',     response_minutes: 30,   escalation_minutes: null },
  { name: 'Payment failed — 1 hour',       target_type: 'alert',    source: 'stripe',     response_minutes: 60,   escalation_minutes: null },
]

export async function seedDefaultSlaPolicies(
  businessId: string,
  db?:        DbClient,
): Promise<{ seeded: number; error: string | null }> {
  const client = db ?? createServiceRoleClient()
  let seeded = 0
  try {
    for (const p of DEFAULT_SLA_POLICIES) {
      const { error } = await client.from('ops_sla_policies').upsert(
        {
          business_id:        businessId,
          name:               p.name,
          target_type:        p.target_type,
          source:             (p as DbRow).source as string | null ?? null,
          severity:           (p as DbRow).severity as string | null ?? null,
          priority:           (p as DbRow).priority as string | null ?? null,
          response_minutes:   p.response_minutes,
          escalation_minutes: p.escalation_minutes ?? null,
          is_enabled:         true,
          metadata:           {},
        },
        { onConflict: 'business_id,name', ignoreDuplicates: true },
      )
      if (!error) seeded++
    }
    return { seeded, error: null }
  } catch (err) {
    captureApiError(err, { route: 'ops/sla', error_type: 'seed_sla_error', business_id: businessId })
    return { seeded, error: 'Could not seed SLA policies.' }
  }
}
