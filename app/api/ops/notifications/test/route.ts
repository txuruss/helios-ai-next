import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/resend/client'
import { captureApiError } from '@/lib/logging/api'
import {
  resolveNotificationRecipients,
  applySafeTemplateVariables,
  isTemplateSafe,
  PREVIEW_SAMPLE_VARS,
} from '@/lib/ops/notifications'
import type { NotificationRule } from '@/lib/ops/notifications'
import {
  createNotificationDeliveryLog,
  markNotificationSent,
  markNotificationFailed,
  maskRecipientForLog,
} from '@/lib/ops/notification-delivery'
import { capture } from '@/lib/analytics/posthog'

// POST /api/ops/notifications/test
// Sends a safe test email to ALL resolved recipients using the rule's custom template.
// Only sends when the user explicitly clicks Test Email — never called automatically.

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

  const { rule_id, to: customTo } = (body ?? {}) as { rule_id?: string; to?: string }

  let rule: NotificationRule | null = null
  if (rule_id) {
    const { data: ruleRow } = await db
      .from('ops_notification_rules').select('*')
      .eq('id', rule_id).eq('business_id', businessId).single()
    if (!ruleRow) return NextResponse.json({ error: 'Rule not found.' }, { status: 404 })
    rule = ruleRow as unknown as NotificationRule
    if (rule.channel !== 'email') {
      return NextResponse.json({ error: 'This rule does not use the email channel.' }, { status: 400 })
    }
  }

  // Resolve all recipients
  let recipients: string[] = []

  if (customTo) {
    recipients = [customTo]
  } else if (rule) {
    const { emails } = await resolveNotificationRecipients(rule, businessId, null, db)
    recipients = emails
  }

  // Fallback: current user's email
  if (!recipients.length) {
    const { data: profile } = await db.from('profiles').select('email').eq('id', user.id).single()
    const email = (profile as { email?: string } | null)?.email
    if (email) recipients = [email]
  }

  if (!recipients.length) {
    return NextResponse.json({ error: 'No recipient email found.' }, { status: 400 })
  }

  const dashUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://helios.ai'
  const r = rule as ({ email_subject_template?: string; email_body_template?: string; max_retry_attempts?: number; retry_backoff_minutes?: number; notify_on_failure?: boolean } & NotificationRule) | null

  const templateVars = { ...PREVIEW_SAMPLE_VARS, '{{dashboard_url}}': `${dashUrl}/dashboard/ops` }

  let subject               = '[Test] Helios AI Ops Notification'
  let htmlBody              = ''
  let textBody              = ''
  let renderedWithTemplate  = false

  if (r?.email_subject_template && isTemplateSafe(r.email_subject_template)) {
    subject = `[Test] ${applySafeTemplateVariables(r.email_subject_template, templateVars)}`
    renderedWithTemplate = true
  }
  if (r?.email_body_template && isTemplateSafe(r.email_body_template)) {
    textBody = applySafeTemplateVariables(r.email_body_template, templateVars)
    htmlBody = buildTestHtml({ subject, body: textBody, dashUrl: `${dashUrl}/dashboard/ops` })
    renderedWithTemplate = true
  } else {
    htmlBody = buildDefaultTestHtml(dashUrl)
    textBody = 'This is a test notification from Helios AI Ops Center.'
  }

  let sentCount     = 0
  let failedCount   = 0
  const maskedSent: string[] = []

  for (const to of recipients) {
    const logId = await createNotificationDeliveryLog({
      businessId,
      ruleId:        rule_id ?? null,
      recipientType: rule?.recipient_type ?? 'custom_email',
      recipientEmail: to,
      subject,
      bodyText:      textBody,
      db,
    })

    try {
      const result = await sendEmail({ to, subject, html: htmlBody, text: textBody })
      if (result.ok) {
        if (logId) await markNotificationSent(logId, null, db)
        sentCount++
        maskedSent.push(maskRecipientForLog(to))
      } else {
        if (logId) await markNotificationFailed({
          logId,
          errorSummary:     'Resend returned an error.',
          businessId,
          ruleId:           rule_id ?? null,
          maxRetryAttempts: r?.max_retry_attempts,
          retryBackoffMin:  r?.retry_backoff_minutes,
          notifyOnFailure:  r?.notify_on_failure,
          db,
        })
        failedCount++
      }
    } catch {
      if (logId) await markNotificationFailed({
        logId,
        errorSummary:  'Send exception.',
        businessId,
        ruleId:        rule_id ?? null,
        db,
      })
      failedCount++
    }
  }

  if (sentCount === 0) {
    return NextResponse.json({ error: 'Failed to send test email. Check RESEND_API_KEY configuration.' }, { status: 500 })
  }

  // Update rule last_tested_at
  if (rule_id) {
    await db.from('ops_notification_rules').update({
      last_tested_at:                   new Date().toISOString(),
      last_test_status:                 sentCount > 0 ? 'sent' : 'failed',
      last_test_error:                  sentCount > 0 ? null : 'All sends failed.',
      last_test_rendered_with_template: renderedWithTemplate,
    }).eq('id', rule_id).eq('business_id', businessId)
  }

  // Audit (fire-and-forget)
  await db.from('ops_audit_trail').insert({
    business_id:   businessId,
    actor_user_id: user.id,
    action:        'notification_test_sent',
    target_table:  'ops_notification_rules',
    target_id:     rule_id ?? null,
    metadata:      {
      attempted:               recipients.length,
      sent:                    sentCount,
      rendered_with_template:  renderedWithTemplate,
    },
  }).catch(() => undefined)

  capture('notification_test_sent_all_recipients', {
    recipient_count:  recipients.length,
    sent_count:       sentCount,
    has_template:     renderedWithTemplate,
    has_rule:         !!rule_id,
  })

  return NextResponse.json({
    ok:                       true,
    attempted_count:          recipients.length,
    sent_count:               sentCount,
    failed_count:             failedCount,
    skipped_count:            0,
    sent_to:                  maskedSent,
    rendered_with_template:   renderedWithTemplate,
  })
}

function buildTestHtml(params: { subject: string; body: string; dashUrl: string }): string {
  const { subject, body, dashUrl } = params
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;background:#0a0a0c;color:#f3f3f3;padding:32px;max-width:600px;margin:0 auto;">
  <div style="background:#0f1012;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px;">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
      <div style="width:36px;height:36px;background:#ff7a18;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px;">⚙</div>
      <span style="font-size:18px;font-weight:600;">Helios AI · Ops Center</span>
    </div>
    <div style="display:inline-block;margin-bottom:12px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;color:#ffae3c;border:1px solid #ffae3c33;">Test Email</div>
    <h2 style="margin:0 0 16px;font-size:19px;color:#f3f3f3;">${subject}</h2>
    <p style="color:#9a9a9d;margin:0 0 24px;font-size:14px;line-height:1.6;white-space:pre-wrap;">${body}</p>
    <a href="${dashUrl}" style="display:inline-block;padding:12px 24px;background:#ff7a18;color:#1a0c00;font-weight:600;border-radius:10px;text-decoration:none;font-size:14px;">Open Ops Center →</a>
    <p style="color:#6a6a6e;font-size:12px;margin-top:24px;">This is a test email sent from Helios AI. No action is required.</p>
  </div>
</body></html>`
}

function buildDefaultTestHtml(dashUrl: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;background:#0a0a0c;color:#f3f3f3;padding:32px;max-width:600px;margin:0 auto;">
  <div style="background:#0f1012;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px;">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
      <div style="width:36px;height:36px;background:#ff7a18;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px;">⚙</div>
      <span style="font-size:18px;font-weight:600;">Helios AI · Ops Center</span>
    </div>
    <h2 style="margin:0 0 8px;font-size:19px;color:#f3f3f3;">Test Notification</h2>
    <p style="color:#9a9a9d;margin:0 0 24px;font-size:14px;line-height:1.6;">Your notification rule is configured correctly.</p>
    <a href="${dashUrl}/dashboard/ops?tab=sla" style="display:inline-block;padding:12px 24px;background:#ff7a18;color:#1a0c00;font-weight:600;border-radius:10px;text-decoration:none;font-size:14px;">Open Ops Center →</a>
    <p style="color:#6a6a6e;font-size:12px;margin-top:24px;">This test email was sent manually from Helios AI. No action is required.</p>
  </div>
</body></html>`
}
