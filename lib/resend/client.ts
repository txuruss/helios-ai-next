// ── Resend email client — server-only ────────────────────────────
// NEVER import this file in client components.
// All Resend credentials stay server-side only.

const RESEND_API_URL = 'https://api.resend.com/emails'

export interface SendEmailParams {
  to:      string
  subject: string
  html:    string
  text?:   string
}

export interface SendEmailResult {
  ok:  boolean
  id?: string
}

/**
 * Sends an email via Resend.
 * Returns { ok: false } without throwing if the key is missing or the call fails.
 * Logs provider errors server-side only — never exposes them to the client.
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[resend] RESEND_API_KEY not configured — email skipped')
    return { ok: false }
  }

  const from = process.env.RESEND_FROM_EMAIL ?? 'Helios AI <onboarding@resend.dev>'

  try {
    const res = await fetch(RESEND_API_URL, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to:      [params.to],
        subject: params.subject,
        html:    params.html,
        ...(params.text ? { text: params.text } : {}),
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('[resend] API error:', res.status, JSON.stringify(err))
      return { ok: false }
    }

    const data = await res.json().catch(() => ({}))
    return { ok: true, id: data?.id as string | undefined }
  } catch (err) {
    console.error('[resend] fetch error:', err instanceof Error ? err.message : String(err))
    return { ok: false }
  }
}
