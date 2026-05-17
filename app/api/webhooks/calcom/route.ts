import { NextResponse, type NextRequest } from 'next/server'
import { createHmac } from 'crypto'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { calcomWebhookSchema } from '@/lib/validation/calcom'
import { createWebhookDeliveryLog, markWebhookProcessed, markWebhookFailed } from '@/lib/ops/webhook-logs'

const MAX_BODY_BYTES = 64 * 1024

// POST /api/webhooks/calcom
// Receives booking lifecycle events from Cal.com.
// Verifies HMAC signature when CALCOM_WEBHOOK_SECRET is set.

function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.CALCOM_WEBHOOK_SECRET
  if (!secret) {
    // In production, unsigned webhooks should not be trusted.
    if (process.env.NODE_ENV === 'production') {
      console.warn('[webhook/calcom] CALCOM_WEBHOOK_SECRET not set — rejecting in production')
      return false
    }
    // In development, allow unsigned for local testing only.
    console.warn('[webhook/calcom] CALCOM_WEBHOOK_SECRET not set — allowing in development (insecure)')
    return true
  }

  if (!signature) return false

  // Cal.com sends: X-Cal-Signature-256: sha256=<hex>
  const expected = `sha256=${createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')}`
  return signature === expected
}

export async function POST(request: NextRequest) {
  const startMs = Date.now()
  const rawBody = await request.text().catch(() => '')
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large.' }, { status: 413 })
  }

  const signature = request.headers.get('x-cal-signature-256')
  if (!verifySignature(rawBody, signature)) {
    console.error('[webhook/calcom] Signature verification failed')
    void createWebhookDeliveryLog({ provider: 'calcom', routePath: '/api/webhooks/calcom', verificationStatus: 'failed', safeSummary: 'Signature verification failed' })
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  let body: unknown
  try { body = JSON.parse(rawBody) } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const parsed = calcomWebhookSchema.safeParse(body)
  if (!parsed.success) {
    console.error('[webhook/calcom] Schema validation failed:', parsed.error.errors[0]?.message)
    // Still return 200 so Cal.com doesn't retry unknown event types
    return NextResponse.json({ ok: true, message: 'Event type not handled.' })
  }

  const { triggerEvent, payload } = parsed.data
  const db  = createServiceRoleClient()
  const logId = await createWebhookDeliveryLog({
    provider:            'calcom',
    routePath:           '/api/webhooks/calcom',
    eventType:           triggerEvent,
    verificationStatus:  process.env.CALCOM_WEBHOOK_SECRET ? 'verified' : 'skipped',
    externalEventId:     payload.uid ?? null,
    safeSummary:         `calcom ${triggerEvent}`,
    db,
  })

  // Map Cal.com status → our booking status
  const STATUS_MAP: Record<string, string> = {
    BOOKING_CREATED:      'confirmed',
    BOOKING_CONFIRMED:    'confirmed',
    BOOKING_CANCELLED:    'cancelled',
    BOOKING_RESCHEDULED:  'confirmed',
    BOOKING_REJECTED:     'cancelled',
  }
  const newStatus = STATUS_MAP[triggerEvent]

  if (payload.uid && newStatus) {
    const { data: booking } = await db
      .from('bookings')
      .select('id, business_id, status')
      .eq('calcom_booking_uid', payload.uid)
      .single()

    if (booking) {
      const updates: Record<string, unknown> = { status: newStatus }

      // Update scheduled_at on reschedule
      if (triggerEvent === 'BOOKING_RESCHEDULED' && payload.startTime) {
        updates.scheduled_at = payload.startTime
      }

      await db.from('bookings').update(updates).eq('id', booking.id)

      // Audit log
      await db.from('audit_logs').insert({
        business_id:  booking.business_id,
        user_id:      null,
        action:       `calcom.webhook.${triggerEvent.toLowerCase()}`,
        resource:     'bookings',
        resource_id:  booking.id,
        old_values:   { status: booking.status },
        new_values:   updates,
      })

      console.log(`[webhook/calcom] ${triggerEvent} → booking ${booking.id} updated to ${newStatus}`)
    } else {
      console.warn('[webhook/calcom] Booking not found for uid:', payload.uid)
    }
  }

  if (logId) void markWebhookProcessed({ logId, statusCode: 200, durationMs: Date.now() - startMs, db })
  return NextResponse.json({ ok: true })
}
