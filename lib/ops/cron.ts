// ── Ops cron verification and run logging — server-only ───────────
// Centralises cron secret verification and run log management.
// Phase 18: adds VERCEL_CRON_SECRET + verification_method tracking.

import 'server-only'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { captureApiError } from '@/lib/logging/api'
import type { NextRequest } from 'next/server'

// ── Types ─────────────────────────────────────────────────────────

export type VerificationMethod =
  | 'CRON_SECRET'
  | 'VERCEL_CRON_SECRET'
  | 'OPS_CRON_SECRET'
  | 'vercel_header'
  | 'vercel_signature_unavailable'
  | 'missing'
  | 'invalid'

export type RequestSource = 'vercel' | 'external_scheduler' | 'local' | 'unknown'

export interface CronVerificationResult {
  valid:               boolean
  verificationMethod:  VerificationMethod
  requestSource:       RequestSource
}

export interface CronRunLogResult {
  runId:   string | null
  started: string
}

// ── Verification ──────────────────────────────────────────────────

export function verifyCronRequest(request: NextRequest): CronVerificationResult {
  const cronSecret        = process.env.CRON_SECRET
  const vercelCronSecret  = process.env.VERCEL_CRON_SECRET
  const opsCronSecret     = process.env.OPS_CRON_SECRET

  const authHeader = request.headers.get('authorization')
  const token      = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  const requestSource = detectRequestSource(request)

  if (!token) {
    return { valid: false, verificationMethod: 'missing', requestSource }
  }

  // Priority: CRON_SECRET > VERCEL_CRON_SECRET > OPS_CRON_SECRET
  if (cronSecret && token === cronSecret) {
    return { valid: true, verificationMethod: 'CRON_SECRET', requestSource }
  }
  if (vercelCronSecret && token === vercelCronSecret) {
    return { valid: true, verificationMethod: 'VERCEL_CRON_SECRET', requestSource }
  }
  if (opsCronSecret && token === opsCronSecret) {
    return { valid: true, verificationMethod: 'OPS_CRON_SECRET', requestSource }
  }

  // Note on Vercel platform signature: Vercel Cron does not currently provide a
  // cryptographic HMAC signature in request headers beyond the Bearer token pattern.
  // The x-vercel-deployment-url and x-vercel-id headers are informational only and
  // must NOT be used as authentication. Bearer secret verification is the correct
  // and Vercel-recommended approach. If true header-based verification becomes
  // available, it would be added here with label 'vercel_header'.

  return { valid: false, verificationMethod: 'invalid', requestSource }
}

export function getCronVerificationMethod(): string {
  if (process.env.CRON_SECRET)       return 'CRON_SECRET'
  if (process.env.VERCEL_CRON_SECRET) return 'VERCEL_CRON_SECRET'
  if (process.env.OPS_CRON_SECRET)   return 'OPS_CRON_SECRET'
  return 'none'
}

function detectRequestSource(request: NextRequest): RequestSource {
  if (request.headers.get('x-vercel-deployment-url') || request.headers.get('x-vercel-id')) {
    return 'vercel'
  }
  const host = request.headers.get('host') ?? ''
  if (host.includes('localhost') || host.includes('127.0.0.1')) return 'local'
  if (request.headers.get('x-cron-trigger')) return 'external_scheduler'
  return 'unknown'
}

// ── Cron run logging ──────────────────────────────────────────────

export async function createCronRunLog(params: {
  jobName:             string
  triggerSource:       string
  verificationMethod:  string
  requestSource:       string
}): Promise<CronRunLogResult> {
  const db        = createServiceRoleClient()
  const startedAt = new Date().toISOString()
  try {
    const { data } = await db.from('ops_cron_runs').insert({
      business_id:          null,
      job_name:             params.jobName,
      status:               'started',
      trigger_source:       params.triggerSource,
      cron_secret_type:     params.verificationMethod,
      verification_method:  params.verificationMethod,
      request_source:       params.requestSource,
      started_at:           startedAt,
      checked_count:        0,
      breached_count:       0,
      escalated_count:      0,
      notified_count:       0,
      failed_count:         0,
      skipped_count:        0,
      businesses_checked:   0,
    }).select('id').single()

    const runId = (data as { id: string } | null)?.id ?? null
    return { runId, started: startedAt }
  } catch {
    return { runId: null, started: startedAt }
  }
}

export async function completeCronRunLog(params: {
  runId:              string | null
  startedAt:          string
  jobName:            string
  verificationMethod: string
  requestSource:      string
  triggerSource:      string
  businessesChecked:  number
  checkedCount:       number
  breachedCount:      number
  escalatedCount:     number
  notifiedCount:      number
  failedCount:        number
  skippedCount:       number
}): Promise<void> {
  const db         = createServiceRoleClient()
  const now        = new Date().toISOString()
  const durationMs = Date.now() - new Date(params.startedAt).getTime()

  const payload = {
    status:               params.failedCount > 0 && params.failedCount === params.businessesChecked ? 'failed' : 'completed',
    businesses_checked:   params.businessesChecked,
    checked_count:        params.checkedCount,
    breached_count:       params.breachedCount,
    escalated_count:      params.escalatedCount,
    notified_count:       params.notifiedCount,
    failed_count:         params.failedCount,
    skipped_count:        params.skippedCount,
    duration_ms:          durationMs,
    completed_at:         now,
    verification_method:  params.verificationMethod,
    request_source:       params.requestSource,
  }

  try {
    if (params.runId) {
      await db.from('ops_cron_runs').update(payload).eq('id', params.runId)
    } else {
      await db.from('ops_cron_runs').insert({
        ...payload,
        business_id:      null,
        job_name:         params.jobName,
        trigger_source:   params.triggerSource,
        cron_secret_type: params.verificationMethod,
        started_at:       params.startedAt,
      })
    }
  } catch (err) {
    captureApiError(err, { route: 'ops/cron', error_type: 'cron_log_complete_error' })
  }
}

export async function failCronRunLog(params: {
  runId:              string | null
  startedAt:          string
  jobName:            string
  verificationMethod: string
  requestSource:      string
  triggerSource:      string
  errorMessage:       string
}): Promise<void> {
  const db         = createServiceRoleClient()
  const now        = new Date().toISOString()
  const durationMs = Date.now() - new Date(params.startedAt).getTime()

  const safeError = params.errorMessage.slice(0, 500)
  const payload = {
    status:              'failed',
    error_message:       safeError,
    duration_ms:         durationMs,
    completed_at:        now,
    verification_method: params.verificationMethod,
    request_source:      params.requestSource,
  }

  try {
    if (params.runId) {
      await db.from('ops_cron_runs').update(payload).eq('id', params.runId)
    } else {
      await db.from('ops_cron_runs').insert({
        ...payload,
        business_id:      null,
        job_name:         params.jobName,
        trigger_source:   params.triggerSource,
        cron_secret_type: params.verificationMethod,
        started_at:       params.startedAt,
        checked_count:    0,
        breached_count:   0,
        escalated_count:  0,
        failed_count:     0,
      })
    }
  } catch (err) {
    captureApiError(err, { route: 'ops/cron', error_type: 'cron_log_fail_error' })
  }
}
