// ── Assignment notification — server-only ─────────────────────────
// Sends a Resend email when a WhatsApp conversation is assigned.
// Never throws — all failures are logged server-side.
// Never includes full message content, customer phone, or API keys.

import { sendEmail } from '@/lib/resend/client'

type DbClient = ReturnType<typeof import('@/lib/supabase/server').createServiceRoleClient>

export interface AssignmentNotificationData {
  businessId:      string
  businessName:    string
  assigneeEmail:   string | null
  maskedPhone:     string
  priority:        string
  handoffStatus:   string
  sessionId:       string
  dashboardUrl:    string
}

export async function sendAssignmentNotification(
  db:   DbClient,
  data: AssignmentNotificationData,
): Promise<void> {
  const { assigneeEmail, businessName, maskedPhone, priority, sessionId, dashboardUrl } = data

  // Always create an in-app notification row
  const { error: notifErr } = await db.from('notifications').insert({
    business_id: data.businessId,
    user_id:     null,
    type:        'conversation_assigned',
    title:       `Conversation assigned — ${maskedPhone}`,
    body:        `Priority: ${priority} · WhatsApp`,
    channel:     assigneeEmail ? 'email' : 'in_app',
    status:      assigneeEmail ? 'pending' : 'skipped',
    recipient:   assigneeEmail,
    metadata: {
      session_id: sessionId,
      priority,
      masked_phone: maskedPhone,
    },
  })
  if (notifErr) console.error('[assignment] notification insert:', notifErr.message)

  if (!assigneeEmail) return

  const inboxUrl = `${dashboardUrl}/dashboard/inbox?session=${sessionId}`

  const priorityColor =
    priority === 'urgent' ? '#ff8a7a' :
    priority === 'high'   ? '#ffae3c' :
    '#9a9a9d'

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;background:#0a0a0c;color:#f3f3f3;padding:32px;max-width:600px;margin:0 auto;">
  <div style="background:#0f1012;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px;">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
      <div style="width:36px;height:36px;background:#ff7a18;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px;">✦</div>
      <span style="font-size:18px;font-weight:600;">Helios AI</span>
    </div>
    <h2 style="margin:0 0 8px;font-size:20px;">Conversation Assigned — ${businessName}</h2>
    <p style="color:#9a9a9d;margin:0 0 24px;font-size:14px;">A WhatsApp conversation has been assigned to you.</p>
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding:8px 12px;background:rgba(255,255,255,0.03);border-bottom:1px solid rgba(255,255,255,0.05);color:#6a6a6e;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;">Customer</td>
        <td style="padding:8px 12px;background:rgba(255,255,255,0.03);border-bottom:1px solid rgba(255,255,255,0.05);color:#f3f3f3;font-size:14px;">${maskedPhone}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;background:rgba(255,255,255,0.03);border-bottom:1px solid rgba(255,255,255,0.05);color:#6a6a6e;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;">Channel</td>
        <td style="padding:8px 12px;background:rgba(255,255,255,0.03);border-bottom:1px solid rgba(255,255,255,0.05);color:#25d366;font-size:14px;">WhatsApp</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;background:rgba(255,255,255,0.03);color:#6a6a6e;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;">Priority</td>
        <td style="padding:8px 12px;background:rgba(255,255,255,0.03);color:${priorityColor};font-size:14px;font-weight:600;text-transform:capitalize;">${priority}</td>
      </tr>
    </table>
    <a href="${inboxUrl}"
      style="display:inline-block;margin-top:24px;padding:12px 24px;background:#25d366;color:#0a0c0e;font-weight:600;border-radius:10px;text-decoration:none;font-size:14px;">
      Open Conversation →
    </a>
    <p style="color:#6a6a6e;font-size:12px;margin-top:24px;">
      You're receiving this because a conversation was assigned to you at <strong>${businessName}</strong> on Helios AI.
    </p>
  </div>
</body>
</html>`

  const result = await sendEmail({
    to:      assigneeEmail,
    subject: `Conversation assigned to you — ${businessName}`,
    html,
    text:    `A WhatsApp conversation was assigned to you at ${businessName}.\n\nCustomer: ${maskedPhone}\nChannel: WhatsApp\nPriority: ${priority}\n\nOpen at: ${inboxUrl}`,
  })

  // Update notification row with email result
  await db.from('notifications')
    .update({ status: result.ok ? 'sent' : 'failed' })
    .eq('business_id', data.businessId)
    .eq('type', 'conversation_assigned')
    .eq('recipient', assigneeEmail)
    .order('created_at', { ascending: false })
    .limit(1)
}
