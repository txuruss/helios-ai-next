import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/resend/client'
import { captureApiError } from '@/lib/logging/api'

// POST /api/ops/notifications/test
// Sends a safe test email to the authenticated user or configured recipient.
// Never uses real customer data.

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

  // Determine recipient
  let recipientEmail = customTo ?? null

  if (!recipientEmail && rule_id) {
    const { data: rule } = await db
      .from('ops_notification_rules')
      .select('channel, recipient_type, recipient_email, recipient_user_id')
      .eq('id', rule_id).eq('business_id', businessId).single()

    if (rule) {
      const r = rule as { channel: string; recipient_type: string; recipient_email: string | null; recipient_user_id: string | null }
      if (r.channel !== 'email') {
        return NextResponse.json({ error: 'This rule does not use the email channel.' }, { status: 400 })
      }
      if (r.recipient_type === 'custom_email') {
        recipientEmail = r.recipient_email
      } else if (r.recipient_type === 'assigned_user' && r.recipient_user_id) {
        const { data: profile } = await db.from('profiles').select('email').eq('id', r.recipient_user_id).single()
        recipientEmail = (profile as { email?: string } | null)?.email ?? null
      }
    }
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

  try {
    const html = `
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

    const result = await sendEmail({
      to:      recipientEmail,
      subject: '[Test] Helios AI Ops Notification',
      html,
      text:    'This is a test notification from Helios AI Ops Center. Your notification rule is configured correctly.',
    })

    // Update last_tested_at on rule if rule_id provided
    if (rule_id) {
      await db.from('ops_notification_rules').update({
        last_tested_at:   new Date().toISOString(),
        last_test_status: result.ok ? 'sent' : 'failed',
        last_test_error:  result.ok ? null : 'Resend returned an error.',
      }).eq('id', rule_id).eq('business_id', businessId)
    }

    if (!result.ok) {
      return NextResponse.json({ error: 'Failed to send test email. Check RESEND_API_KEY configuration.' }, { status: 500 })
    }

    // Audit
    await db.from('ops_audit_trail').insert({
      business_id:   businessId,
      actor_user_id: user.id,
      action:        'notification_test_sent',
      target_table:  'ops_notification_rules',
      target_id:     rule_id ?? null,
      metadata:      { to: recipientEmail.slice(-10) }, // only last 10 chars for privacy
    }).catch(() => undefined)

    return NextResponse.json({ ok: true, sent_to: `${recipientEmail.slice(0, 3)}***` })

  } catch (err) {
    captureApiError(err, { route: '/api/ops/notifications/test', error_type: 'test_notification_error', business_id: businessId })
    return NextResponse.json({ error: 'Failed to send test notification.' }, { status: 500 })
  }
}
