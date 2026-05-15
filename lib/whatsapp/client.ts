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
    return true
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

// ── Send template message ─────────────────────────────────────────

export async function sendWhatsAppTemplateMessage(
  to:           string,
  templateName: string,
  languageCode: string,
): Promise<SendResult> {
  const config = getMetaConfig()
  if (!config) return { ok: false, error: 'WhatsApp not configured.' }

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
        to,
        type:              'template',
        template: {
          name:     templateName,
          language: { code: languageCode },
        },
      }),
    })

    if (!res.ok) {
      let errMsg = 'Unknown error'
      try {
        const errBody = await res.json() as { error?: { message?: string } }
        errMsg = errBody.error?.message ?? errMsg
      } catch { /* ignore */ }
      console.error('[whatsapp] sendWhatsAppTemplateMessage failed:', res.status, errMsg)
      return { ok: false, error: 'Failed to send template. Check the template name and approval status.' }
    }

    const data = await res.json() as { messages?: Array<{ id: string }> }
    return { ok: true, messageId: data.messages?.[0]?.id }

  } catch (err) {
    console.error('[whatsapp] sendWhatsAppTemplateMessage error:', err instanceof Error ? err.message : err)
    captureApiError(err, { route: '/api/whatsapp/send-template', error_type: 'template_send_error' })
    return { ok: false, error: 'Failed to send template.' }
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
    // Non-critical — never throw
  }
}

// ── Parse incoming message (text or media) ────────────────────────

export type MediaType = 'image' | 'audio' | 'document' | 'video' | 'sticker'

export interface ParsedWhatsAppMessage {
  messageId:     string
  fromPhone:     string
  toPhone:       string
  phoneNumberId: string
  customerName:  string | null
  messageType:   'text' | MediaType | 'unsupported'
  // text
  text:          string | null
  // media
  mediaId:       string | null
  mediaMimeType: string | null
  mediaCaption:  string | null
  timestamp:     string
}

const MEDIA_TYPES: ReadonlyArray<MediaType> = ['image', 'audio', 'document', 'video', 'sticker']

export function parseIncomingWhatsAppMessage(entry: {
  changes: Array<{
    value: {
      messaging_product: string
      metadata: { display_phone_number: string; phone_number_id: string }
      contacts?: Array<{ profile?: { name: string }; wa_id: string }>
      messages?: Array<{
        id: string; from: string; timestamp: string; type: string
        text?: { body: string }
        image?:    { id?: string; mime_type?: string; caption?: string }
        audio?:    { id?: string; mime_type?: string }
        document?: { id?: string; mime_type?: string; filename?: string; caption?: string }
        video?:    { id?: string; mime_type?: string; caption?: string }
        sticker?:  { id?: string; mime_type?: string }
      }>
    }
  }>
}): ParsedWhatsAppMessage | null {
  const change = entry.changes[0]
  if (!change) return null

  const { value }    = change
  const msg          = value.messages?.[0]
  if (!msg) return null

  const contact      = value.contacts?.[0]
  const customerName = contact?.profile?.name ?? null
  const msgType      = msg.type as string

  // Text message
  if (msgType === 'text' && msg.text?.body) {
    return {
      messageId:     msg.id,
      fromPhone:     msg.from,
      toPhone:       value.metadata.display_phone_number,
      phoneNumberId: value.metadata.phone_number_id,
      customerName,
      messageType:   'text',
      text:          msg.text.body,
      mediaId:       null,
      mediaMimeType: null,
      mediaCaption:  null,
      timestamp:     msg.timestamp,
    }
  }

  // Media message
  const detectedMediaType = MEDIA_TYPES.find((t) => t === msgType)
  if (detectedMediaType) {
    const mediaPayload = msg[detectedMediaType as MediaType] as
      { id?: string; mime_type?: string; caption?: string; filename?: string } | undefined

    return {
      messageId:     msg.id,
      fromPhone:     msg.from,
      toPhone:       value.metadata.display_phone_number,
      phoneNumberId: value.metadata.phone_number_id,
      customerName,
      messageType:   detectedMediaType,
      text:          null,
      mediaId:       mediaPayload?.id ?? null,
      mediaMimeType: mediaPayload?.mime_type ?? null,
      mediaCaption:  mediaPayload?.caption ?? null,
      timestamp:     msg.timestamp,
    }
  }

  // Unsupported (reactions, location, contacts, etc.) — return minimal info to ack
  return {
    messageId:     msg.id,
    fromPhone:     msg.from,
    toPhone:       value.metadata.display_phone_number,
    phoneNumberId: value.metadata.phone_number_id,
    customerName,
    messageType:   'unsupported',
    text:          null,
    mediaId:       null,
    mediaMimeType: null,
    mediaCaption:  null,
    timestamp:     msg.timestamp,
  }
}

// ── Handoff keyword detection ─────────────────────────────────────

const HANDOFF_PATTERNS = [
  'human', 'agent', 'representative', 'talk to someone', 'speak to someone',
  'real person', 'support', 'help desk', 'customer service', 'live chat',
]

export function isHandoffRequest(text: string): boolean {
  const lower = text.toLowerCase()
  return HANDOFF_PATTERNS.some((p) => lower.includes(p))
}
