import { NextResponse, type NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { verifyCronRequest } from '@/lib/ops/cron'
import { captureApiError } from '@/lib/logging/api'
import { logBookingConfirmationEvent } from '@/lib/bookings/confirmation'

// GET — health check
export async function GET() {
  const isConfigured = !!(process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET || process.env.OPS_CRON_SECRET)
  return NextResponse.json({
    status:  isConfigured ? 'ok' : 'unconfigured',
    message: 'POST to expire overdue booking confirmations.',
  })
}

// POST — expire overdue booking confirmations
export async function POST(request: NextRequest) {
  const startMs = Date.now()

  const { valid, verificationMethod } = verifyCronRequest(request)
  if (!valid) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    const hasSecret = !!(process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET || process.env.OPS_CRON_SECRET)
    if (!hasSecret) {
      return NextResponse.json({ error: 'No cron secret configured.', help: 'Set CRON_SECRET in .env.local' }, { status: 503 })
    }
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const db  = createServiceRoleClient()
  const now = new Date().toISOString()

  let checkedCount  = 0
  let expiredCount  = 0
  let skippedCount  = 0

  try {
    // Find expired pending bookings
    const { data: expiredBookings } = await db
      .from('bookings')
      .select('id, business_id')
      .in('confirmation_status', ['pending', 'customer_confirmed', 'owner_confirmed'])
      .lt('confirmation_expires_at', now)
      .not('confirmation_expires_at', 'is', null)
      .limit(200)

    checkedCount = (expiredBookings ?? []).length

    for (const booking of (expiredBookings ?? []) as Array<{ id: string; business_id: string }>) {
      try {
        const { error: upErr } = await db.from('bookings').update({
          confirmation_status: 'expired',
          expired_by_cron_at:  now,
        }).eq('id', booking.id)

        if (upErr) { skippedCount++; continue }

        await logBookingConfirmationEvent({
          businessId:  booking.business_id,
          bookingId:   booking.id,
          eventType:   'expired',
          actorType:   'system',
          safeSummary: 'Confirmation expired by cron',
          db,
        })

        // Ops event (fire-and-forget)
        await db.from('ops_events').insert({
          business_id: booking.business_id,
          source:      'bookings',
          event_type:  'booking_confirmation_expired',
          severity:    'info',
          title:       'Booking confirmation expired',
          status:      'resolved',
          related_table: 'bookings',
          related_id:  booking.id,
          metadata:    {},
        }).catch(() => undefined)

        expiredCount++
      } catch {
        skippedCount++
      }
    }

    const durationMs = Date.now() - startMs

    return NextResponse.json({
      ok:                  true,
      checked_count:       checkedCount,
      expired_count:       expiredCount,
      skipped_count:       skippedCount,
      duration_ms:         durationMs,
      verification_method: verificationMethod,
    })

  } catch (err) {
    captureApiError(err, { route: '/api/cron/bookings/expire-confirmations', error_type: 'booking_expiry_cron_error' })
    return NextResponse.json({ error: 'Booking expiry cron failed.' }, { status: 500 })
  }
}
