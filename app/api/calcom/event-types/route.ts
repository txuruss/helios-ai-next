import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { getEventTypes } from '@/lib/calcom/client'

// GET /api/calcom/event-types
// Protected dashboard route — requires authenticated Supabase session.
// Syncs Cal.com event types into calcom_event_types and returns them.

export async function GET(request: NextRequest) {
  // Auth: require logged-in dashboard user
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
  }

  // Derive business_id — never trust client input
  const db = createServiceRoleClient()
  const { data: membership } = await db
    .from('business_members')
    .select('business_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'No business found for this user.' }, { status: 404 })
  }
  const businessId = membership.business_id as string

  if (!process.env.CALCOM_API_KEY) {
    return NextResponse.json(
      { error: 'CALCOM_API_KEY is not configured on the server.' },
      { status: 503 },
    )
  }

  // Fetch from Cal.com (server-side only)
  const result = await getEventTypes()
  if (!result.ok) {
    console.error('[GET /api/calcom/event-types]', result.error)
    return NextResponse.json({ error: 'Unable to sync Cal.com event types.' }, { status: 500 })
  }

  // Upsert into Supabase
  let synced = 0
  for (const et of result.data) {
    const { error } = await db.from('calcom_event_types').upsert(
      {
        business_id:  businessId,
        calcom_id:    et.calcom_id,
        title:        et.title,
        slug:         et.slug,
        duration_min: et.duration_min,
        is_active:    et.is_active,
        raw_data:     et.raw_data,
      },
      { onConflict: 'calcom_id' },
    )
    if (error) {
      console.error('[GET /api/calcom/event-types] upsert:', error.message, error.code)
    } else {
      synced++
    }
  }

  // Update calcom_connections sync timestamp
  await db.from('calcom_connections').upsert(
    { business_id: businessId, is_connected: true, last_synced_at: new Date().toISOString() },
    { onConflict: 'business_id' },
  )

  // Audit
  await db.from('audit_logs').insert({
    business_id:  businessId,
    user_id:      user.id,
    action:       'calcom.event_types.synced',
    resource:     'calcom_event_types',
    new_values:   { synced_count: synced },
  })

  // Read back the full list for this business
  const { data: eventTypes } = await db
    .from('calcom_event_types')
    .select('id, calcom_id, title, slug, duration_min, is_active')
    .eq('business_id', businessId)
    .order('title')

  return NextResponse.json({ ok: true, synced, event_types: eventTypes ?? [] })
}
