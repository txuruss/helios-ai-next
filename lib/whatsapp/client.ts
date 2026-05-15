import 'server-only'
import { createHmac } from 'crypto'
import { captureApiError } from '@/lib/logging/api'

const META_API_VERSION = 'v21.0'

function getMetaConfig(): { accessToken: string; phoneNumberId: string } | null {
  const accessToken   = process.env.META_ACCESS_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  if (!accessToken || !phoneNumberId) return null
  return { accessToken, phoneNumberId }
}

export function isWhatsAppConfigured(): boolean {
  return !!(process.env.META_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)
}

// ── Signature verification ────────────────────────────────────────

export function verifyMetaWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.META_APP_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[whatsapp] META_APP_SECRET not set — rejecting in production')
      return false
    }
    return true // dev-only: allow unsigned webhooks when secret not configured
  }
  if (!signature) return false
  const expected = `sha256=${createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')}`
  return signature === expected
}

// ── Send text message ─────────────────────────────────────────────

export interface SendResult {
  ok:         boolean
  messageId?: string
  error?:     string
}

export async function sendWhatsAppTextMessage(
  to:   string,
  text: string,
): Promise<SendResult> {
  const config = getMetaConfig()
  if (!config) {
    console.error('[whatsapp] META_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID not configured')
    return { ok: false, error: 'WhatsApp not configured.' }
  }

  try {
    const url = `https://graph.facebook.com/${META_API_VERSION}/${config.phoneNumberId}/messages`
    const res = await fetch(url, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type:    'individual',
        to,
        type:              'text',
        text:              { preview_url: false, body: text },
      }),
    })

    if (!res.ok) {
      let errMsg = 'Unknown error'
      try {
        const errBody = await res.json() as { error?: { message?: string } }
        errMsg = errBody.error?.message ?? errMsg
      } catch { /* ignore */ }
      console.error('[whatsapp] sendWhatsAppTextMessage failed:', res.status, errMsg)
      return { ok: false, error: 'Failed to send WhatsApp message.' }
    }

    const data = await res.json() as { messages?: Array<{ id: string }> }
    return { ok: true, messageId: data.messages?.[0]?.id }

  } catch (err) {
    console.error('[whatsapp] sendWhatsAppTextMessage error:', err instanceof Error ? err.message : err)
    captureApiError(err, { route: '/api/webhooks/whatsapp', error_type: 'whatsapp_send_error' })
    return { ok: false, error: 'Failed to send WhatsApp message.' }
  }
}

// ── Mark message as read ──────────────────────────────────────────

export async function markMessageAsRead(messageId: string): Promise<void> {
  const config = getMetaConfig()
  if (!config) return

  try {
    const url = `https://graph.facebook.com/${META_API_VERSION}/${config.phoneNumberId}/messages`
    await fetch(url, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status:            'read',
        message_id:        messageId,
      }),
    })
  } catch {
    // Never throw — read receipts are non-critical
  }
}

// ── Parse incoming webhook entry ──────────────────────────────────

export interface ParsedWhatsAppMessage {
  messageId:     string
  fromPhone:     string
  toPhone:       string
  phoneNumberId: string
  customerName:  string | null
  text:          string
  timestamp:     string
}

export function parseIncomingWhatsAppMessage(entry: {
  changes: Array<{
    value: {
      messaging_product: string
      metadata: { display_phone_number: string; phone_number_id: string }
      contacts?: Array<{ profile?: { name: string }; wa_id: string }>
      messages?: Array<{
        id: string; from: string; timestamp: string; type: string
        text?: { body: string }
      }>
    }
  }>
}): ParsedWhatsAppMessage | null {
  const change = entry.changes[0]
  if (!change) return null

  const { value } = change
  const msg = value.messages?.[0]
  if (!msg || msg.type !== 'text' || !msg.text?.body) return null

  const contact      = value.contacts?.[0]
  const customerName = contact?.profile?.name ?? null

  return {
    messageId:     msg.id,
    fromPhone:     msg.from,
    toPhone:       value.metadata.display_phone_number,
    phoneNumberId: value.metadata.phone_number_id,
    customerName,
    text:          msg.text.body,
    timestamp:     msg.timestamp,
  }
}
