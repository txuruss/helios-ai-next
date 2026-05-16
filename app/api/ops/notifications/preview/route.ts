import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { generateNotificationPreview } from '@/lib/ops/notifications'
import { captureApiError } from '@/lib/logging/api'

// POST /api/ops/notifications/preview
// Authenticated dashboard only.
// Generates a notification preview — never sends a real email.

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

  const { rule_id, trigger_type, title, severity, source, preview_type } = (body ?? {}) as {
    rule_id?: string; trigger_type?: string; title?: string
    severity?: string; source?: string; preview_type?: string
  }

  try {
    const preview = await generateNotificationPreview({
      ruleId:       rule_id,
      triggerType:  trigger_type,
      title:        title ?? 'Sample event title',
      severity:     severity ?? 'warning',
      source:       source ?? 'system',
      businessId,
      db,
    })

    // Store preview record (fire-and-forget)
    db.from('ops_notification_previews').insert({
      business_id:         businessId,
      notification_rule_id: rule_id ?? null,
      preview_type:        preview_type === 'dry_run' ? 'dry_run' : 'rule_preview',
      subject_preview:     preview.subject,
      body_preview:        preview.body_text,
      recipient_preview:   preview.recipients.join(', '),
      created_by:          user.id,
    }).catch(() => undefined)

    return NextResponse.json({
      ok:             true,
      subject:        preview.subject,
      body_text:      preview.body_text,
      recipients:     preview.recipients,
      warning:        preview.warning,
      preview_type:   preview_type ?? 'rule_preview',
    })

  } catch (err) {
    captureApiError(err, { route: '/api/ops/notifications/preview', error_type: 'preview_error', business_id: businessId })
    return NextResponse.json({ error: 'Could not generate preview.' }, { status: 500 })
  }
}
