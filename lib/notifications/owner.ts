// ── Owner notification helpers — server-only ─────────────────────
// Sends Resend emails to the business owner and records rows in
// the notifications table.  Never throws — all failures are logged
// server-side and do not block the calling request.

import { sendEmail } from '@/lib/resend/client'

type DbClient = ReturnType<typeof import('@/lib/supabase/server').createServiceRoleClient>

// ── Lead notification ─────────────────────────────────────────────

export interface LeadNotificationData {
  businessId:    string
  businessName:  string
  ownerEmail:    string | null
  customerName:  string | null
  customerEmail: string | null
  customerPhone: string | null
  service:       string | null
  intent:        string | null
  source:        string
  leadId:        string
  dashboardUrl:  string
}

export async function sendLeadNotification(
  db:   DbClient,
  data: LeadNotificationData,
): Promise<void> {
  const { ownerEmail, businessName, customerName, customerEmail, leadId, dashboardUrl } = data

  const notifStatus = ownerEmail ? 'pending' : 'skipped'

  // Always create a notifications row (in-app + email tracking)
  const { error: notifErr } = await db.from('notifications').insert({
    business_id: data.businessId,
    user_id:     null,
    type:        'new_lead',
    title:       `New lead: ${customerName ?? customerEmail ?? 'Unknown'}`,
    body:        `Source: ${data.source}${data.intent ? ` — ${data.intent}` : ''}`,
    channel:     ownerEmail ? 'email' : 'in_app',
    status:      notifStatus,
    recipient:   ownerEmail,
    metadata: {
      lead_id:        leadId,
      customer_name:  customerName,
      customer_email: customerEmail,
      customer_phone: data.customerPhone,
      service:        data.service,
      intent:         data.intent,
      source:         data.source,
    },
  })
  if (notifErr) console.error('[notifications] lead insert:', notifErr.message)

  if (!ownerEmail) return

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
    <h2 style="margin:0 0 8px;font-size:20px;">New Lead — ${businessName}</h2>
    <p style="color:#9a9a9d;margin:0 0 24px;font-size:14px;">A new customer inquiry was captured by your AI assistant.</p>
    <table style="width:100%;border-collapse:collapse;">
      ${row('Name',    customerName  ?? '—')}
      ${row('Email',   customerEmail ?? '—')}
      ${row('Phone',   data.customerPhone ?? '—')}
      ${row('Service', data.service  ?? '—')}
      ${row('Intent',  data.intent   ?? '—')}
      ${row('Source',  data.source)}
    </table>
    <a href="${dashboardUrl}/dashboard/leads"
      style="display:inline-block;margin-top:24px;padding:12px 24px;background:#ff7a18;color:#1a0c00;font-weight:600;border-radius:10px;text-decoration:none;font-size:14px;">
      View in Dashboard →
    </a>
    <p style="color:#6a6a6e;font-size:12px;margin-top:24px;">
      You're receiving this because you are the owner of <strong>${businessName}</strong> on Helios AI.<br>
      To manage notifications, visit your dashboard settings.
    </p>
  </div>
</body>
</html>`

  const result = await sendEmail({
    to:      ownerEmail,
    subject: `New lead from ${data.source} — ${businessName}`,
    html,
    text:    `New lead for ${businessName}\n\nName: ${customerName ?? '—'}\nEmail: ${customerEmail ?? '—'}\nPhone: ${data.customerPhone ?? '—'}\nService: ${data.service ?? '—'}\nIntent: ${data.intent ?? '—'}\nSource: ${data.source}\n\nView at: ${dashboardUrl}/dashboard/leads`,
  })

  // Update notification row with result
  if (result.ok || !result.ok) {
    await db.from('notifications')
      .update({ status: result.ok ? 'sent' : 'failed', metadata: { resend_id: result.id } })
      .eq('business_id', data.businessId)
      .eq('type', 'new_lead')
      .eq('recipient', ownerEmail)
      .order('created_at', { ascending: false })
      .limit(1)
  }
}

// ── Booking notification ──────────────────────────────────────────

export interface BookingNotificationData {
  businessId:        string
  businessName:      string
  ownerEmail:        string | null
  customerName:      string | null
  customerEmail:     string | null
  customerPhone:     string | null
  serviceName:       string | null
  scheduledAt:       string | null
  status:            string
  calcomBookingUid:  string | null
  bookingId:         string | null
  dashboardUrl:      string
}

export async function sendBookingNotification(
  db:   DbClient,
  data: BookingNotificationData,
): Promise<void> {
  const { ownerEmail, businessName, customerName, scheduledAt } = data

  const scheduledFormatted = scheduledAt
    ? new Date(scheduledAt).toLocaleString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '—'

  const { error: notifErr } = await db.from('notifications').insert({
    business_id: data.businessId,
    user_id:     null,
    type:        'booking_created',
    title:       `New booking: ${customerName ?? 'Customer'} — ${scheduledFormatted}`,
    body:        `Service: ${data.serviceName ?? '—'} · Status: ${data.status}`,
    channel:     ownerEmail ? 'email' : 'in_app',
    status:      ownerEmail ? 'pending' : 'skipped',
    recipient:   ownerEmail,
    metadata: {
      booking_id:        data.bookingId,
      calcom_booking_uid: data.calcomBookingUid,
      customer_name:     customerName,
      customer_email:    data.customerEmail,
      service_name:      data.serviceName,
      scheduled_at:      scheduledAt,
      status:            data.status,
    },
  })
  if (notifErr) console.error('[notifications] booking insert:', notifErr.message)

  if (!ownerEmail) return

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
    <h2 style="margin:0 0 8px;font-size:20px;">New Booking — ${businessName}</h2>
    <p style="color:#9a9a9d;margin:0 0 24px;font-size:14px;">A booking was confirmed through your AI assistant.</p>
    <table style="width:100%;border-collapse:collapse;">
      ${row('Customer',   customerName      ?? '—')}
      ${row('Email',      data.customerEmail ?? '—')}
      ${row('Phone',      data.customerPhone ?? '—')}
      ${row('Service',    data.serviceName   ?? '—')}
      ${row('Date/Time',  scheduledFormatted)}
      ${row('Status',     data.status)}
      ${data.calcomBookingUid ? row('Cal.com UID', data.calcomBookingUid) : ''}
    </table>
    <a href="${data.dashboardUrl}/dashboard/bookings"
      style="display:inline-block;margin-top:24px;padding:12px 24px;background:#ff7a18;color:#1a0c00;font-weight:600;border-radius:10px;text-decoration:none;font-size:14px;">
      View in Dashboard →
    </a>
    <p style="color:#6a6a6e;font-size:12px;margin-top:24px;">
      You're receiving this because you are the owner of <strong>${businessName}</strong> on Helios AI.
    </p>
  </div>
</body>
</html>`

  const result = await sendEmail({
    to:      ownerEmail,
    subject: `New booking: ${customerName ?? 'Customer'} — ${scheduledFormatted}`,
    html,
    text:    `New booking for ${businessName}\n\nCustomer: ${customerName ?? '—'}\nEmail: ${data.customerEmail ?? '—'}\nService: ${data.serviceName ?? '—'}\nDate/Time: ${scheduledFormatted}\nStatus: ${data.status}${data.calcomBookingUid ? `\nCal.com UID: ${data.calcomBookingUid}` : ''}\n\nView at: ${data.dashboardUrl}/dashboard/bookings`,
  })

  await db.from('notifications')
    .update({ status: result.ok ? 'sent' : 'failed', metadata: { resend_id: result.id } })
    .eq('business_id', data.businessId)
    .eq('type', 'booking_created')
    .eq('recipient', ownerEmail)
    .order('created_at', { ascending: false })
    .limit(1)
}

// ── HTML table row helper ─────────────────────────────────────────

function row(label: string, value: string): string {
  return `
  <tr>
    <td style="padding:8px 12px;background:rgba(255,255,255,0.03);border-bottom:1px solid rgba(255,255,255,0.05);color:#6a6a6e;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;white-space:nowrap;">${label}</td>
    <td style="padding:8px 12px;background:rgba(255,255,255,0.03);border-bottom:1px solid rgba(255,255,255,0.05);color:#f3f3f3;font-size:14px;">${value}</td>
  </tr>`
}
