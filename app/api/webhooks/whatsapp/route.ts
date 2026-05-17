import { NextResponse, type NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import {
  verifyMetaWebhookSignature,
  sendWhatsAppTextMessage,
  markMessageAsRead,
  parseIncomingWhatsAppMessage,
  isHandoffRequest,
} from '@/lib/whatsapp/client'
import { generateAIReply } from '@/lib/ai/respond'
import { getBusinessPlan } from '@/lib/billing/limits'
import { whatsappWebhookVerifySchema, whatsappWebhookPayloadSchema } from '@/lib/validation/whatsapp'
import { captureApiError } from '@/lib/logging/api'
import { captureServerEvent } from '@/lib/analytics/server'
import { createWebhookDeliveryLog, markWebhookProcessed } from '@/lib/ops/webhook-logs'

const MAX_BODY_BYTES = 64 * 1024
const PLAN_ORDER: Record<string, number> = { starter: 0, pro: 1, scale: 2 }

// Phrases that trigger a media-based handoff
const MEDIA_HANDOFF_TYPES = new Set(['document', 'image', 'video'])

// One-time handoff reply — sent only when transitioning ai → human_requested
const HANDOFF_REPLY_MESSAGE =
  "I'll notify the team so someone can help you directly. Please hold on!"

// Safe media acknowledgement (no AI hallucination about content)
const MEDIA_REPLY_MESSAGE =
  "I received your attachment. A team member can review it if needed."

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
  const startMs = Date.now()
  let rawBody: string
  try { rawBody = await request.text() } catch {
    return NextResponse.json({ error: 'Could not read request body.' }, { status: 400 })
  }

  if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large.' }, { status: 413 })
  }

  const sig = request.headers.get('x-hub-signature-256')
  if (!verifyMetaWebhookSignature(rawBody, sig)) {
    console.error('[whatsapp/webhook] Signature verification failed')
    captureApiError(new Error('Signature mismatch'), { route: '/api/webhooks/whatsapp', error_type: 'signature_failed' })
    void createWebhookDeliveryLog({ provider: 'whatsapp', routePath: '/api/webhooks/whatsapp', verificationStatus: 'failed', safeSummary: 'Signature verification failed' })
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  let body: unknown
  try { body = JSON.parse(rawBody) } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const parsed = whatsappWebhookPayloadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: true, message: 'Event not handled.' })
  }

  if (parsed.data.object !== 'whatsapp_business_account') {
    return NextResponse.json({ ok: true, message: 'Not a WhatsApp event.' })
  }

  const entry = parsed.data.entry[0]
  if (!entry) return NextResponse.json({ ok: true })

  const inbound = parseIncomingWhatsAppMessage(entry)
  if (!inbound || inbound.messageType === 'unsupported') {
    return NextResponse.json({ ok: true })
  }

  // Track webhook receipt (safe — no phone number, no content)
  void captureServerEvent('whatsapp_webhook_received', { message_type: inbound.messageType })

  // Log webhook (fire-and-forget — no raw content stored)
  void createWebhookDeliveryLog({
    provider:            'whatsapp',
    routePath:           '/api/webhooks/whatsapp',
    eventType:           inbound.messageType,
    verificationStatus:  process.env.META_APP_SECRET ? 'verified' : 'skipped',
    safeSummary:         `whatsapp ${inbound.messageType}`,
  }).then((logId) => {
    if (logId) void markWebhookProcessed({ logId, statusCode: 200, durationMs: Date.now() - startMs })
  })

  // Respond 200 immediately; process asynchronously
  void processInboundMessage(inbound)
  return NextResponse.json({ ok: true })
}

// ── Internal: process message asynchronously ──────────────────────

interface InboundMessage {
  messageId:     string
  fromPhone:     string
  toPhone:       string
  phoneNumberId: string
  customerName:  string | null
  messageType:   string
  text:          string | null
  mediaId:       string | null
  mediaMimeType: string | null
  mediaCaption:  string | null
  timestamp:     string
}

async function processInboundMessage(inbound: InboundMessage): Promise<void> {
  const db = createServiceRoleClient()

  try {
    // 1. Find business by phone_number_id
    const { data: conn } = await db
      .from('whatsapp_connections')
      .select('business_id, is_enabled')
      .eq('phone_number_id', inbound.phoneNumberId)
      .single()

    if (!conn) {
      console.warn('[whatsapp/webhook] No business for phone_number_id:', inbound.phoneNumberId)
      return
    }

    const connection  = conn as { business_id: string; is_enabled: boolean }
    const businessId  = connection.business_id

    if (!connection.is_enabled) {
      console.log('[whatsapp/webhook] Channel disabled:', businessId.slice(0, 8))
      return
    }

    // 2. Plan gate
    const plan = await getBusinessPlan(db, businessId)
    if ((PLAN_ORDER[plan] ?? 0) < (PLAN_ORDER['pro'] ?? 1)) {
      console.log('[whatsapp/webhook] Starter plan — skipping:', businessId.slice(0, 8))
      return
    }

    // 3. Deduplicate
    const { data: existingMsg } = await db
      .from('whatsapp_messages')
      .select('id')
      .eq('whatsapp_message_id', inbound.messageId)
      .single()

    if (existingMsg) {
      console.log('[whatsapp/webhook] Duplicate, skipping:', inbound.messageId)
      return
    }

    // 4. Mark as read (fire-and-forget)
    void markMessageAsRead(inbound.messageId)

    // 5. Build content summary (no full text stored)
    const rawContent = inbound.text ?? inbound.mediaCaption ?? `[${inbound.messageType}]`
    const contentSummary = rawContent.length > 200
      ? `${rawContent.slice(0, 200)}…`
      : rawContent

    // 6. Save inbound message
    const { data: savedMsg } = await db.from('whatsapp_messages').insert({
      business_id:         businessId,
      whatsapp_message_id: inbound.messageId,
      from_phone:          inbound.fromPhone,
      to_phone:            inbound.toPhone,
      direction:           'inbound',
      message_type:        inbound.messageType,
      content_summary:     contentSummary,
      status:              'received',
      media_id:            inbound.mediaId,
      media_mime_type:     inbound.mediaMimeType,
      metadata:            { customer_name: inbound.customerName, timestamp: inbound.timestamp },
    }).select('id').single()

    const savedMsgId = (savedMsg as { id: string } | null)?.id ?? null

    // 7. Find or note existing session (to check handoff_status)
    const { data: existingSession } = await db
      .from('chat_sessions')
      .select('id, handoff_status')
      .eq('business_id', businessId)
      .eq('external_thread_id', inbound.fromPhone)
      .eq('channel', 'whatsapp')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const currentHandoff = (existingSession as { id?: string; handoff_status?: string } | null)?.handoff_status ?? 'ai'
    const sessionId      = (existingSession as { id?: string } | null)?.id ?? null
    const now            = new Date().toISOString()

    // Update session metadata + increment unread count atomically
    if (sessionId) {
      await db.from('chat_sessions').update({
        last_customer_message_at: now,
        last_message_at:          now,
        last_message_preview:     contentSummary,
        last_message_direction:   'inbound',
      }).eq('id', sessionId)

      // Atomic unread increment via SQL function
      await db.rpc('increment_chat_session_unread', { p_session_id: sessionId }).catch(() => undefined)
    }

    // Track safe event
    void captureServerEvent('whatsapp_message_received', {
      business_id:    businessId.slice(0, 8),
      message_type:   inbound.messageType,
      handoff_status: currentHandoff,
      plan,
    })

    // 8. Human handoff check — if already human, skip AI
    if (currentHandoff === 'human' || currentHandoff === 'resolved' || currentHandoff === 'archived') {
      console.log('[whatsapp/webhook] Human session — no AI reply. session:', sessionId?.slice(0, 8))
      return
    }

    // 9. Media message — send safe acknowledgement, optionally request handoff
    if (inbound.messageType !== 'text') {
      const shouldHandoff = MEDIA_HANDOFF_TYPES.has(inbound.messageType)

      const sendResult = await sendWhatsAppTextMessage(inbound.fromPhone, MEDIA_REPLY_MESSAGE)

      await db.from('whatsapp_messages').insert({
        business_id:         businessId,
        chat_session_id:     sessionId,
        whatsapp_message_id: sendResult.messageId ?? `out_media_${Date.now()}`,
        from_phone:          inbound.toPhone,
        to_phone:            inbound.fromPhone,
        direction:           'outbound',
        message_type:        'text',
        content_summary:     MEDIA_REPLY_MESSAGE,
        status:              sendResult.ok ? 'sent' : 'failed',
        metadata:            { auto_media_reply: true },
      }).catch(() => undefined)

      if (shouldHandoff && sessionId && currentHandoff === 'ai') {
        await db.from('chat_sessions')
          .update({ handoff_status: 'human_requested' })
          .eq('id', sessionId)
      }

      void captureServerEvent('whatsapp_media_received', {
        business_id:  businessId.slice(0, 8),
        media_type:   inbound.messageType,
        did_handoff:  shouldHandoff,
      })
      return
    }

    // 10. Handoff keyword detection (text messages only)
    const userText  = inbound.text ?? ''
    const wantsHuman = currentHandoff === 'human_requested'
      ? true  // already waiting — don't re-trigger
      : isHandoffRequest(userText)

    if (wantsHuman && currentHandoff === 'ai') {
      // Transition: ai → human_requested (one-time only)
      if (sessionId) {
        await db.from('chat_sessions')
          .update({ handoff_status: 'human_requested' })
          .eq('id', sessionId)
      }

      const sendResult = await sendWhatsAppTextMessage(inbound.fromPhone, HANDOFF_REPLY_MESSAGE)

      await db.from('whatsapp_messages').insert({
        business_id:         businessId,
        chat_session_id:     sessionId,
        whatsapp_message_id: sendResult.messageId ?? `out_handoff_${Date.now()}`,
        from_phone:          inbound.toPhone,
        to_phone:            inbound.fromPhone,
        direction:           'outbound',
        message_type:        'text',
        content_summary:     HANDOFF_REPLY_MESSAGE,
        status:              sendResult.ok ? 'sent' : 'failed',
        metadata:            { auto_handoff_reply: true },
      }).catch(() => undefined)

      if (savedMsgId && sessionId) {
        await db.from('whatsapp_messages')
          .update({ chat_session_id: sessionId })
          .eq('id', savedMsgId)
      }

      void captureServerEvent('handoff_requested', {
        business_id: businessId.slice(0, 8),
        plan,
        channel:     'whatsapp',
      })

      console.log('[whatsapp/webhook] Handoff requested:', businessId.slice(0, 8))
      return
    }

    if (wantsHuman && currentHandoff === 'human_requested') {
      // Already in human_requested — just save, no AI, no repeat message
      if (savedMsgId && sessionId) {
        await db.from('whatsapp_messages')
          .update({ chat_session_id: sessionId })
          .eq('id', savedMsgId)
      }
      return
    }

    // Phase 22: AI pause enforcement (business-level + conversation-level)
    const { data: bizPause } = await db
      .from('businesses').select('ai_paused').eq('id', businessId).single()
    const businessAiPaused = (bizPause as { ai_paused?: boolean } | null)?.ai_paused ?? false

    let convAiPaused = false
    if (sessionId) {
      const { data: sessRow } = await db
        .from('chat_sessions').select('ai_paused').eq('id', sessionId).single()
      convAiPaused = (sessRow as { ai_paused?: boolean } | null)?.ai_paused ?? false
    }

    if (businessAiPaused || convAiPaused) {
      const pauseMsg = 'Automated replies are paused for this conversation. A team member will follow up soon.'
      // Only send the fallback once — check if we already sent it for this session recently
      const { count: recentPauseMsgCount } = await db
        .from('whatsapp_messages')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('chat_session_id', sessionId ?? '')
        .contains('metadata', { ai_pause_fallback: true })

      if ((recentPauseMsgCount ?? 0) === 0 && sessionId) {
        // Send one-time fallback
        const pauseSend = await sendWhatsAppTextMessage(inbound.fromPhone, pauseMsg)
        await db.from('whatsapp_messages').insert({
          business_id:         businessId,
          chat_session_id:     sessionId,
          whatsapp_message_id: pauseSend.messageId ?? `out_pause_${Date.now()}`,
          from_phone:          inbound.toPhone,
          to_phone:            inbound.fromPhone,
          direction:           'outbound',
          message_type:        'text',
          content_summary:     pauseMsg,
          status:              pauseSend.ok ? 'sent' : 'failed',
          metadata:            { ai_pause_fallback: true },
        }).catch(() => undefined)
      }

      void captureServerEvent('whatsapp_ai_reply_skipped_paused', {
        business_id:   businessId.slice(0, 8),
        reason:        businessAiPaused ? 'business_paused' : 'conversation_paused',
      })

      void import('@/lib/ops/events').then(({ createOpsEvent }) =>
        createOpsEvent({
          business_id: businessId,
          source:      'whatsapp',
          event_type:  'whatsapp_ai_reply_skipped_paused',
          severity:    'info',
          title:       'WhatsApp AI reply skipped — AI paused',
          metadata:    { session_id: sessionId },
        }, db)
      ).catch(() => undefined)

      if (savedMsgId && sessionId) {
        await db.from('whatsapp_messages').update({ chat_session_id: sessionId }).eq('id', savedMsgId)
      }
      return
    }

    // 11. Normal AI flow — load history and generate reply
    let history: Array<{ role: 'user' | 'assistant'; content: string }> = []

    if (sessionId) {
      const { data: recentMsgs } = await db
        .from('chat_messages')
        .select('role, content')
        .eq('session_id', sessionId)
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

    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...history,
      { role: 'user', content: userText },
    ]

    // 12. Generate AI reply
    const aiResult = await generateAIReply({
      businessId,
      channel:     'whatsapp',
      messages,
      db,
      externalRef: inbound.fromPhone,
      existingSessionId: sessionId,
    })

    if (!aiResult.ok || !aiResult.reply) {
      console.error('[whatsapp/webhook] AI reply failed:', aiResult.error)
      captureApiError(new Error(aiResult.error ?? 'AI reply failed'), {
        route:      '/api/webhooks/whatsapp',
        error_type: 'ai_reply_failed',
        business_id: businessId,
      })
      return
    }

    // Update inbound message with session + lead
    const resolvedSessionId = aiResult.sessionId ?? sessionId
    if (savedMsgId && resolvedSessionId) {
      await db.from('whatsapp_messages')
        .update({ chat_session_id: resolvedSessionId, lead_id: aiResult.leadId })
        .eq('id', savedMsgId)
    }

    // 13. Send reply
    const sendResult = await sendWhatsAppTextMessage(inbound.fromPhone, aiResult.reply)

    // 14. Save outbound
    const outSummary = aiResult.reply.length > 200 ? `${aiResult.reply.slice(0, 200)}…` : aiResult.reply
    await db.from('whatsapp_messages').insert({
      business_id:         businessId,
      lead_id:             aiResult.leadId,
      chat_session_id:     resolvedSessionId,
      whatsapp_message_id: sendResult.messageId ?? `out_${Date.now()}`,
      from_phone:          inbound.toPhone,
      to_phone:            inbound.fromPhone,
      direction:           'outbound',
      message_type:        'text',
      content_summary:     outSummary,
      status:              sendResult.ok ? 'sent' : 'failed',
      metadata:            { ai_generated: true },
    }).catch(() => undefined)

    // Update session: last_agent_reply_at + last_message fields for the AI reply
    if (resolvedSessionId) {
      await db.from('chat_sessions').update({
        last_agent_reply_at:      new Date().toISOString(),
        last_message_at:          new Date().toISOString(),
        last_message_preview:     outSummary,
        last_message_direction:   'outbound',
      }).eq('id', resolvedSessionId)
    }

    // Phase 22: Store AI confidence (fire-and-forget)
    if (resolvedSessionId) {
      void import('@/lib/ai/confidence').then(({ calculateAiConfidence }) => {
        const conf = calculateAiConfidence({
          userMessage:         userText,
          hasFaqMatch:         false,
          hasServiceMatch:     false,
          hasBookingDetails:   !!(aiResult.calcomBookingUid),
          isHandoffActive:     false,
          isBusinessPaused:    false,
          isConvPaused:        false,
          missingBusinessData: false,
        })
        void import('@/lib/ai/confidence-server').then(({ storeAiConfidence }) =>
          storeAiConfidence({
            sessionId:      resolvedSessionId,
            businessId,
            confidence:     conf.confidence,
            reason:         conf.reason,
            requiresReview: conf.requiresReview,
          })
        )
      }).catch(() => undefined)
    }

    // 15. Analytics
    void captureServerEvent('whatsapp_reply_sent', {
      business_id:  businessId.slice(0, 8),
      send_ok:      sendResult.ok,
      has_lead:     !!aiResult.leadId,
      lead_created: aiResult.leadCreated,
      plan,
    })

    if (aiResult.leadCreated) {
      void captureServerEvent('whatsapp_lead_created', {
        business_id: businessId.slice(0, 8),
        channel:     'whatsapp',
        plan,
      })
    }

    // 16. Audit
    await db.from('audit_logs').insert({
      business_id: businessId,
      user_id:     null,
      action:      sendResult.ok ? 'whatsapp.webhook.replied' : 'whatsapp.webhook.send_failed',
      resource:    'whatsapp_messages',
      resource_id: savedMsgId,
    }).catch(() => undefined)

    console.log(`[whatsapp/webhook] OK biz=${businessId.slice(0, 8)} send=${sendResult.ok}`)

  } catch (err) {
    console.error('[whatsapp/webhook] processInboundMessage error:', err instanceof Error ? err.message : err)
    captureApiError(err, { route: '/api/webhooks/whatsapp', error_type: 'webhook_processing_error' })
  }
}
