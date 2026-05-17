// ── Booking confirmation and customer portal — server-only ─────────
// Manages confirmation tokens, customer portal links, and status transitions.

import 'server-only'
import { createHash, randomBytes } from 'crypto'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { captureApiError } from '@/lib/logging/api'
import { capture } from '@/lib/analytics/posthog'

type DbClient = ReturnType<typeof createServiceRoleClient>
type DbRow    = Record<string, unknown>

export type ConfirmationStatus =
  | 'pending' | 'customer_confirmed' | 'owner_confirmed'
  | 'confirmed' | 'rejected' | 'expired'

// ── Token generation ──────────────────────────────────────────────

export function generateBookingToken(): string {
  return randomBytes(32).toString('hex')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 32)
}

// ── Create booking confirmation ───────────────────────────────────

export async function createBookingConfirmation(params: {
  bookingId:   string
  businessId:  string
  expiresInHours?: number
  db?:         DbClient
}): Promise<{
  portalToken:    string
  confirmToken:   string
  portalUrl:      string
  error:          string | null
}> {
  const client      = params.db ?? createServiceRoleClient()
  const portalToken = generateBookingToken()
  const confirmToken = generateBookingToken()
  const expiresAt   = new Date(
    Date.now() + (params.expiresInHours ?? 48) * 3600000
  ).toISOString()
  const appUrl      = process.env.NEXT_PUBLIC_APP_URL ?? 'https://helios.ai'
  const portalUrl   = `${appUrl}/booking/${portalToken}`

  try {
    await client.from('bookings').update({
      confirmation_status:        'pending',
      customer_portal_token:      portalToken,
      confirmation_token:         confirmToken,
      customer_portal_expires_at: expiresAt,
    }).eq('id', params.bookingId).eq('business_id', params.businessId)

    await logBookingConfirmationEvent({
      businessId:  params.businessId,
      bookingId:   params.bookingId,
      eventType:   'confirmation_created',
      actorType:   'system',
      safeSummary: 'Confirmation link created',
      db:          client,
    })

    capture('booking_confirmation_created', { status: 'pending' })

    return { portalToken, confirmToken, portalUrl, error: null }
  } catch (err) {
    captureApiError(err, { route: 'bookings/confirmation', error_type: 'create_confirmation_error', business_id: params.businessId })
    return { portalToken: '', confirmToken: '', portalUrl: '', error: 'Could not create booking confirmation.' }
  }
}

// ── Get booking by portal token (public — validates token) ────────

export async function getBookingPortalByToken(token: string): Promise<{
  booking: {
    id:                  string
    business_id:         string
    confirmation_status: string
    scheduled_at:        string | null
    service_name:        string | null
    customer_name:       string | null
    business_name:       string | null
    rejection_reason:    string | null
    expires_at:          string | null
  } | null
  expired: boolean
  error:   string | null
}> {
  const db = createServiceRoleClient()
  const EMPTY = { booking: null, expired: false, error: null }

  if (!token || token.length < 32) return { ...EMPTY, error: 'Invalid token.' }

  try {
    const { data } = await db.from('bookings')
      .select(`
        id, business_id, confirmation_status, scheduled_at,
        customer_portal_expires_at, rejection_reason,
        services(name), businesses(name)
      `)
      .eq('customer_portal_token', token)
      .single()

    if (!data) return { ...EMPTY, error: 'Booking not found or link expired.' }

    const d = data as DbRow & {
      services?: { name?: string } | null
      businesses?: { name?: string } | null
    }

    const expiresAt = d.customer_portal_expires_at as string | null
    const expired   = expiresAt ? new Date(expiresAt).getTime() < Date.now() : false

    // Update status to expired if needed
    if (expired && (d.confirmation_status as string) === 'pending') {
      await db.from('bookings').update({
        confirmation_status: 'expired',
      }).eq('id', d.id as string)

      await logBookingConfirmationEvent({
        businessId: d.business_id as string,
        bookingId:  d.id as string,
        eventType:  'expired',
        actorType:  'system',
        safeSummary: 'Booking confirmation link expired',
        db,
      })
    }

    capture('booking_portal_viewed', { status: d.confirmation_status as string })

    return {
      booking: {
        id:                  d.id as string,
        business_id:         d.business_id as string,
        confirmation_status: expired && (d.confirmation_status as string) === 'pending' ? 'expired' : d.confirmation_status as string,
        scheduled_at:        d.scheduled_at as string | null,
        service_name:        d.services?.name ?? null,
        customer_name:       null, // never expose from portal
        business_name:       d.businesses?.name ?? null,
        rejection_reason:    d.rejection_reason as string | null,
        expires_at:          expiresAt,
      },
      expired,
      error: null,
    }
  } catch (err) {
    captureApiError(err, { route: 'bookings/confirmation', error_type: 'portal_lookup_error' })
    return { ...EMPTY, error: 'Could not load booking details.' }
  }
}

// ── Customer confirms booking ─────────────────────────────────────

export async function confirmBookingByCustomer(
  token: string,
  db?:   DbClient,
): Promise<{ ok: boolean; status?: string; error?: string }> {
  const client = db ?? createServiceRoleClient()

  try {
    const { data } = await client.from('bookings')
      .select('id, business_id, confirmation_status, customer_portal_expires_at')
      .eq('customer_portal_token', token)
      .single()

    if (!data) return { ok: false, error: 'Invalid token.' }

    const d = data as DbRow
    const expiresAt = d.customer_portal_expires_at as string | null
    if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
      return { ok: false, error: 'This booking link has expired.' }
    }
    if (!['pending', 'owner_confirmed'].includes(d.confirmation_status as string)) {
      return { ok: false, error: 'Booking is already confirmed or rejected.' }
    }

    const currentStatus = d.confirmation_status as string
    const newStatus: ConfirmationStatus = currentStatus === 'owner_confirmed' ? 'confirmed' : 'customer_confirmed'

    await client.from('bookings').update({
      confirmation_status:  newStatus,
      customer_confirmed_at: new Date().toISOString(),
    }).eq('id', d.id as string)

    await logBookingConfirmationEvent({
      businessId:  d.business_id as string,
      bookingId:   d.id as string,
      eventType:   'customer_confirmed',
      actorType:   'customer',
      safeSummary: 'Customer confirmed booking via portal',
      db:          client,
    })

    capture('booking_customer_confirmed', { status: newStatus })

    return { ok: true, status: newStatus }
  } catch (err) {
    captureApiError(err, { route: 'bookings/confirmation', error_type: 'customer_confirm_error' })
    return { ok: false, error: 'Could not confirm booking.' }
  }
}

// ── Owner confirms booking ────────────────────────────────────────

export async function confirmBookingByOwner(
  bookingId:  string,
  businessId: string,
  db?:        DbClient,
): Promise<{ ok: boolean; error?: string }> {
  const client = db ?? createServiceRoleClient()
  try {
    const { data } = await client.from('bookings')
      .select('confirmation_status')
      .eq('id', bookingId).eq('business_id', businessId).single()

    if (!data) return { ok: false, error: 'Booking not found.' }

    const currentStatus = (data as DbRow).confirmation_status as string
    const newStatus: ConfirmationStatus = currentStatus === 'customer_confirmed' ? 'confirmed' : 'owner_confirmed'

    await client.from('bookings').update({
      confirmation_status: newStatus,
      owner_confirmed_at:  new Date().toISOString(),
    }).eq('id', bookingId)

    await logBookingConfirmationEvent({
      businessId,
      bookingId,
      eventType:   'owner_confirmed',
      actorType:   'owner',
      safeSummary: 'Owner confirmed booking',
      db:          client,
    })

    capture('booking_owner_confirmed', { status: newStatus })

    return { ok: true }
  } catch (err) {
    captureApiError(err, { route: 'bookings/confirmation', error_type: 'owner_confirm_error', business_id: businessId })
    return { ok: false, error: 'Could not confirm booking.' }
  }
}

// ── Reject booking ────────────────────────────────────────────────

export async function rejectBookingConfirmation(params: {
  bookingId:   string
  businessId?: string
  token?:      string
  reason?:     string
  actorType:   'customer' | 'owner'
  db?:         DbClient
}): Promise<{ ok: boolean; error?: string }> {
  const client = params.db ?? createServiceRoleClient()
  try {
    let query = client.from('bookings').update({
      confirmation_status: 'rejected',
      rejected_at:         new Date().toISOString(),
      rejection_reason:    params.reason ? params.reason.slice(0, 256) : null,
    })

    if (params.token) {
      query = query.eq('customer_portal_token', params.token) as typeof query
    } else {
      query = query.eq('id', params.bookingId).eq('business_id', params.businessId ?? '') as typeof query
    }

    await query

    await logBookingConfirmationEvent({
      businessId:  params.businessId ?? '',
      bookingId:   params.bookingId,
      eventType:   'rejected',
      actorType:   params.actorType,
      safeSummary: `Booking rejected by ${params.actorType}`,
      db:          client,
    })

    capture('booking_rejected', { actor: params.actorType })

    return { ok: true }
  } catch (err) {
    captureApiError(err, { route: 'bookings/confirmation', error_type: 'reject_booking_error' })
    return { ok: false, error: 'Could not reject booking.' }
  }
}

// ── Send booking confirmation email to customer ───────────────────

export async function sendBookingConfirmationEmail(params: {
  bookingId:    string
  businessId:   string
  businessName: string
  serviceName:  string | null
  scheduledAt:  string | null
  customerEmail: string
  portalUrl:    string
  db?:          DbClient
}): Promise<{ ok: boolean; error?: string }> {
  const client = params.db ?? createServiceRoleClient()
  const { sendEmail } = await import('@/lib/resend/client')

  const dateStr = params.scheduledAt
    ? new Date(params.scheduledAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : 'To be confirmed'
  const timeStr = params.scheduledAt
    ? new Date(params.scheduledAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : ''

  const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;background:#0a0a0c;color:#f3f3f3;padding:32px;max-width:600px;margin:0 auto;">
  <div style="background:#0f1012;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px;">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
      <div style="width:36px;height:36px;background:#ff7a18;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px;">📅</div>
      <span style="font-size:18px;font-weight:600;">${params.businessName}</span>
    </div>
    <h2 style="margin:0 0 8px;font-size:19px;color:#f3f3f3;">Booking Request Received</h2>
    <p style="color:#9a9a9d;margin:0 0 20px;font-size:14px;line-height:1.6;">
      Your booking request has been received. Please confirm your appointment using the link below.
    </p>
    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;margin-bottom:24px;">
      ${params.serviceName ? `<div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span style="color:#6a6a6e;font-size:12px;">Service</span><span style="font-size:13px;font-weight:600;">${params.serviceName}</span></div>` : ''}
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span style="color:#6a6a6e;font-size:12px;">Date</span><span style="font-size:13px;font-weight:600;">${dateStr}</span></div>
      ${timeStr ? `<div style="display:flex;justify-content:space-between;"><span style="color:#6a6a6e;font-size:12px;">Time</span><span style="font-size:13px;font-weight:600;">${timeStr}</span></div>` : ''}
    </div>
    <a href="${params.portalUrl}" style="display:inline-block;padding:12px 24px;background:#ff7a18;color:#1a0c00;font-weight:600;border-radius:10px;text-decoration:none;font-size:14px;">
      Confirm My Booking →
    </a>
    <p style="color:#6a6a6e;font-size:12px;margin-top:24px;">
      This link expires in 48 hours. If you did not request this booking, you can ignore this email.
    </p>
  </div>
</body></html>`

  const text = `Booking Request — ${params.businessName}\n\nService: ${params.serviceName ?? 'N/A'}\nDate: ${dateStr}${timeStr ? `\nTime: ${timeStr}` : ''}\n\nConfirm your booking: ${params.portalUrl}\n\nThis link expires in 48 hours.`

  let logId: string | null = null
  try {
    const { data: logRow } = await client.from('booking_confirmation_email_logs').insert({
      business_id:     params.businessId,
      booking_id:      params.bookingId,
      recipient_masked: `${params.customerEmail.slice(0, 2)}***@${params.customerEmail.split('@')[1] ?? ''}`,
      email_status:    'pending',
      provider:        'resend',
    }).select('id').single()
    logId = (logRow as { id?: string } | null)?.id ?? null
  } catch { /* log insert failure is non-fatal */ }

  try {
    const result = await sendEmail({
      to:      params.customerEmail,
      subject: `Confirm your booking — ${params.businessName}`,
      html,
      text,
    })

    const now = new Date().toISOString()
    const emailStatus = result.ok ? 'sent' : 'failed'

    // Update booking email tracking fields
    await client.from('bookings').update({
      customer_confirmation_email_sent_at:  result.ok ? now : null,
      customer_confirmation_email_status:   emailStatus,
    }).eq('id', params.bookingId).eq('business_id', params.businessId)

    // Update log row
    if (logId) {
      await client.from('booking_confirmation_email_logs').update({
        email_status:  emailStatus,
        sent_at:       result.ok ? now : null,
        failed_at:     result.ok ? null : now,
        error_summary: result.ok ? null : 'Resend returned an error.',
      }).eq('id', logId)
    }

    if (!result.ok) {
      // Create ops_alert for failed email (non-fatal, fire-and-forget)
      void import('@/lib/ops/events').then(({ createOpsAlert }) =>
        createOpsAlert?.({
          business_id: params.businessId,
          alert_type:  'booking_confirmation_email_failed',
          severity:    'warning',
          title:       'Booking confirmation email could not be sent',
          message:     'Resend returned an error. Check RESEND_API_KEY configuration.',
          metadata:    { booking_id: params.bookingId },
        }, client)
      ).catch(() => undefined)
    }

    void import('@/lib/analytics/posthog').then(({ capture }) =>
      capture(result.ok ? 'booking_confirmation_email_sent' : 'booking_confirmation_email_failed', {
        status: emailStatus,
      })
    )

    return result.ok ? { ok: true } : { ok: false, error: 'Email could not be sent.' }
  } catch (err) {
    const errSummary = err instanceof Error ? err.message.slice(0, 200) : 'Unknown error'
    if (logId) {
      await client.from('booking_confirmation_email_logs').update({
        email_status:  'failed',
        failed_at:     new Date().toISOString(),
        error_summary: errSummary,
      }).eq('id', logId).catch(() => undefined)
    }
    return { ok: false, error: 'Email send failed.' }
  }
}

// ── Log confirmation event ────────────────────────────────────────

export async function logBookingConfirmationEvent(params: {
  businessId:  string
  bookingId:   string
  eventType:   string
  actorType:   string
  safeSummary?: string | null
  db?:         DbClient
}): Promise<void> {
  const client = params.db ?? createServiceRoleClient()
  try {
    await client.from('booking_confirmation_events').insert({
      business_id:  params.businessId,
      booking_id:   params.bookingId,
      event_type:   params.eventType,
      actor_type:   params.actorType,
      safe_summary: params.safeSummary ?? null,
      metadata:     {},
    })
  } catch { /* silent — never affect primary flow */ }
}
