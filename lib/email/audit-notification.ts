// ── Audit submission — founder notification email ─────────────────
//
// Sends a plain-text + HTML summary of a new audit submission to
// INTERNAL_ALERT_EMAIL using the Resend REST API via native fetch.
// No npm package required — fetch is available in Node 18+.
//
// DESIGN DECISIONS
//   • Non-throwing: callers catch errors and log them; a failed email
//     never fails the audit submission itself.
//   • Silently skips (with a log) when RESEND_API_KEY or
//     INTERNAL_ALERT_EMAIL is not configured, so the submission flow
//     works in environments without email set up.
//   • All user-supplied strings are HTML-escaped before injection.
//   • RESEND_FROM_EMAIL defaults to the Resend sandbox sender when
//     not configured — suitable for development/testing only.
//   • The admin link uses NEXT_PUBLIC_APP_URL, falling back to the
//     production domain so the link is always correct in prod.
//
// ENV VARS REQUIRED
//   RESEND_API_KEY        — Resend API key (server-side only)
//   INTERNAL_ALERT_EMAIL  — destination address for founder alerts
//
// ENV VARS OPTIONAL
//   RESEND_FROM_EMAIL     — verified sender; defaults to onboarding@resend.dev
//   NEXT_PUBLIC_APP_URL   — base URL for the admin link

import 'server-only'

export interface AuditNotificationPayload {
  submission_id:      string
  business_name:      string
  contact_name:       string | null
  contact_email:      string | null
  industry:           string | null
  city:               string | null
  country:            string | null
  website:            string | null
  biggest_problem:    string | null
  monthly_leads:      number | null
  preferred_channels: string[]
}

export async function sendAuditNotificationEmail(
  payload: AuditNotificationPayload,
): Promise<void> {
  const apiKey  = process.env.RESEND_API_KEY
  const from    = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
  const to      = process.env.INTERNAL_ALERT_EMAIL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://heliosai.agency'
  const adminUrl = `${baseUrl}/admin/audits`

  if (!apiKey || !to) {
    console.log(
      '[audit-email] skipped — set RESEND_API_KEY and INTERNAL_ALERT_EMAIL to enable founder notifications',
    )
    return
  }

  const location = [payload.city, payload.country].filter(Boolean).join(', ') || '—'
  const channels = payload.preferred_channels.join(', ') || '—'

  const subject = `New audit: ${payload.business_name}`

  const text = [
    `New audit submission received.`,
    ``,
    `Business:      ${payload.business_name}`,
    `Contact:       ${payload.contact_name  ?? '—'}`,
    `Email:         ${payload.contact_email ?? '—'}`,
    `Industry:      ${payload.industry      ?? '—'}`,
    `Location:      ${location}`,
    `Website:       ${payload.website       ?? '—'}`,
    `Monthly leads: ${payload.monthly_leads ?? '—'}`,
    `Channels:      ${channels}`,
    ``,
    `Main problem:`,
    payload.biggest_problem ?? '—',
    ``,
    `Review: ${adminUrl}`,
    `Submission ID: ${payload.submission_id}`,
  ].join('\n')

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">

        <!-- Header -->
        <tr>
          <td style="background:#0a0a0c;padding:24px 32px;">
            <p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#f97316;">
              Helios AI — Audit Alert
            </p>
            <p style="margin:6px 0 0;font-size:20px;font-weight:700;color:#ffffff;">
              New audit submission
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:28px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.6;">
              ${row('Business',      payload.business_name,           true)}
              ${row('Contact',       payload.contact_name  ?? '—')}
              ${row('Email',         payload.contact_email ?? '—')}
              ${row('Industry',      payload.industry      ?? '—')}
              ${row('Location',      location)}
              ${row('Website',       payload.website       ?? '—')}
              ${row('Monthly leads', String(payload.monthly_leads ?? '—'))}
              ${row('Channels',      channels)}
            </table>

            ${payload.biggest_problem ? `
            <div style="margin-top:20px;padding:16px;background:#f9fafb;border-radius:8px;border-left:3px solid #f97316;">
              <p style="margin:0 0 6px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:#6b7280;">
                Main problem
              </p>
              <p style="margin:0;font-size:14px;color:#111827;line-height:1.6;">
                ${esc(payload.biggest_problem)}
              </p>
            </div>` : ''}

            <div style="margin-top:28px;">
              <a href="${esc(adminUrl)}"
                 style="display:inline-block;background:#f97316;color:#ffffff;font-size:14px;font-weight:600;
                        padding:12px 24px;border-radius:8px;text-decoration:none;">
                Review in Mission Control →
              </a>
            </div>

            <p style="margin:20px 0 0;font-size:11px;color:#9ca3af;">
              Submission ID: ${esc(payload.submission_id)}
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e4e4e7;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              This is an automated alert from Helios AI. Reply to this email to contact the submitter directly.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ from, to, subject, text, html }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Resend API error ${res.status}: ${body.slice(0, 200)}`)
  }
}

// ── Helpers ───────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function row(label: string, value: string, bold = false): string {
  return `
    <tr>
      <td style="padding:5px 0;color:#6b7280;width:130px;vertical-align:top;">${esc(label)}</td>
      <td style="padding:5px 0;color:#111827;${bold ? 'font-weight:600;' : ''}">${esc(value)}</td>
    </tr>`
}
