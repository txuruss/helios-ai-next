import { NextResponse, type NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { processSlaBreaches } from '@/lib/ops/sla'
import { captureApiError } from '@/lib/logging/api'

// POST /api/cron/ops/sla
// Scheduled cron endpoint — processes SLA breaches across all businesses.
// Protected by Authorization: Bearer ${OPS_CRON_SECRET}
//
// Vercel Cron (vercel.json):
//   { "crons": [{ "path": "/api/cron/ops/sla", "schedule": "*/10 * * * *" }] }
//
// The cron runner must set: Authorization: Bearer ${OPS_CRON_SECRET}

// GET — health check (does NOT run processing)
export async function GET() {
  const secret = process.env.OPS_CRON_SECRET
  if (!secret) {
    return NextResponse.json({ status: 'unconfigured', message: 'OPS_CRON_SECRET not set.' }, { status: 200 })
  }
  return NextResponse.json({ status: 'ok', message: 'SLA cron is configured. POST to trigger.' })
}

// POST — run SLA processing
export async function POST(request: NextRequest) {
  const cronSecret = process.env.OPS_CRON_SECRET

  if (!cronSecret) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'OPS_CRON_SECRET not configured.' }, { status: 503 })
    }
    console.warn('[cron/sla] OPS_CRON_SECRET not set — allowing in dev mode')
  }

  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    const token      = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (token !== cronSecret) {
      console.error('[cron/sla] Unauthorized cron request')
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
  }

  const db = createServiceRoleClient()
  const startedAt = new Date().toISOString()
  let totalChecked = 0; let totalBreached = 0; let totalEscalated = 0; let failedCount = 0

  try {
    // Find all businesses with active ops items that have SLA due times
    const { data: businessRows } = await db
      .from('ops_alerts')
      .select('business_id')
      .eq('status', 'active')
      .not('sla_due_at', 'is', null)
      .limit(100)

    const businessIds = [...new Set(
      ((businessRows ?? []) as { business_id: string | null }[])
        .map((r) => r.business_id)
        .filter((id): id is string => !!id),
    )]

    // Also check tasks
    const { data: taskRows } = await db
      .from('ops_tasks')
      .select('business_id')
      .in('status', ['pending','in_progress'])
      .not('sla_due_at', 'is', null)
      .limit(100)

    const taskBusinessIds = ((taskRows ?? []) as { business_id: string | null }[])
      .map((r) => r.business_id)
      .filter((id): id is string => !!id)

    const allBusinessIds = [...new Set([...businessIds, ...taskBusinessIds])]

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

    const completedAt = new Date().toISOString()

    // Log cron run
    await db.from('ops_cron_runs').insert({
      business_id:    null,
      job_name:       'sla_check',
      status:         'completed',
      checked_count:  totalChecked,
      breached_count: totalBreached,
      escalated_count: totalEscalated,
      notified_count: 0,
      started_at:     startedAt,
      completed_at:   completedAt,
      metadata:       { businesses_processed: allBusinessIds.length, failed: failedCount },
    }).catch(() => undefined)

    return NextResponse.json({
      ok:                  true,
      businesses_checked:  allBusinessIds.length,
      checked_count:       totalChecked,
      breached_count:      totalBreached,
      escalated_count:     totalEscalated,
      notified_count:      0,
      failed_count:        failedCount,
    })

  } catch (err) {
    captureApiError(err, { route: '/api/cron/ops/sla', error_type: 'cron_sla_error' })

    await db.from('ops_cron_runs').insert({
      business_id:  null,
      job_name:     'sla_check',
      status:       'failed',
      error_message: err instanceof Error ? err.message.slice(0, 500) : 'Unknown error',
      started_at:   startedAt,
      completed_at: new Date().toISOString(),
    }).catch(() => undefined)

    return NextResponse.json({ error: 'Cron SLA check failed.' }, { status: 500 })
  }
}
