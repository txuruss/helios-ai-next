import { NextResponse, type NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { createBooking } from '@/lib/calcom/client'
import { bookingRequestSchema } from '@/lib/validation/calcom'
import { checkChatRateLimit } from '@/lib/rate-limit/chat'

const MAX_BODY_BYTES = 16 * 1024

// POST /api/calcom/book
// Public-safe: validates inputs, creates Cal.com booking, saves to Supabase.

export async function POST(request: NextRequest) {
  // Body size guard
  const rawBody = await request.text().catch(() => '')
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Request is too large.' }, { status: 413 })
  }

  let body: unknown
  try { body = JSON.parse(rawBody) } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const parsed = bookingRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid request.' },
      { status: 400 },
    )
  }

  const { business_id, service_id, lead_id, name, email, phone, selected_time, timezone, notes } = parsed.data

  // Rate limiting
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1'
  try {
    const rl = await checkChatRateLimit({ ip, businessId: business_id })
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests. Please wait and try again.' }, { status: 429 })
    }
  } catch { /* non-fatal */ }

  const db = createServiceRoleClient()

  // Verify business exists
  const { data: biz } = await db.from('businesses').select('id').eq('id', business_id).single()
  if (!biz) return NextResponse.json({ error: 'Business not found.' }, { status: 404 })

  // Find mapping → Cal.com event type
  const { data: mapping } = await db
    .from('service_event_mappings')
    .select('calcom_event_type_id, services(id, name, duration_min)')
    .eq('service_id', service_id)
    .eq('business_id', business_id)
    .single()

  if (!mapping?.calcom_event_type_id) {
    return NextResponse.json({ error: 'No Cal.com event type mapped for this service.' }, { status: 404 })
  }

  const { data: eventType } = await db
    .from('calcom_event_types')
    .select('calcom_id, duration_min')
    .eq('id', mapping.calcom_event_type_id)
    .single()

  if (!eventType?.calcom_id) {
    return NextResponse.json({ error: 'Cal.com event type not found.' }, { status: 404 })
  }

  if (!process.env.CALCOM_API_KEY) {
    return NextResponse.json({ error: 'Booking service not configured.' }, { status: 503 })
  }

  // Create Cal.com booking (server-side only)
  const calResult = await createBooking({
    eventTypeId: eventType.calcom_id,
    start:       selected_time,
    timezone,
    attendee:    { name, email },
    notes,
    metadata: {
      business_id,
      service_id,
      source: 'helios-ai',
    },
  })

  if (!calResult.ok) {
    console.error('[POST /api/calcom/book]', calResult.error)
    return NextResponse.json({ error: 'Booking could not be created. Please try again.' }, { status: 500 })
  }

  const cal = calResult.data

  // Determine duration
  const svc = mapping.services as { id: string; name: string; duration_min: number | null } | null
  const durationMin = svc?.duration_min ?? eventType.duration_min ?? null

  // Save booking to Supabase
  const { data: booking, error: bookingErr } = await db
    .from('bookings')
    .insert({
      business_id,
      service_id,
      lead_id:              lead_id ?? null,
      customer_name:        name,
      customer_email:       email,
      customer_phone:       phone ?? null,
      scheduled_at:         selected_time,
      duration_min:         durationMin,
      status:               cal.status === 'ACCEPTED' ? 'confirmed' : 'pending',
      notes:                notes ?? null,
      calcom_booking_uid:   cal.calcom_booking_uid,
      calcom_event_type_id: cal.calcom_id,
      timezone:             timezone ?? null,
      metadata: {
        calcom_booking_uid: cal.calcom_booking_uid,
        source:             'widget',
      },
    })
    .select('id, status')
    .single()

  if (bookingErr) {
    console.error('[POST /api/calcom/book] Supabase insert:', bookingErr.message)
    // Return success since Cal.com booking was created, just flag the save issue
  }

  // Update lead status if lead_id provided
  if (lead_id) {
    await db
      .from('leads')
      .update({ status: 'proposal' })
      .eq('id', lead_id)
      .eq('business_id', business_id)
  }

  // Audit
  await db.from('audit_logs').insert({
    business_id,
    user_id:      null,
    action:       'calcom.booking.created',
    resource:     'bookings',
    resource_id:  booking?.id,
    new_values: {
      calcom_booking_uid: cal.calcom_booking_uid,
      service_id,
      scheduled_at: selected_time,
    },
  }).catch(() => undefined)

  return NextResponse.json({
    ok: true,
    booking: {
      id:                 booking?.id ?? null,
      status:             booking?.status ?? (cal.status === 'ACCEPTED' ? 'confirmed' : 'pending'),
      calcom_booking_uid: cal.calcom_booking_uid,
      scheduled_at:       selected_time,
    },
  })
}
