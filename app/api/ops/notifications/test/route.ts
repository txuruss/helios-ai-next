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
import { capture } from '@/lib/analytics/posthog'

// POST /api/ops/notifications/test
// Sends a safe test email using the rule's custom template if set.
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
      .from('ops_notification_rules')
      .select('*')
      .eq('id', rule_id)
      .eq('business_id', businessId)
      .single()
    if (!ruleRow) return NextResponse.json({ error: 'Rule not found.' }, { status: 404 })
    rule = ruleRow as unknown as NotificationRule

    if (rule.channel !== 'email') {
      return NextResponse.json({ error: 'This rule does not use the email channel.' }, { status: 400 })
    }
  }

  // Resolve recipient — customTo overrides rule resolution
  let recipientEmail: string | null = customTo ?? null

  if (!recipientEmail && rule) {
    const { emails } = await resolveNotificationRecipients(rule, businessId, null, db)
    recipientEmail = emails[0] ?? null
  }

  // Fallback: current user's email
  if (!recipientEmail) {
    const { data: profile } = await db.from('profiles').select('email').eq('id', user.id).single()
    recipientEmail = (profile as { email?: string } | null)?.email ?? null
  }

  if (!recipientEmail) {
    return NextResponse.json({ error: 'No recipient email found. Check your profile or rule configuration.' }, { status: 400 })
  }

  const dashUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://helios.ai'
  const r = rule as ({ email_subject_template?: string; email_body_template?: string } & NotificationRule) | null

  // Build template vars using safe sample values
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
    textBody = 'This is a test notification from Helios AI Ops Center. Your notification rule is configured correctly.'
  }

  try {
    const result = await sendEmail({
      to:      recipientEmail,
      subject,
      html:    htmlBody,
      text:    textBody,
    })

    const testStatus = result.ok ? 'sent' : 'failed'

    // Update last_tested_at + template flag
    if (rule_id) {
      await db.from('ops_notification_rules').update({
        last_tested_at:                   new Date().toISOString(),
        last_test_status:                 testStatus,
        last_test_error:                  result.ok ? null : 'Resend returned an error.',
        last_test_rendered_with_template: renderedWithTemplate,
      }).eq('id', rule_id).eq('business_id', businessId)
    }

    if (!result.ok) {
      return NextResponse.json({ error: 'Failed to send test email. Check RESEND_API_KEY configuration.' }, { status: 500 })
    }

    // Audit trail (fire-and-forget)
    await db.from('ops_audit_trail').insert({
      business_id:   businessId,
      actor_user_id: user.id,
      action:        'notification_test_sent',
      target_table:  'ops_notification_rules',
      target_id:     rule_id ?? null,
      metadata:      {
        to:                       recipientEmail.slice(-10),
        rendered_with_template:   renderedWithTemplate,
      },
    }).catch(() => undefined)

    capture('ops_notification_test_template_sent', {
      has_template:  renderedWithTemplate,
      has_rule:      !!rule_id,
    })

    return NextResponse.json({
      ok:                       true,
      sent_to:                  `${recipientEmail.slice(0, 3)}***`,
      rendered_with_template:   renderedWithTemplate,
    })

  } catch (err) {
    captureApiError(err, {
      route:          '/api/ops/notifications/test',
      error_type:     'test_notification_error',
      business_id:    businessId,
    })
    return NextResponse.json({ error: 'Failed to send test notification.' }, { status: 500 })
  }
}

function buildTestHtml(params: { subject: string; body: string; dashUrl: string }): string {
  const { subject, body, dashUrl } = params
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;background:#0a0a0c;color:#f3f3f3;padding:32px;max-width:600px;margin:0 auto;">
  <div style="background:#0f1012;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px;">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
      <div style="width:36px;height:36px;background:#ff7a18;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px;">⚙</div>
      <span style="font-size:18px;font-weight:600;">Helios AI · Ops Center</span>
    </div>
    <div style="display:inline-block;margin-bottom:12px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;color:#ffae3c;border:1px solid #ffae3c33;">Test Email</div>
    <h2 style="margin:0 0 16px;font-size:19px;color:#f3f3f3;">${subject}</h2>
    <p style="color:#9a9a9d;margin:0 0 24px;font-size:14px;line-height:1.6;white-space:pre-wrap;">${body}</p>
    <a href="${dashUrl}" style="display:inline-block;padding:12px 24px;background:#ff7a18;color:#1a0c00;font-weight:600;border-radius:10px;text-decoration:none;font-size:14px;">
      Open Ops Center →
    </a>
    <p style="color:#6a6a6e;font-size:12px;margin-top:24px;">
      This is a test email sent from Helios AI. No action is required.
    </p>
  </div>
</body>
</html>`
}

function buildDefaultTestHtml(dashUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;background:#0a0a0c;color:#f3f3f3;padding:32px;max-width:600px;margin:0 auto;">
  <div style="background:#0f1012;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px;">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
      <div style="width:36px;height:36px;background:#ff7a18;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px;">⚙</div>
      <span style="font-size:18px;font-weight:600;">Helios AI · Ops Center</span>
    </div>
    <h2 style="margin:0 0 8px;font-size:19px;color:#f3f3f3;">Test Notification</h2>
    <p style="color:#9a9a9d;margin:0 0 24px;font-size:14px;line-height:1.6;">
      This is a test notification from Helios AI Ops Center. Your notification rule is configured correctly.
    </p>
    <a href="${dashUrl}/dashboard/ops?tab=sla" style="display:inline-block;padding:12px 24px;background:#ff7a18;color:#1a0c00;font-weight:600;border-radius:10px;text-decoration:none;font-size:14px;">
      Open Ops Center →
    </a>
    <p style="color:#6a6a6e;font-size:12px;margin-top:24px;">
      This test email was sent manually from Helios AI. No action is required.
    </p>
  </div>
</body>
</html>`
}
