'use server'

import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { captureApiError } from '@/lib/logging/api'
import { capture } from '@/lib/analytics/posthog'

type DbRow = Record<string, unknown>

async function requireAuth(): Promise<
  { ok: true; userId: string; businessId: string } |
  { ok: false; error: string }
> {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated.' }

  const db = createServiceRoleClient()
  const { data: membership } = await db
    .from('business_members').select('business_id').eq('user_id', user.id).limit(1).single()
  if (!membership) return { ok: false, error: 'No business found.' }

  return { ok: true, userId: user.id, businessId: (membership as DbRow).business_id as string }
}

// ── Owner confirm booking ─────────────────────────────────────────

export async function ownerConfirmBooking(
  bookingId: string,
): Promise<{ success?: string; error?: string }> {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const db = createServiceRoleClient()

  try {
    const { data: booking } = await db
      .from('bookings')
      .select('id, business_id, confirmation_status, customer_confirmed_at')
      .eq('id', bookingId)
      .eq('business_id', auth.businessId)
      .single()

    if (!booking) return { error: 'Booking not found.' }
    const b = booking as DbRow

    const customerHasConfirmed = !!(b.customer_confirmed_at)
    const newConfirmStatus = customerHasConfirmed ? 'confirmed' : 'owner_confirmed'

    await db.from('bookings').update({
      owner_review_status: 'approved',
      owner_reviewed_by:   auth.userId,
      owner_reviewed_at:   new Date().toISOString(),
      confirmation_status: newConfirmStatus,
      ...(customerHasConfirmed ? {} : { owner_confirmed_at: new Date().toISOString() }),
    }).eq('id', bookingId).eq('business_id', auth.businessId)

    // Log event (fire-and-forget)
    void import('@/lib/bookings/confirmation').then(({ logBookingConfirmationEvent }) =>
      logBookingConfirmationEvent({
        businessId:  auth.businessId,
        bookingId,
        eventType:   'owner_confirmed',
        actorType:   'owner',
        safeSummary: `Owner confirmed — status: ${newConfirmStatus}`,
        db,
      })
    ).catch(() => undefined)

    // Ops event (fire-and-forget)
    void import('@/lib/ops/events').then(({ createOpsEvent }) =>
      createOpsEvent({
        business_id:   auth.businessId,
        source:        'bookings',
        event_type:    'booking_owner_confirmed',
        severity:      'info',
        title:         'Owner confirmed a booking',
        related_table: 'bookings',
        related_id:    bookingId,
      }, db)
    ).catch(() => undefined)

    capture('booking_owner_confirmed', { status: newConfirmStatus })

    return { success: newConfirmStatus === 'confirmed' ? 'Booking fully confirmed.' : 'Booking marked as owner confirmed.' }
  } catch (err) {
    captureApiError(err, { route: 'actions/bookings', error_type: 'owner_confirm_error', business_id: auth.businessId })
    return { error: 'Could not confirm booking.' }
  }
}

// ── Owner reject booking ──────────────────────────────────────────

export async function ownerRejectBooking(
  bookingId: string,
  reason?:   string,
): Promise<{ success?: string; error?: string }> {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const db = createServiceRoleClient()

  try {
    const { data: booking } = await db
      .from('bookings').select('id, business_id').eq('id', bookingId).eq('business_id', auth.businessId).single()
    if (!booking) return { error: 'Booking not found.' }

    await db.from('bookings').update({
      owner_review_status: 'rejected',
      owner_reviewed_by:   auth.userId,
      owner_reviewed_at:   new Date().toISOString(),
      confirmation_status: 'rejected',
      rejected_at:         new Date().toISOString(),
      rejection_reason:    reason ? reason.slice(0, 256) : null,
    }).eq('id', bookingId).eq('business_id', auth.businessId)

    // Log event
    void import('@/lib/bookings/confirmation').then(({ logBookingConfirmationEvent }) =>
      logBookingConfirmationEvent({
        businessId:  auth.businessId,
        bookingId,
        eventType:   'rejected',
        actorType:   'owner',
        safeSummary: 'Owner rejected booking',
        db,
      })
    ).catch(() => undefined)

    // Ops event
    void import('@/lib/ops/events').then(({ createOpsEvent }) =>
      createOpsEvent({
        business_id:   auth.businessId,
        source:        'bookings',
        event_type:    'booking_owner_rejected',
        severity:      'info',
        title:         'Owner rejected a booking',
        related_table: 'bookings',
        related_id:    bookingId,
      }, db)
    ).catch(() => undefined)

    capture('booking_owner_rejected', { has_reason: !!reason })

    return { success: 'Booking rejected.' }
  } catch (err) {
    captureApiError(err, { route: 'actions/bookings', error_type: 'owner_reject_error', business_id: auth.businessId })
    return { error: 'Could not reject booking.' }
  }
}
