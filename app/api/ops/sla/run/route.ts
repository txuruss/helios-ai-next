import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { processSlaBreaches } from '@/lib/ops/sla'
import { captureApiError } from '@/lib/logging/api'

// POST /api/ops/sla/run
// Authenticated dashboard only. Processes SLA breaches and escalations.

export async function POST(request: NextRequest) {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const db = createServiceRoleClient()
  const { data: membership } = await db
    .from('business_members').select('business_id').eq('user_id', user.id).limit(1).single()
  if (!membership) return NextResponse.json({ error: 'No business found.' }, { status: 404 })

  const businessId = (membership as { business_id: string }).business_id

  try {
    const result = await processSlaBreaches(businessId, db)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    captureApiError(err, { route: '/api/ops/sla/run', error_type: 'sla_run_error', business_id: businessId })
    return NextResponse.json({ error: 'SLA check failed.' }, { status: 500 })
  }
}
