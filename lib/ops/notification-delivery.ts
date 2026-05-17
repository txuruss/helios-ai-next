// ── Notification delivery logging engine — server-only ────────────
// Tracks per-recipient delivery attempts, retry scheduling, and failure alerts.
// Fire-and-forget safe — never affects primary notification flows.

import 'server-only'
import { createHash } from 'crypto'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { captureApiError } from '@/lib/logging/api'

type DbClient = ReturnType<typeof createServiceRoleClient>
type DbRow    = Record<string, unknown>

// ── Types ─────────────────────────────────────────────────────────

export type DeliveryStatus =
  | 'pending' | 'scheduled' | 'sent' | 'failed'
  | 'retrying' | 'cancelled' | 'skipped'

export interface DeliveryLog {
  id:                      string
  business_id:             string | null
  notification_rule_id:    string | null
  notification_preview_id: string | null
  target_table:            string | null
  target_id:               string | null
  recipient_type:          string | null
  recipient_masked:        string | null
  delivery_channel:        string
  delivery_status:         DeliveryStatus
  provider:                string
  provider_message_id:     string | null
  attempt_count:           number
  last_attempt_at:         string | null
  next_retry_at:           string | null
  scheduled_for:           string | null
  sent_at:                 string | null
  failed_at:               string | null
  error_summary:           string | null
  subject_hash:            string | null
  body_hash:               string | null
  metadata:                Record<string, unknown>
  created_at:              string
  updated_at:              string
}

// ── Helpers ───────────────────────────────────────────────────────

export function maskRecipientForLog(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return `${email.slice(0, 2)}***`
  return `${local.slice(0, 2)}***@${domain}`
}

export function hashNotificationContent(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 32)
}

function safeErrorSummary(err: unknown): string {
  if (err instanceof Error) return err.message.slice(0, 200)
  if (typeof err === 'string') return err.slice(0, 200)
  return 'Unknown error'
}

// ── Create delivery log ───────────────────────────────────────────

export async function createNotificationDeliveryLog(params: {
  businessId:           string
  ruleId?:              string | null
  recipientType?:       string
  recipientEmail?:      string
  subject?:             string
  bodyText?:            string
  delayMinutes?:        number
  channel?:             string
  db?:                  DbClient
}): Promise<string | null> {
  const client = params.db ?? createServiceRoleClient()
  const now    = new Date()

  const scheduledFor = params.delayMinutes && params.delayMinutes > 0
    ? new Date(now.getTime() + params.delayMinutes * 60000).toISOString()
    : null

  const status: DeliveryStatus = scheduledFor ? 'scheduled' : 'pending'

  try {
    const { data } = await client.from('notification_delivery_logs').insert({
      business_id:          params.businessId,
      notification_rule_id: params.ruleId ?? null,
      recipient_type:       params.recipientType ?? null,
      recipient_masked:     params.recipientEmail ? maskRecipientForLog(params.recipientEmail) : null,
      delivery_channel:     params.channel ?? 'email',
      delivery_status:      status,
      provider:             'resend',
      subject_hash:         params.subject ? hashNotificationContent(params.subject) : null,
      body_hash:            params.bodyText ? hashNotificationContent(params.bodyText) : null,
      scheduled_for:        scheduledFor,
      next_retry_at:        scheduledFor,
      attempt_count:        0,
      metadata:             {},
    }).select('id').single()
    return (data as { id: string } | null)?.id ?? null
  } catch (err) {
    captureApiError(err, { route: 'ops/notification-delivery', error_type: 'delivery_log_insert_error', business_id: params.businessId })
    return null
  }
}

// ── Mark sent ─────────────────────────────────────────────────────

export async function markNotificationSent(
  logId:            string,
  providerMessageId: string | null,
  db?:              DbClient,
): Promise<void> {
  const client = db ?? createServiceRoleClient()
  try {
    await client.from('notification_delivery_logs').update({
      delivery_status:     'sent',
      sent_at:             new Date().toISOString(),
      provider_message_id: providerMessageId,
      last_attempt_at:     new Date().toISOString(),
      updated_at:          new Date().toISOString(),
    }).eq('id', logId)
  } catch (err) {
    captureApiError(err, { route: 'ops/notification-delivery', error_type: 'mark_sent_error' })
  }
}

// ── Mark failed ───────────────────────────────────────────────────

export async function markNotificationFailed(params: {
  logId:              string
  errorSummary:       string
  businessId:         string
  ruleId?:            string | null
  maxRetryAttempts?:  number
  retryBackoffMin?:   number
  notifyOnFailure?:   boolean
  db?:                DbClient
}): Promise<void> {
  const client          = params.db ?? createServiceRoleClient()
  const maxAttempts     = params.maxRetryAttempts ?? 3
  const backoffMinutes  = params.retryBackoffMin  ?? 10
  const now             = new Date()

  try {
    // Check current attempt count
    const { data: existing } = await client
      .from('notification_delivery_logs').select('attempt_count').eq('id', params.logId).single()
    const attempts = ((existing as DbRow | null)?.attempt_count as number | null) ?? 0
    const nextAttempt = attempts + 1

    const isExhausted = nextAttempt >= maxAttempts

    const nextRetryAt = isExhausted
      ? null
      : new Date(now.getTime() + backoffMinutes * 60000 * nextAttempt).toISOString()

    await client.from('notification_delivery_logs').update({
      delivery_status:  isExhausted ? 'failed' : 'retrying',
      failed_at:        isExhausted ? now.toISOString() : null,
      error_summary:    params.errorSummary.slice(0, 200),
      attempt_count:    nextAttempt,
      last_attempt_at:  now.toISOString(),
      next_retry_at:    nextRetryAt,
      updated_at:       now.toISOString(),
    }).eq('id', params.logId)

    // Create failure alert if exhausted and notify_on_failure is enabled
    if (isExhausted && (params.notifyOnFailure ?? true)) {
      void createFailedNotificationAlert({
        businessId:   params.businessId,
        ruleId:       params.ruleId ?? null,
        logId:        params.logId,
        errorSummary: params.errorSummary,
        db:           client,
      })
    }

  } catch (err) {
    captureApiError(err, {
      route:       'ops/notification-delivery',
      error_type:  'mark_failed_error',
      business_id: params.businessId,
    })
  }
}

// ── Schedule delivery ─────────────────────────────────────────────

export async function scheduleNotificationDelivery(params: {
  businessId:    string
  ruleId:        string
  subject:       string
  bodyText:      string
  recipientType: string
  recipientEmail: string
  delayMinutes:  number
  db?:           DbClient
}): Promise<string | null> {
  return createNotificationDeliveryLog({
    businessId:      params.businessId,
    ruleId:          params.ruleId,
    recipientType:   params.recipientType,
    recipientEmail:  params.recipientEmail,
    subject:         params.subject,
    bodyText:        params.bodyText,
    delayMinutes:    params.delayMinutes,
    db:              params.db,
  })
}

// ── Retry a failed delivery log ───────────────────────────────────

export async function retryNotificationDelivery(params: {
  logId:      string
  businessId: string
  db?:        DbClient
}): Promise<{ ok: boolean; error?: string }> {
  const client = params.db ?? createServiceRoleClient()
  try {
    const { data: log } = await client
      .from('notification_delivery_logs')
      .select('*')
      .eq('id', params.logId)
      .eq('business_id', params.businessId)
      .single()

    if (!log) return { ok: false, error: 'Delivery log not found.' }

    const l = log as DeliveryLog
    if (!['failed', 'retrying'].includes(l.delivery_status)) {
      return { ok: false, error: 'Only failed or retrying logs can be retried.' }
    }

    await client.from('notification_delivery_logs').update({
      delivery_status: 'retrying',
      next_retry_at:   new Date().toISOString(),
      updated_at:      new Date().toISOString(),
    }).eq('id', params.logId)

    return { ok: true }
  } catch (err) {
    captureApiError(err, { route: 'ops/notification-delivery', error_type: 'retry_error', business_id: params.businessId })
    return { ok: false, error: 'Retry failed.' }
  }
}

// ── Process pending/scheduled notifications ───────────────────────

export async function processPendingNotifications(
  businessId: string,
  db?:        DbClient,
): Promise<{ processed: number; sent: number; failed: number; skipped: number }> {
  const client = db ?? createServiceRoleClient()
  const now    = new Date().toISOString()
  let processed = 0, sent = 0, failed = 0, skipped = 0

  try {
    // Find due scheduled/retrying logs
    const { data: dueLogs } = await client
      .from('notification_delivery_logs')
      .select('*')
      .eq('business_id', businessId)
      .in('delivery_status', ['scheduled', 'retrying'])
      .lte('next_retry_at', now)
      .limit(50)

    for (const log of ((dueLogs ?? []) as DeliveryLog[])) {
      processed++
      try {
        // Load the rule to get template/recipient info
        if (!log.notification_rule_id) { skipped++; continue }
        const { data: rule } = await client
          .from('ops_notification_rules')
          .select('*')
          .eq('id', log.notification_rule_id)
          .single()
        if (!rule) { skipped++; continue }

        // Mark as pending before attempting
        await client.from('notification_delivery_logs').update({
          delivery_status: 'pending',
          updated_at:      new Date().toISOString(),
        }).eq('id', log.id)

        // Dynamic import to avoid circular deps
        const { sendEmail } = await import('@/lib/resend/client')
        const r = rule as { email_subject_template?: string; email_body_template?: string; name: string }

        const subject = r.email_subject_template ?? `Helios AI Ops — ${r.name}`
        const html    = `<p>Scheduled notification from Helios AI Ops Center. Rule: ${r.name}</p>`
        const text    = `Scheduled notification from Helios AI Ops Center. Rule: ${r.name}`

        // We only have masked email — for scheduled sends we need business owner as fallback
        const { data: biz } = await client.from('businesses')
          .select('owner_notification_email').eq('id', businessId).single()
        const toEmail = (biz as DbRow | null)?.owner_notification_email as string | null

        if (!toEmail) {
          await markNotificationFailed({
            logId:       log.id,
            errorSummary: 'No recipient email found for scheduled delivery.',
            businessId,
            db:          client,
          })
          failed++
          continue
        }

        const result = await sendEmail({ to: toEmail, subject, html, text })
        if (result.ok) {
          await markNotificationSent(log.id, null, client)
          sent++
        } else {
          await markNotificationFailed({
            logId:        log.id,
            errorSummary: 'Send failed during scheduled processing.',
            businessId,
            db:           client,
          })
          failed++
        }
      } catch (err) {
        const errSummary = safeErrorSummary(err)
        await markNotificationFailed({
          logId:        log.id,
          errorSummary: errSummary,
          businessId,
          db:           client,
        }).catch(() => undefined)
        failed++
      }
    }
  } catch (err) {
    captureApiError(err, { route: 'ops/notification-delivery', error_type: 'process_pending_error', business_id: businessId })
  }

  return { processed, sent, failed, skipped }
}

// ── Failed notification alert ─────────────────────────────────────

async function createFailedNotificationAlert(params: {
  businessId:   string
  ruleId:       string | null
  logId:        string
  errorSummary: string
  db?:          DbClient
}): Promise<void> {
  const client = params.db ?? createServiceRoleClient()
  try {
    // Prevent duplicate alerts for same log
    const { count } = await client.from('ops_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', params.businessId)
      .eq('alert_type', 'notification_failed')
      .contains('metadata', { delivery_log_id: params.logId })
    if ((count ?? 0) > 0) return

    await client.from('ops_alerts').insert({
      business_id: params.businessId,
      alert_type:  'notification_failed',
      severity:    'warning',
      title:       'Notification delivery failed',
      message:     'A notification could not be delivered after all retry attempts.',
      status:      'active',
      metadata:    {
        delivery_log_id:      params.logId,
        notification_rule_id: params.ruleId,
        error_summary:        params.errorSummary.slice(0, 100),
      },
    })
  } catch (err) {
    captureApiError(err, {
      route:       'ops/notification-delivery',
      error_type:  'failed_alert_create_error',
      business_id: params.businessId,
    })
  }
}

// ── Update delivery log (generic) ─────────────────────────────────

export async function updateNotificationDeliveryLog(
  logId:   string,
  updates: Partial<Pick<DeliveryLog, 'delivery_status' | 'error_summary' | 'attempt_count' | 'last_attempt_at' | 'next_retry_at' | 'sent_at' | 'failed_at' | 'provider_message_id'>>,
  db?:     DbClient,
): Promise<void> {
  const client = db ?? createServiceRoleClient()
  try {
    await client.from('notification_delivery_logs').update({
      ...updates,
      updated_at: new Date().toISOString(),
    }).eq('id', logId)
  } catch (err) {
    captureApiError(err, { route: 'ops/notification-delivery', error_type: 'update_log_error' })
  }
}
