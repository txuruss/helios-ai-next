import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { retryNotificationDelivery } from '@/lib/ops/notification-delivery'
import { captureApiError } from '@/lib/logging/api'
import { capture } from '@/lib/analytics/posthog'

// POST /api/ops/notifications/retry
// Authenticated dashboard only.
// Retries a failed or retrying notification delivery log.

export async function POST(request: NextRequest) {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const db = createServiceRoleClient()
  const { data: membership } = await db
    .from('business_members').select('business_id').eq('user_id', user.id).limit(1).single()
  if (!membership) return NextResponse.json({ error: 'No business found.' }, { status: 404 })
  const businessId = (membership as { business_id: string }).business_id

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const { delivery_log_id } = (body ?? {}) as { delivery_log_id?: string }
  if (!delivery_log_id) {
    return NextResponse.json({ error: 'delivery_log_id is required.' }, { status: 400 })
  }

  // UUID validation
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(delivery_log_id)) {
    return NextResponse.json({ error: 'Invalid delivery_log_id.' }, { status: 400 })
  }

  try {
    const result = await retryNotificationDelivery({
      logId:      delivery_log_id,
      businessId,
      db,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? 'Retry failed.' }, { status: 400 })
    }

    capture('notification_delivery_retry_clicked', { delivery_status: 'retrying' })

    // Audit (fire-and-forget)
    await db.from('ops_audit_trail').insert({
      business_id:   businessId,
      actor_user_id: user.id,
      action:        'notification_delivery_retry',
      target_table:  'notification_delivery_logs',
      target_id:     delivery_log_id,
      metadata:      {},
    }).catch(() => undefined)

    return NextResponse.json({ ok: true, message: 'Delivery log marked for retry.' })

  } catch (err) {
    captureApiError(err, { route: '/api/ops/notifications/retry', error_type: 'retry_error', business_id: businessId })
    return NextResponse.json({ error: 'Retry failed.' }, { status: 500 })
  }
}
