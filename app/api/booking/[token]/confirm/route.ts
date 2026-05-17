import { NextResponse, type NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import {
  confirmBookingByCustomer,
  sendOwnerBookingConfirmedEmail,
  checkCalcomAvailability,
} from '@/lib/bookings/confirmation'
import { captureApiError } from '@/lib/logging/api'

// POST /api/booking/[token]/confirm
// Public — validates token server-side. No auth required.

interface Params { params: Promise<{ token: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const { token } = await params

  if (!token || token.length < 32) {
    return NextResponse.json({ error: 'Invalid token.' }, { status: 400 })
  }

  const db = createServiceRoleClient()

  try {
    // Step 1: Check Cal.com availability before finalising (non-blocking — skipped if not configured)
    const { data: booking } = await db.from('bookings')
      .select('id, business_id, scheduled_at, calcom_event_type_id, customer_name, customer_email, services(name), businesses(name, owner_notification_email)')
      .eq('customer_portal_token', token)
      .single()

    if (booking) {
      const b = booking as {
        id: string
        business_id: string
        scheduled_at: string | null
        calcom_event_type_id: number | null
        customer_name: string | null
        customer_email: string | null
        services?: { name?: string } | null
        businesses?: { name?: string; owner_notification_email?: string | null } | null
      }

      // Cal.com availability check (fire-and-forget, non-blocking)
      void checkCalcomAvailability({
        bookingId:         b.id,
        businessId:        b.business_id,
        scheduledAt:       b.scheduled_at,
        calcomEventTypeId: b.calcom_event_type_id ?? null,
        db,
      })
    }

    // Step 2: Confirm booking
    const result = await confirmBookingByCustomer(token)
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? 'Could not confirm booking.' }, { status: 400 })
    }

    // Step 3: Send owner notification (fire-and-forget)
    if (booking) {
      const b = booking as {
        id: string
        business_id: string
        scheduled_at: string | null
        customer_name: string | null
        services?: { name?: string } | null
        businesses?: { name?: string; owner_notification_email?: string | null } | null
      }
      const ownerEmail = b.businesses?.owner_notification_email ?? null
      const bizName    = b.businesses?.name ?? 'Your Business'
      const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? 'https://helios.ai'

      if (ownerEmail) {
        void sendOwnerBookingConfirmedEmail({
          bookingId:    b.id,
          businessId:   b.business_id,
          businessName: bizName,
          serviceName:  (b.services as { name?: string } | null)?.name ?? null,
          scheduledAt:  b.scheduled_at,
          customerName: b.customer_name,
          ownerEmail,
          dashboardUrl: appUrl,
          db,
        }).catch(() => undefined)
      }
    }

    return NextResponse.json({ ok: true, status: result.status })
  } catch (err) {
    captureApiError(err, { route: '/api/booking/[token]/confirm', error_type: 'customer_confirm_error' })
    return NextResponse.json({ error: 'Could not confirm booking.' }, { status: 500 })
  }
}
