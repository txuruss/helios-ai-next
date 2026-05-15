import { NextResponse, type NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import {
  verifyMetaWebhookSignature,
  sendWhatsAppTextMessage,
  markMessageAsRead,
  parseIncomingWhatsAppMessage,
} from '@/lib/whatsapp/client'
import { generateAIReply } from '@/lib/ai/respond'
import { getBusinessPlan } from '@/lib/billing/limits'
import { whatsappWebhookVerifySchema, whatsappWebhookPayloadSchema } from '@/lib/validation/whatsapp'
import { captureApiError } from '@/lib/logging/api'

const MAX_BODY_BYTES = 64 * 1024
const PLAN_ORDER: Record<string, number> = { starter: 0, pro: 1, scale: 2 }

// ── GET — Meta webhook verification ──────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const queryObj = {
    'hub.mode':         searchParams.get('hub.mode')         ?? '',
    'hub.verify_token': searchParams.get('hub.verify_token') ?? '',
    'hub.challenge':    searchParams.get('hub.challenge')    ?? '',
  }

  const parsed = whatsappWebhookVerifySchema.safeParse(queryObj)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid verification request.' }, { status: 403 })
  }

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN
  if (!verifyToken) {
    console.error('[whatsapp/webhook] WHATSAPP_VERIFY_TOKEN not configured')
    return NextResponse.json({ error: 'Webhook not configured.' }, { status: 403 })
  }

  if (parsed.data['hub.verify_token'] !== verifyToken) {
    console.warn('[whatsapp/webhook] Verify token mismatch')
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  return new NextResponse(parsed.data['hub.challenge'], {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  })
}

// ── POST — incoming WhatsApp messages ────────────────────────────

export async function POST(request: NextRequest) {
  // 1. Read raw body with size cap
  let rawBody: string
  try { rawBody = await request.text() } catch {
    return NextResponse.json({ error: 'Could not read request body.' }, { status: 400 })
  }

  if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large.' }, { status: 413 })
  }

  // 2. Verify Meta signature
  const sig = request.headers.get('x-hub-signature-256')
  if (!verifyMetaWebhookSignature(rawBody, sig)) {
    console.error('[whatsapp/webhook] Signature verification failed')
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  // 3. Parse + validate payload
  let body: unknown
  try { body = JSON.parse(rawBody) } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const parsed = whatsappWebhookPayloadSchema.safeParse(body)
  if (!parsed.success) {
    // Unrecognised event type — acknowledge silently so Meta doesn't retry
    return NextResponse.json({ ok: true, message: 'Event not handled.' })
  }

  if (parsed.data.object !== 'whatsapp_business_account') {
    return NextResponse.json({ ok: true, message: 'Not a WhatsApp event.' })
  }

  // 4. Process first message entry (Meta batches rarely have more than one)
  const entry = parsed.data.entry[0]
  if (!entry) return NextResponse.json({ ok: true })

  const inbound = parseIncomingWhatsAppMessage(entry)
  if (!inbound) {
    // Status update, media, or other non-text event — return 200 quickly
    return NextResponse.json({ ok: true })
  }

  // 5. Respond 200 immediately so Meta doesn't retry on slow processing
  //    Use waitUntil-equivalent: run async but don't await
  void processInboundMessage(inbound, rawBody)

  return NextResponse.json({ ok: true })
}

// ── Internal: process message asynchronously ──────────────────────

interface InboundMessage {
  messageId:     string
  fromPhone:     string
  toPhone:       string
  phoneNumberId: string
  customerName:  string | null
  text:          string
  timestamp:     string
}

async function processInboundMessage(inbound: InboundMessage, _rawBody: string): Promise<void> {
  const db = createServiceRoleClient()

  try {
    // 6. Find the business by phone_number_id stored in whatsapp_connections
    const { data: conn } = await db
      .from('whatsapp_connections')
      .select('business_id, is_enabled')
      .eq('phone_number_id', inbound.phoneNumberId)
      .single()

    if (!conn) {
      console.warn('[whatsapp/webhook] No business found for phone_number_id:', inbound.phoneNumberId)
      return
    }

    const connection = conn as { business_id: string; is_enabled: boolean }

    if (!connection.is_enabled) {
      console.log('[whatsapp/webhook] WhatsApp disabled for business:', connection.business_id.slice(0, 8))
      return
    }

    const businessId = connection.business_id

    // 7. Plan gate — WhatsApp requires Pro or Scale
    const plan = await getBusinessPlan(db, businessId)
    if ((PLAN_ORDER[plan] ?? 0) < (PLAN_ORDER['pro'] ?? 1)) {
      console.log('[whatsapp/webhook] Business on starter plan — WhatsApp not allowed:', businessId.slice(0, 8))
      return
    }

    // 8. Deduplicate — skip if we've already processed this message_id
    const { data: existingMsg } = await db
      .from('whatsapp_messages')
      .select('id')
      .eq('whatsapp_message_id', inbound.messageId)
      .single()

    if (existingMsg) {
      console.log('[whatsapp/webhook] Duplicate message_id, skipping:', inbound.messageId)
      return
    }

    // 9. Mark as read (fire-and-forget)
    void markMessageAsRead(inbound.messageId)

    // 10. Save inbound message (content_summary = first 200 chars)
    const contentSummary = inbound.text.length > 200
      ? `${inbound.text.slice(0, 200)}…`
      : inbound.text

    const { data: savedMsg } = await db.from('whatsapp_messages').insert({
      business_id:         businessId,
      whatsapp_message_id: inbound.messageId,
      from_phone:          inbound.fromPhone,
      to_phone:            inbound.toPhone,
      direction:           'inbound',
      message_type:        'text',
      content_summary:     contentSummary,
      status:              'received',
      metadata:            { customer_name: inbound.customerName, timestamp: inbound.timestamp },
    }).select('id').single()

    const savedMsgId = (savedMsg as { id: string } | null)?.id ?? null

    // 11. Build conversation history: load recent messages for this session
    //     We find/create the session via externalRef (fromPhone) in generateAIReply
    //     For history, load the last 10 messages from the active session if any
    let history: Array<{ role: 'user' | 'assistant'; content: string }> = []

    const { data: existingSession } = await db
      .from('chat_sessions')
      .select('id')
      .eq('business_id', businessId)
      .eq('external_thread_id', inbound.fromPhone)
      .eq('channel', 'whatsapp')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (existingSession) {
      const { data: recentMsgs } = await db
        .from('chat_messages')
        .select('role, content')
        .eq('session_id', (existingSession as { id: string }).id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (recentMsgs) {
        history = (recentMsgs as Array<{ role: string; content: string }>)
          .reverse()
          .filter((m): m is { role: 'user' | 'assistant'; content: string } =>
            m.role === 'user' || m.role === 'assistant',
          )
      }
    }

    // Append current message
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...history,
      { role: 'user', content: inbound.text },
    ]

    // 12. Generate AI reply using shared engine
    const aiResult = await generateAIReply({
      businessId,
      channel:     'whatsapp',
      messages,
      db,
      externalRef: inbound.fromPhone,
    })

    if (!aiResult.ok || !aiResult.reply) {
      console.error('[whatsapp/webhook] AI reply failed:', aiResult.error)
      captureApiError(new Error(aiResult.error ?? 'AI reply failed'), {
        route: '/api/webhooks/whatsapp',
        error_type: 'ai_reply_failed',
        business_id: businessId,
      })

      // Log failure
      await db.from('audit_logs').insert({
        business_id: businessId,
        user_id:     null,
        action:      'whatsapp.webhook.ai_failed',
        resource:    'whatsapp_messages',
        resource_id: savedMsgId,
      }).catch(() => undefined)

      return
    }

    // 13. Update inbound message row with session_id and lead_id
    if (savedMsgId && aiResult.sessionId) {
      await db.from('whatsapp_messages')
        .update({ chat_session_id: aiResult.sessionId, lead_id: aiResult.leadId })
        .eq('id', savedMsgId)
    }

    // 14. Send WhatsApp reply
    const sendResult = await sendWhatsAppTextMessage(inbound.fromPhone, aiResult.reply)

    // 15. Save outbound message
    const outboundSummary = aiResult.reply.length > 200
      ? `${aiResult.reply.slice(0, 200)}…`
      : aiResult.reply

    await db.from('whatsapp_messages').insert({
      business_id:         businessId,
      lead_id:             aiResult.leadId,
      chat_session_id:     aiResult.sessionId,
      whatsapp_message_id: sendResult.messageId ?? `out_${Date.now()}`,
      from_phone:          inbound.toPhone,
      to_phone:            inbound.fromPhone,
      direction:           'outbound',
      message_type:        'text',
      content_summary:     outboundSummary,
      status:              sendResult.ok ? 'sent' : 'failed',
      metadata:            { ai_generated: true },
    }).catch(() => undefined)

    // 16. Audit log
    await db.from('audit_logs').insert({
      business_id: businessId,
      user_id:     null,
      action:      sendResult.ok ? 'whatsapp.webhook.replied' : 'whatsapp.webhook.send_failed',
      resource:    'whatsapp_messages',
      resource_id: savedMsgId,
    }).catch(() => undefined)

    console.log(`[whatsapp/webhook] Replied to ${inbound.fromPhone.slice(-4)} biz=${businessId.slice(0, 8)} send_ok=${sendResult.ok}`)

  } catch (err) {
    console.error('[whatsapp/webhook] processInboundMessage error:', err instanceof Error ? err.message : err)
    captureApiError(err, { route: '/api/webhooks/whatsapp', error_type: 'webhook_processing_error' })
  }
}
