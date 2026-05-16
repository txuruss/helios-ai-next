import { NextResponse, type NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { processSlaBreaches } from '@/lib/ops/sla'
import { captureApiError } from '@/lib/logging/api'

// POST /api/cron/ops/sla
// Scheduled cron endpoint — processes SLA breaches across all businesses.
//
// Phase 17: Accepts CRON_SECRET (preferred, Vercel native) or OPS_CRON_SECRET (fallback)
//
// Vercel Cron (vercel.json):
//   { "crons": [{ "path": "/api/cron/ops/sla", "schedule": "*/10 * * * *" }] }
//
// The cron caller must set: Authorization: Bearer ${CRON_SECRET or OPS_CRON_SECRET}
// Vercel Cron natively sends Authorization: Bearer ${CRON_SECRET} when CRON_SECRET is set.
// For external schedulers, use OPS_CRON_SECRET.

function validateCronSecret(authHeader: string | null): {
  valid: boolean
  secretType: string
} {
  const cronSecret     = process.env.CRON_SECRET
  const opsCronSecret  = process.env.OPS_CRON_SECRET
  const token          = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) return { valid: false, secretType: 'missing' }

  // Prefer CRON_SECRET (Vercel native)
  if (cronSecret && token === cronSecret) return { valid: true, secretType: 'CRON_SECRET' }
  // Fallback to OPS_CRON_SECRET
  if (opsCronSecret && token === opsCronSecret) return { valid: true, secretType: 'OPS_CRON_SECRET' }

  return { valid: false, secretType: 'invalid' }
}

function detectTriggerSource(request: NextRequest): string {
  // Vercel Cron adds this header
  if (request.headers.get('x-vercel-deployment-url')) return 'vercel_cron'
  if (request.headers.get('x-cron-trigger') === 'manual') return 'manual_dashboard'
  return 'external_scheduler'
}

// GET — health check (does NOT run processing)
export async function GET() {
  const cronSecret    = process.env.CRON_SECRET
  const opsCronSecret = process.env.OPS_CRON_SECRET
  const isConfigured  = !!(cronSecret || opsCronSecret)
  return NextResponse.json({
    status:     isConfigured ? 'ok' : 'unconfigured',
    message:    isConfigured
      ? `SLA cron is configured (${cronSecret ? 'CRON_SECRET' : 'OPS_CRON_SECRET'}). POST to trigger.`
      : 'Neither CRON_SECRET nor OPS_CRON_SECRET is set.',
    secret_type: cronSecret ? 'CRON_SECRET' : opsCronSecret ? 'OPS_CRON_SECRET' : 'none',
  })
}

// POST — run SLA processing
export async function POST(request: NextRequest) {
  const startedAt = Date.now()

  const { valid, secretType } = validateCronSecret(request.headers.get('authorization'))

  if (!valid) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[cron/sla] Unauthorized. secretType:', secretType)
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (!process.env.CRON_SECRET && !process.env.OPS_CRON_SECRET) {
      return NextResponse.json({
        error:   'No cron secret configured.',
        help:    'Set CRON_SECRET or OPS_CRON_SECRET in your environment variables.',
        message: 'Development mode: set CRON_SECRET=test-secret and pass Authorization: Bearer test-secret',
      }, { status: 503 })
    }
    console.error('[cron/sla] Invalid secret in dev mode — rejecting')
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const triggerSource = detectTriggerSource(request)
  const db            = createServiceRoleClient()
  const startedAtIso  = new Date().toISOString()
  let totalChecked    = 0
  let totalBreached   = 0
  let totalEscalated  = 0
  let failedCount     = 0
  let businessCount   = 0

  try {
    // Find all businesses with active SLA items
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

    const durationMs   = Date.now() - startedAt
    const completedAt  = new Date().toISOString()
    const skippedCount = Math.max(0, allBusinessIds.length - businessCount)

    // Log cron run
    await db.from('ops_cron_runs').insert({
      business_id:         null,
      job_name:            'sla_check',
      status:              failedCount === businessCount && businessCount > 0 ? 'failed' : 'completed',
      checked_count:       totalChecked,
      breached_count:      totalBreached,
      escalated_count:     totalEscalated,
      notified_count:      0,
      failed_count:        failedCount,
      skipped_count:       skippedCount,
      businesses_checked:  businessCount,
      duration_ms:         durationMs,
      trigger_source:      triggerSource,
      cron_secret_type:    secretType,
      started_at:          startedAtIso,
      completed_at:        completedAt,
      metadata:            { businesses: allBusinessIds.length },
    }).catch(() => undefined)

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
      trigger_source:      triggerSource,
      secret_type:         secretType,
    })

  } catch (err) {
    const durationMs = Date.now() - startedAt
    captureApiError(err, { route: '/api/cron/ops/sla', error_type: 'cron_sla_error' })

    await db.from('ops_cron_runs').insert({
      business_id:      null,
      job_name:         'sla_check',
      status:           'failed',
      error_message:    err instanceof Error ? err.message.slice(0, 500) : 'Unknown error',
      duration_ms:      durationMs,
      trigger_source:   triggerSource,
      cron_secret_type: secretType,
      started_at:       startedAtIso,
      completed_at:     new Date().toISOString(),
    }).catch(() => undefined)

    return NextResponse.json({ error: 'Cron SLA check failed.' }, { status: 500 })
  }
}
