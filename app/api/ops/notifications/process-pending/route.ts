import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { processPendingNotifications } from '@/lib/ops/notification-delivery'
import { verifyCronRequest } from '@/lib/ops/cron'
import { captureApiError } from '@/lib/logging/api'
import { capture } from '@/lib/analytics/posthog'

// POST /api/ops/notifications/process-pending
// Processes due scheduled/retrying notification delivery logs.
// Can be called from dashboard (authenticated) or as a cron job (CRON_SECRET).

export async function POST(request: NextRequest) {
  // Check if this is a cron request (verifyCronRequest reads Authorization header internally)
  const { valid: isCronValid, verificationMethod } = verifyCronRequest(request)

  let businessId: string | null = null
  let isAdmin = false

  if (isCronValid) {
    // Cron mode: process all businesses
    isAdmin = true
  } else {
    // Dashboard mode: require auth, scope to user's business
    const authClient = await createClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

    const db = createServiceRoleClient()
    const { data: membership } = await db
      .from('business_members').select('business_id').eq('user_id', user.id).limit(1).single()
    if (!membership) return NextResponse.json({ error: 'No business found.' }, { status: 404 })
    businessId = (membership as { business_id: string }).business_id
  }

  const db = createServiceRoleClient()

  try {
    if (isAdmin && !businessId) {
      // Cron mode: find all businesses with pending/retrying logs
      const { data: bizRows } = await db
        .from('notification_delivery_logs')
        .select('business_id')
        .in('delivery_status', ['scheduled', 'retrying'])
        .lte('next_retry_at', new Date().toISOString())
        .not('business_id', 'is', null)
        .limit(50)

      const bizIds = [...new Set(
        ((bizRows ?? []) as { business_id: string | null }[])
          .map((r) => r.business_id)
          .filter((id): id is string => !!id)
      )]

      let totalProcessed = 0, totalSent = 0, totalFailed = 0, totalSkipped = 0

      for (const bId of bizIds) {
        const result = await processPendingNotifications(bId, db)
        totalProcessed += result.processed
        totalSent      += result.sent
        totalFailed    += result.failed
        totalSkipped   += result.skipped
      }

      capture('notification_pending_processed', {
        processed: totalProcessed,
        sent:      totalSent,
        failed:    totalFailed,
        mode:      'cron',
      })

      return NextResponse.json({
        ok:         true,
        processed:  totalProcessed,
        sent:       totalSent,
        failed:     totalFailed,
        skipped:    totalSkipped,
        businesses: bizIds.length,
        mode:       'cron',
        verification_method: verificationMethod,
      })
    }

    // Dashboard mode: single business
    const result = await processPendingNotifications(businessId!, db)

    capture('notification_pending_processed', {
      processed: result.processed,
      sent:      result.sent,
      failed:    result.failed,
      mode:      'dashboard',
    })

    return NextResponse.json({
      ok:        true,
      processed: result.processed,
      sent:      result.sent,
      failed:    result.failed,
      skipped:   result.skipped,
      mode:      'dashboard',
    })

  } catch (err) {
    captureApiError(err, {
      route:      '/api/ops/notifications/process-pending',
      error_type: 'process_pending_error',
    })
    return NextResponse.json({ error: 'Processing failed.' }, { status: 500 })
  }
}

