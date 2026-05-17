import { NextResponse, type NextRequest } from 'next/server'
import { processSlaBreaches } from '@/lib/ops/sla'
import { captureApiError } from '@/lib/logging/api'
import {
  verifyCronRequest,
  getCronVerificationMethod,
  createCronRunLog,
  completeCronRunLog,
  failCronRunLog,
} from '@/lib/ops/cron'
import { capture } from '@/lib/analytics/posthog'
import { createServiceRoleClient } from '@/lib/supabase/server'

// POST /api/cron/ops/sla
// Scheduled cron endpoint — processes SLA breaches across all businesses.
//
// Phase 18: Uses lib/ops/cron.ts for verification + run logging.
//   Accepts Authorization: Bearer ${CRON_SECRET|VERCEL_CRON_SECRET|OPS_CRON_SECRET}
//   Priority: CRON_SECRET > VERCEL_CRON_SECRET > OPS_CRON_SECRET
//
// Vercel Cron (vercel.json):
//   { "crons": [{ "path": "/api/cron/ops/sla", "schedule": "*/10 * * * *" }] }

// GET — health check (does NOT run processing)
export async function GET() {
  const activeMethod  = getCronVerificationMethod()
  const isConfigured  = activeMethod !== 'none'
  return NextResponse.json({
    status:              isConfigured ? 'ok' : 'unconfigured',
    message:             isConfigured
      ? `SLA cron is configured (${activeMethod}). POST to trigger.`
      : 'No cron secret is set. Set CRON_SECRET, VERCEL_CRON_SECRET, or OPS_CRON_SECRET.',
    active_method:       activeMethod,
    secrets_configured: {
      CRON_SECRET:        !!process.env.CRON_SECRET,
      VERCEL_CRON_SECRET: !!process.env.VERCEL_CRON_SECRET,
      OPS_CRON_SECRET:    !!process.env.OPS_CRON_SECRET,
    },
  })
}

// POST — run SLA processing
export async function POST(request: NextRequest) {
  const startedAtMs = Date.now()

  const { valid, verificationMethod, requestSource } = verifyCronRequest(request)

  if (!valid) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[cron/sla] Unauthorized. method:', verificationMethod)
      capture('ops_cron_verification_failed', { verification_method: verificationMethod, request_source: requestSource })
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    const hasAnySecret = !!(process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET || process.env.OPS_CRON_SECRET)
    if (!hasAnySecret) {
      return NextResponse.json({
        error:   'No cron secret configured.',
        help:    'Set CRON_SECRET, VERCEL_CRON_SECRET, or OPS_CRON_SECRET.',
        message: 'Development: add CRON_SECRET=test-secret to .env.local and pass Authorization: Bearer test-secret',
      }, { status: 503 })
    }
    console.error('[cron/sla] Invalid secret in dev mode — rejecting')
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  capture('ops_cron_verified', { verification_method: verificationMethod, request_source: requestSource })

  const startedAt  = new Date(startedAtMs).toISOString()
  const triggerSrc = requestSource === 'vercel' ? 'vercel_cron' : requestSource === 'local' ? 'manual_dashboard' : 'external_scheduler'

  // Create run log entry at start
  const { runId } = await createCronRunLog({
    jobName:            'sla_check',
    triggerSource:      triggerSrc,
    verificationMethod: verificationMethod,
    requestSource:      requestSource,
  })

  const db = createServiceRoleClient()
  let totalChecked   = 0
  let totalBreached  = 0
  let totalEscalated = 0
  let failedCount    = 0
  let businessCount  = 0

  try {
    const [alertRows, taskRows] = await Promise.all([
      db.from('ops_alerts').select('business_id').eq('status', 'active').not('sla_due_at', 'is', null).limit(100),
      db.from('ops_tasks').select('business_id').in('status', ['pending','in_progress']).not('sla_due_at', 'is', null).limit(100),
    ])

    const allBusinessIds = [...new Set([
      ...((alertRows.data ?? []) as { business_id: string | null }[]).map((r) => r.business_id).filter((id): id is string => !!id),
      ...((taskRows.data ?? []) as { business_id: string | null }[]).map((r) => r.business_id).filter((id): id is string => !!id),
    ])]

    businessCount = allBusinessIds.length

    for (const bId of allBusinessIds) {
      try {
        const result = await processSlaBreaches(bId, db)
        totalChecked   += result.checked
        totalBreached  += result.breached
        totalEscalated += result.escalated
      } catch (err) {
        console.error('[cron/sla] Failed for business:', bId.slice(0, 8), err instanceof Error ? err.message : err)
        failedCount++
      }
    }

    const durationMs   = Date.now() - startedAtMs
    const skippedCount = 0

    await completeCronRunLog({
      runId,
      startedAt,
      jobName:            'sla_check',
      verificationMethod: verificationMethod,
      requestSource:      requestSource,
      triggerSource:      triggerSrc,
      businessesChecked:  businessCount,
      checkedCount:       totalChecked,
      breachedCount:      totalBreached,
      escalatedCount:     totalEscalated,
      notifiedCount:      0,
      failedCount:        failedCount,
      skippedCount:       skippedCount,
    })

    return NextResponse.json({
      ok:                  true,
      businesses_checked:  businessCount,
      checked_count:       totalChecked,
      breached_count:      totalBreached,
      escalated_count:     totalEscalated,
      notified_count:      0,
      failed_count:        failedCount,
      skipped_count:       skippedCount,
      duration_ms:         durationMs,
      trigger_source:      triggerSrc,
      verification_method: verificationMethod,
    })

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    captureApiError(err, { route: '/api/cron/ops/sla', error_type: 'cron_sla_error' })

    await failCronRunLog({
      runId,
      startedAt,
      jobName:            'sla_check',
      verificationMethod: verificationMethod,
      requestSource:      requestSource,
      triggerSource:      triggerSrc,
      errorMessage,
    })

    return NextResponse.json({ error: 'Cron SLA check failed.' }, { status: 500 })
  }
}
