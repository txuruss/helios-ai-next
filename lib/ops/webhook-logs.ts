// ── Webhook observability logging — server-only ───────────────────
// Stores safe summaries of inbound webhook deliveries.
// Never stores raw body, signatures, tokens, or PII.

import 'server-only'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { captureApiError } from '@/lib/logging/api'

type DbClient = ReturnType<typeof createServiceRoleClient>

export type WebhookProvider =
  | 'stripe' | 'calcom' | 'whatsapp' | 'relevance' | 'ops' | 'unknown'

export type VerificationStatus = 'verified' | 'failed' | 'skipped' | 'unavailable'

export type ProcessingStatus =
  | 'received' | 'processing' | 'processed' | 'failed' | 'ignored' | 'duplicate'

export interface WebhookLog {
  id:                  string
  business_id:         string | null
  provider:            WebhookProvider
  route_path:          string
  event_type:          string | null
  verification_status: VerificationStatus | null
  processing_status:   ProcessingStatus
  status_code:         number | null
  duration_ms:         number | null
  request_id:          string | null
  external_event_id:   string | null
  error_summary:       string | null
  safe_summary:        string | null
  metadata:            Record<string, unknown>
  received_at:         string
  processed_at:        string | null
}

// ── Safe summary builder ──────────────────────────────────────────

export function sanitizeWebhookSummary(params: {
  provider:   WebhookProvider
  eventType?: string | null
  status?:    string | null
}): string {
  const parts: string[] = [`[${params.provider}]`]
  if (params.eventType) parts.push(params.eventType)
  if (params.status)    parts.push(`status:${params.status}`)
  return parts.join(' ')
}

// ── Create webhook log ────────────────────────────────────────────

export async function createWebhookDeliveryLog(params: {
  provider:            WebhookProvider
  routePath:           string
  businessId?:         string | null
  eventType?:          string | null
  verificationStatus?: VerificationStatus
  externalEventId?:    string | null
  requestId?:          string | null
  safeSummary?:        string | null
  db?:                 DbClient
}): Promise<string | null> {
  const client = params.db ?? createServiceRoleClient()
  try {
    const { data } = await client.from('webhook_delivery_logs').insert({
      business_id:         params.businessId ?? null,
      provider:            params.provider,
      route_path:          params.routePath,
      event_type:          params.eventType ?? null,
      verification_status: params.verificationStatus ?? null,
      processing_status:   'received',
      external_event_id:   params.externalEventId ?? null,
      request_id:          params.requestId ?? null,
      safe_summary:        params.safeSummary ?? null,
      metadata:            {},
      received_at:         new Date().toISOString(),
    }).select('id').single()
    return (data as { id: string } | null)?.id ?? null
  } catch (err) {
    captureApiError(err, { route: 'ops/webhook-logs', error_type: 'webhook_log_insert_error' })
    return null
  }
}

// ── Mark webhook processed ────────────────────────────────────────

export async function markWebhookProcessed(params: {
  logId:             string
  statusCode:        number
  durationMs:        number
  processingStatus?: ProcessingStatus
  safeSummary?:      string | null
  businessId?:       string | null
  db?:               DbClient
}): Promise<void> {
  const client = params.db ?? createServiceRoleClient()
  try {
    await client.from('webhook_delivery_logs').update({
      processing_status: params.processingStatus ?? 'processed',
      status_code:       params.statusCode,
      duration_ms:       params.durationMs,
      safe_summary:      params.safeSummary ?? null,
      processed_at:      new Date().toISOString(),
    }).eq('id', params.logId)
  } catch (err) {
    captureApiError(err, { route: 'ops/webhook-logs', error_type: 'webhook_log_update_error' })
  }
}

// ── Mark webhook failed ───────────────────────────────────────────

export async function markWebhookFailed(params: {
  logId:        string
  statusCode?:  number
  durationMs?:  number
  errorSummary: string
  db?:          DbClient
}): Promise<void> {
  const client = params.db ?? createServiceRoleClient()
  try {
    await client.from('webhook_delivery_logs').update({
      processing_status: 'failed',
      status_code:       params.statusCode ?? null,
      duration_ms:       params.durationMs ?? null,
      error_summary:     params.errorSummary.slice(0, 200),
      processed_at:      new Date().toISOString(),
    }).eq('id', params.logId)
  } catch (err) {
    captureApiError(err, { route: 'ops/webhook-logs', error_type: 'webhook_log_fail_error' })
  }
}

// ── Update webhook log (generic) ──────────────────────────────────

export async function updateWebhookDeliveryLog(
  logId:   string,
  updates: Partial<Pick<WebhookLog, 'processing_status' | 'verification_status' | 'status_code' | 'duration_ms' | 'error_summary' | 'safe_summary' | 'processed_at' | 'business_id'>>,
  db?:     DbClient,
): Promise<void> {
  const client = db ?? createServiceRoleClient()
  try {
    await client.from('webhook_delivery_logs').update(updates).eq('id', logId)
  } catch (err) {
    captureApiError(err, { route: 'ops/webhook-logs', error_type: 'webhook_log_generic_update_error' })
  }
}

// ── Query webhook logs ────────────────────────────────────────────

export async function getWebhookDeliveryLogs(params: {
  businessId?:         string | null
  provider?:           string
  verificationStatus?: string
  processingStatus?:   string
  search?:             string
  page?:               number
  pageSize?:           number
  db?:                 DbClient
}): Promise<{
  rows:        WebhookLog[]
  total_count: number
  error:       string | null
}> {
  const client = params.db ?? createServiceRoleClient()
  const ps     = params.pageSize ?? 20
  const pg     = params.page ?? 1
  const from   = (pg - 1) * ps
  const to     = from + ps - 1

  try {
    let query = client.from('webhook_delivery_logs')
      .select('*', { count: 'exact' })
      .order('received_at', { ascending: false })
      .range(from, to)

    if (params.businessId)         query = query.or(`business_id.eq.${params.businessId},business_id.is.null`)
    if (params.provider)           query = query.eq('provider', params.provider)
    if (params.verificationStatus) query = query.eq('verification_status', params.verificationStatus)
    if (params.processingStatus)   query = query.eq('processing_status', params.processingStatus)

    if (params.search && params.search.length >= 3) {
      query = (query as ReturnType<typeof client.from>).textSearch('search_vector', params.search.trim(), { type: 'websearch', config: 'english' }) as typeof query
    } else if (params.search) {
      query = query.ilike('provider', `%${params.search}%`)
    }

    let { data, count, error } = await query
    if (error && params.search && params.search.length >= 3) {
      const fb = await client.from('webhook_delivery_logs')
        .select('*', { count: 'exact' })
        .ilike('provider', `%${params.search}%`)
        .order('received_at', { ascending: false }).range(from, to)
      data = fb.data; count = fb.count; error = fb.error
    }
    if (error) throw error
    return { rows: (data ?? []) as WebhookLog[], total_count: count ?? 0, error: null }
  } catch (err) {
    captureApiError(err, { route: 'ops/webhook-logs', error_type: 'webhook_log_query_error' })
    return { rows: [], total_count: 0, error: 'Could not load webhook logs.' }
  }
}
