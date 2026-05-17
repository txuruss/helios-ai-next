import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { generateNotificationPreview } from '@/lib/ops/notifications'
import { captureApiError } from '@/lib/logging/api'
import { capture } from '@/lib/analytics/posthog'

// POST /api/ops/notifications/preview
// Authenticated dashboard only.
// Generates a notification preview using actual template rendering — never sends a real email.
// Phase 18: stores rendered_with_template + preview_hash, supports dry_run type.

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

  const {
    rule_id,
    trigger_type,
    title,
    severity,
    source,
    preview_type,
  } = (body ?? {}) as {
    rule_id?: string
    trigger_type?: string
    title?: string
    severity?: string
    source?: string
    preview_type?: string
  }

  const isDryRun = preview_type === 'dry_run'

  try {
    const preview = await generateNotificationPreview({
      ruleId:       rule_id,
      triggerType:  trigger_type,
      title:        title ?? 'Payment failed',
      severity:     severity ?? 'critical',
      source:       source ?? 'stripe',
      businessId,
      db,
      useSampleVars: true,
    })

    // Load rule name for storage
    let sourceRuleName: string | null = null
    if (rule_id) {
      const { data: ruleRow } = await db.from('ops_notification_rules').select('name').eq('id', rule_id).single()
      sourceRuleName = (ruleRow as { name?: string } | null)?.name ?? null
    }

    // Store preview record
    const previewRow = {
      business_id:              businessId,
      notification_rule_id:     rule_id ?? null,
      preview_type:             isDryRun ? 'dry_run' : 'rule_preview',
      subject_preview:          preview.subject.slice(0, 500),
      body_preview:             preview.body_text.slice(0, 2000),
      recipient_preview:        preview.maskedRecipients.join(', ').slice(0, 500),
      created_by:               user.id,
      dry_run_status:           isDryRun ? 'success' : null,
      source_rule_name:         sourceRuleName,
      rendered_with_template:   preview.rendered_with_template,
      preview_hash:             preview.preview_hash,
    }

    await db.from('ops_notification_previews').insert(previewRow).catch(() => undefined)

    // Update rule tracking fields
    if (rule_id) {
      const ruleUpdates: Record<string, unknown> = {
        last_previewed_at: new Date().toISOString(),
      }
      if (isDryRun) {
        ruleUpdates.last_dry_run_at     = new Date().toISOString()
        ruleUpdates.last_dry_run_status = 'success'
      }
      await db.from('ops_notification_rules')
        .update(ruleUpdates)
        .eq('id', rule_id)
        .eq('business_id', businessId)
        .catch(() => undefined)
    }

    capture(isDryRun ? 'ops_notification_dry_run_template_rendered' : 'ops_notification_preview_created', {
      has_template:  preview.rendered_with_template,
      preview_type:  isDryRun ? 'dry_run' : 'rule_preview',
      has_rule:      !!rule_id,
    })

    return NextResponse.json({
      ok:                       true,
      subject:                  preview.subject,
      body_text:                preview.body_text,
      recipients:               preview.maskedRecipients,
      warning:                  preview.warning,
      preview_type:             isDryRun ? 'dry_run' : 'rule_preview',
      rendered_with_template:   preview.rendered_with_template,
    })

  } catch (err) {
    captureApiError(err, {
      route:       '/api/ops/notifications/preview',
      error_type:  'preview_error',
      business_id: businessId,
    })
    return NextResponse.json({ error: 'Could not generate preview.' }, { status: 500 })
  }
}
