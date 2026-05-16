// ── Ops automation engine — server-only ──────────────────────────
// Processes ops events against automation rules to create alerts,
// tasks, and approval items. All operations are fire-and-forget
// safe — never affects the calling API route.

import 'server-only'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { captureApiError } from '@/lib/logging/api'

type DbClient = ReturnType<typeof createServiceRoleClient>
type DbRow    = Record<string, unknown>

export interface AutomationRule {
  id:                          string
  business_id:                 string | null
  name:                        string
  description:                 string | null
  trigger_source:              string | null
  trigger_event_type:          string | null
  trigger_severity:            string | null
  action_type:                 'create_alert' | 'create_task' | 'create_approval' | 'ignore'
  action_title_template:       string
  action_description_template: string | null
  priority:                    string
  is_enabled:                  boolean
  metadata:                    Record<string, unknown>
  created_at:                  string
  updated_at:                  string
}

interface OpsEventRow {
  id:            string
  business_id:   string | null
  source:        string
  event_type:    string
  severity:      string
  title:         string
  description:   string | null
  related_table: string | null
  related_id:    string | null
}

// ── Rule matching ─────────────────────────────────────────────────

function ruleMatchesEvent(rule: AutomationRule, event: OpsEventRow): boolean {
  if (!rule.is_enabled) return false
  if (rule.trigger_source && rule.trigger_source !== event.source) return false
  if (rule.trigger_severity && rule.trigger_severity !== event.severity) return false
  if (rule.trigger_event_type) {
    // Support wildcard matching via "contains"
    if (rule.trigger_event_type.includes('*')) {
      const pattern = rule.trigger_event_type.replace(/\*/g, '')
      if (!event.event_type.includes(pattern)) return false
    } else if (rule.trigger_event_type !== event.event_type) {
      return false
    }
  }
  return true
}

function interpolate(template: string, event: OpsEventRow): string {
  return template
    .replace('{{source}}',     event.source)
    .replace('{{event_type}}', event.event_type)
    .replace('{{severity}}',   event.severity)
    .replace('{{title}}',      event.title)
    .slice(0, 256)
}

// ── Apply a single rule ───────────────────────────────────────────

async function applyAutomationRule(
  rule:  AutomationRule,
  event: OpsEventRow,
  db:    DbClient,
): Promise<void> {
  const title = interpolate(rule.action_title_template, event)
  const desc  = rule.action_description_template
    ? interpolate(rule.action_description_template, event)
    : null

  if (rule.action_type === 'ignore') return

  if (rule.action_type === 'create_alert') {
    const alertSeverity = event.severity === 'critical' ? 'critical' : event.severity === 'error' ? 'error' : 'warning'
    const { data: alertRow } = await db.from('ops_alerts').insert({
      business_id:            event.business_id,
      alert_type:             event.event_type,
      severity:               alertSeverity,
      title,
      message:                desc ?? event.description,
      related_table:          event.related_table,
      related_id:             event.related_id,
      created_from_event_id:  event.id,
      auto_generated:         true,
      metadata:               { rule_id: rule.id, rule_name: rule.name },
    }).select('id').single()

    const alertId = (alertRow as { id: string } | null)?.id
    if (alertId && event.business_id) {
      // Apply SLA (fire-and-forget)
      void import('./sla').then(({ applySlaToOpsItem }) =>
        applySlaToOpsItem({ table: 'ops_alerts', id: alertId, target_type: 'alert', severity: alertSeverity, source: event.source, businessId: event.business_id, db })
      ).catch(() => undefined)

      // Route notification (fire-and-forget)
      void import('./notifications').then(({ routeOpsNotification }) =>
        routeOpsNotification({ trigger_type: 'alert_created', businessId: event.business_id!, title, severity: alertSeverity, source: event.source, description: desc, section: 'alerts', db })
      ).catch(() => undefined)
    }
    return
  }

  if (rule.action_type === 'create_task') {
    const { data: taskRow } = await db.from('ops_tasks').insert({
      business_id:            event.business_id,
      title,
      description:            desc ?? event.description,
      task_type:              event.event_type,
      priority:               rule.priority,
      related_table:          event.related_table,
      related_id:             event.related_id,
      created_from_event_id:  event.id,
      metadata:               { rule_id: rule.id, rule_name: rule.name },
    }).select('id').single()

    const taskId = (taskRow as { id: string } | null)?.id
    if (taskId && event.business_id) {
      void import('./sla').then(({ applySlaToOpsItem }) =>
        applySlaToOpsItem({ table: 'ops_tasks', id: taskId, target_type: 'task', priority: rule.priority, source: event.source, businessId: event.business_id, db })
      ).catch(() => undefined)

      void import('./notifications').then(({ routeOpsNotification }) =>
        routeOpsNotification({ trigger_type: 'task_created', businessId: event.business_id!, title, source: event.source, description: desc, section: 'tasks', db })
      ).catch(() => undefined)
    }
    return
  }

  if (rule.action_type === 'create_approval') {
    const { data: approvalRow } = await db.from('approval_items').insert({
      business_id:   event.business_id,
      approval_type: event.event_type,
      title,
      description:   desc ?? event.description,
      priority:      rule.priority,
      source_table:  event.related_table,
      source_id:     event.related_id,
      metadata:      { rule_id: rule.id, rule_name: rule.name, event_id: event.id },
    }).select('id').single()

    const approvalId = (approvalRow as { id: string } | null)?.id
    if (approvalId && event.business_id) {
      void import('./sla').then(({ applySlaToOpsItem }) =>
        applySlaToOpsItem({ table: 'approval_items', id: approvalId, target_type: 'approval', priority: rule.priority, businessId: event.business_id, db })
      ).catch(() => undefined)

      void import('./notifications').then(({ routeOpsNotification }) =>
        routeOpsNotification({ trigger_type: 'approval_created', businessId: event.business_id!, title, source: event.source, description: desc, section: 'approvals', db })
      ).catch(() => undefined)
    }
  }
}

// ── Process a single event ────────────────────────────────────────

export async function processOpsEvent(eventId: string, db?: DbClient): Promise<void> {
  const client = db ?? createServiceRoleClient()
  try {
    const { data: event } = await client
      .from('ops_events')
      .select('id,business_id,source,event_type,severity,title,description,related_table,related_id,processed_at')
      .eq('id', eventId)
      .single()

    if (!event) return
    const ev = event as OpsEventRow & { processed_at?: string | null }
    if (ev.processed_at) return // already processed

    // Load rules for this business + global rules
    const { data: rules } = await client
      .from('ops_automation_rules')
      .select('*')
      .eq('is_enabled', true)
      .or(`business_id.eq.${ev.business_id ?? ''},business_id.is.null`)
      .order('created_at', { ascending: true })

    const matchingRules = ((rules ?? []) as AutomationRule[]).filter((r) =>
      ruleMatchesEvent(r, ev),
    )

    for (const rule of matchingRules) {
      try {
        await applyAutomationRule(rule, ev, client)
      } catch (ruleErr) {
        console.error('[automation] rule failed:', rule.name, ruleErr instanceof Error ? ruleErr.message : ruleErr)
      }
    }

    // Mark event as processed
    await client.from('ops_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('id', eventId)

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('[automation] processOpsEvent error:', errMsg)
    captureApiError(err, { route: 'ops/automation', error_type: 'automation_processing_error' })
    // Record processing error on the event (fire-and-forget)
    const c = db ?? createServiceRoleClient()
    c.from('ops_events')
      .update({ processing_error: errMsg.slice(0, 500) })
      .eq('id', eventId)
      .catch(() => undefined)
  }
}

// ── Process batch of unprocessed events ───────────────────────────

export async function processUnprocessedOpsEvents(
  businessId: string,
  limit = 50,
): Promise<{ processed: number; errors: number }> {
  const db = createServiceRoleClient()
  let processed = 0
  let errors    = 0

  try {
    const { data: events } = await db
      .from('ops_events')
      .select('id')
      .eq('business_id', businessId)
      .is('processed_at', null)
      .eq('status', 'open')
      .order('created_at', { ascending: true })
      .limit(limit)

    for (const ev of ((events ?? []) as { id: string }[])) {
      try {
        await processOpsEvent(ev.id, db)
        processed++
      } catch {
        errors++
      }
    }
  } catch (err) {
    captureApiError(err, { route: 'ops/automation', error_type: 'batch_processing_error', business_id: businessId })
  }

  return { processed, errors }
}

// ── Seed default automation rules ─────────────────────────────────

const DEFAULT_RULES: Array<Omit<AutomationRule, 'id' | 'created_at' | 'updated_at' | 'metadata' | 'business_id'>> = [
  {
    name:                        'Critical event → alert',
    description:                 'Creates a critical alert for any critical-severity event.',
    trigger_source:              null,
    trigger_event_type:          null,
    trigger_severity:            'critical',
    action_type:                 'create_alert',
    action_title_template:       'Critical: {{title}}',
    action_description_template: 'Auto-created from {{source}} / {{event_type}}',
    priority:                    'urgent',
    is_enabled:                  true,
  },
  {
    name:                        'Failed event → alert',
    description:                 'Creates an error alert when any event_type contains "failed".',
    trigger_source:              null,
    trigger_event_type:          '*failed*',
    trigger_severity:            null,
    action_type:                 'create_alert',
    action_title_template:       'Failure detected: {{title}}',
    action_description_template: 'Source: {{source}} · Event: {{event_type}}',
    priority:                    'high',
    is_enabled:                  true,
  },
  {
    name:                        'Payment failed → urgent alert',
    description:                 'Creates an urgent alert when a Stripe payment fails.',
    trigger_source:              'stripe',
    trigger_event_type:          'payment_failed',
    trigger_severity:            null,
    action_type:                 'create_alert',
    action_title_template:       'Urgent: Stripe payment failed',
    action_description_template: 'A subscription payment failed. Check Stripe dashboard.',
    priority:                    'urgent',
    is_enabled:                  true,
  },
  {
    name:                        'Booking failed → task',
    description:                 'Creates a task to investigate a failed Cal.com booking.',
    trigger_source:              'calcom',
    trigger_event_type:          'booking_failed',
    trigger_severity:            null,
    action_type:                 'create_task',
    action_title_template:       'Investigate booking failure',
    action_description_template: 'A Cal.com booking could not be created. Check the booking configuration.',
    priority:                    'high',
    is_enabled:                  true,
  },
  {
    name:                        'Manual reply failed → task',
    description:                 'Creates a task when a WhatsApp manual reply fails to send.',
    trigger_source:              'whatsapp',
    trigger_event_type:          'manual_reply_failed',
    trigger_severity:            null,
    action_type:                 'create_task',
    action_title_template:       'Retry failed WhatsApp reply',
    action_description_template: 'A manual WhatsApp message could not be sent. Contact the customer via another channel.',
    priority:                    'high',
    is_enabled:                  true,
  },
  {
    name:                        'Plan limit → warning alert',
    description:                 'Creates an alert when the AI conversation plan limit is reached.',
    trigger_source:              'chat',
    trigger_event_type:          'plan_limit_reached',
    trigger_severity:            null,
    action_type:                 'create_alert',
    action_title_template:       'Plan limit reached — upgrade recommended',
    action_description_template: 'Your AI conversation limit has been reached for this billing period.',
    priority:                    'normal',
    is_enabled:                  true,
  },
  {
    name:                        'Handoff requested → task',
    description:                 'Creates a task when a WhatsApp customer requests a human agent.',
    trigger_source:              'whatsapp',
    trigger_event_type:          'handoff_requested',
    trigger_severity:            null,
    action_type:                 'create_task',
    action_title_template:       'Customer requesting human agent',
    action_description_template: 'A WhatsApp customer has asked to speak with a human. Open the Inbox to respond.',
    priority:                    'high',
    is_enabled:                  true,
  },
  {
    name:                        'Agent run failed → alert',
    description:                 'Creates an alert when a Relevance AI agent run fails.',
    trigger_source:              'relevance',
    trigger_event_type:          'agent_run_failed',
    trigger_severity:            null,
    action_type:                 'create_alert',
    action_title_template:       'Agent run failed: {{title}}',
    action_description_template: 'A Relevance AI agent failed to complete. Check the Agents page.',
    priority:                    'normal',
    is_enabled:                  true,
  },
]

export async function seedDefaultAutomationRules(
  businessId: string,
  db?: DbClient,
): Promise<{ seeded: number; error: string | null }> {
  const client = db ?? createServiceRoleClient()
  let seeded = 0

  try {
    for (const rule of DEFAULT_RULES) {
      // Use upsert on (business_id, name) to avoid duplicates
      const { error } = await client.from('ops_automation_rules').upsert(
        { ...rule, business_id: businessId, metadata: {} },
        { onConflict: 'business_id,name', ignoreDuplicates: true },
      )
      if (!error) seeded++
    }
    return { seeded, error: null }
  } catch (err) {
    captureApiError(err, { route: 'ops/automation', error_type: 'seed_rules_error', business_id: businessId })
    return { seeded, error: 'Could not seed default automation rules.' }
  }
}

// AutomationRule is the primary export of this module
