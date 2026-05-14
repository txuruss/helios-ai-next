import { NextResponse, type NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getAvailability } from '@/lib/calcom/client'
import { availabilityRequestSchema } from '@/lib/validation/calcom'
import { checkChatRateLimit } from '@/lib/rate-limit/chat'

// GET /api/calcom/availability?business_id=...&service_id=...&start=...&end=...
// Public-safe: validates inputs, resolves Cal.com event type from mapping.

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const parsed = availabilityRequestSchema.safeParse({
    business_id:  searchParams.get('business_id'),
    service_id:   searchParams.get('service_id'),
    start:        searchParams.get('start'),
    end:          searchParams.get('end'),
    timezone:     searchParams.get('timezone') ?? undefined,
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid request.' },
      { status: 400 },
    )
  }

  const { business_id, service_id, start, end, timezone } = parsed.data

  // Basic rate limiting on IP
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1'
  try {
    const rl = await checkChatRateLimit({ ip, businessId: business_id })
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests. Please wait and try again.' }, { status: 429 })
    }
  } catch {
    // Non-fatal — proceed if rate limiter unavailable
  }

  const db = createServiceRoleClient()

  // Verify business exists
  const { data: biz } = await db
    .from('businesses')
    .select('id')
    .eq('id', business_id)
    .single()
  if (!biz) {
    return NextResponse.json({ error: 'Business not found.' }, { status: 404 })
  }

  // Find service → Cal.com event type mapping
  const { data: mapping } = await db
    .from('service_event_mappings')
    .select('calcom_event_type_id')
    .eq('service_id', service_id)
    .eq('business_id', business_id)
    .single()

  if (!mapping?.calcom_event_type_id) {
    return NextResponse.json(
      { error: 'No Cal.com event type mapped for this service.' },
      { status: 404 },
    )
  }

  // Get the Cal.com integer event type ID
  const { data: eventType } = await db
    .from('calcom_event_types')
    .select('calcom_id, title')
    .eq('id', mapping.calcom_event_type_id)
    .single()

  if (!eventType?.calcom_id) {
    return NextResponse.json(
      { error: 'Cal.com event type not found or not synced.' },
      { status: 404 },
    )
  }

  if (!process.env.CALCOM_API_KEY) {
    return NextResponse.json({ error: 'Booking service not configured.' }, { status: 503 })
  }

  // Validate date range (max 30 days)
  const startMs = new Date(start).getTime()
  const endMs   = new Date(end).getTime()
  const diffMs  = endMs - startMs
  if (diffMs > 30 * 24 * 60 * 60 * 1000 || diffMs <= 0) {
    return NextResponse.json({ error: 'Date range must be between 1 and 30 days.' }, { status: 400 })
  }

  // Fetch real availability from Cal.com (server-side only)
  const result = await getAvailability({
    eventTypeId: eventType.calcom_id,
    startTime:   start,
    endTime:     end,
    timezone,
  })

  if (!result.ok) {
    console.error('[GET /api/calcom/availability]', result.error)
    return NextResponse.json({ error: 'Unable to fetch availability. Please try again.' }, { status: 500 })
  }

  // Audit log (non-fatal)
  await db.from('audit_logs').insert({
    business_id:  business_id,
    user_id:      null,
    action:       'calcom.availability.checked',
    resource:     'calcom_event_types',
    resource_id:  String(eventType.calcom_id),
    new_values:   { service_id, start, end, slots_count: result.data.length },
  }).catch(() => undefined)

  return NextResponse.json({
    ok:         true,
    event_type: eventType.title,
    slots:      result.data,
  })
}
