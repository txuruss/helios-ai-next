import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { sendWhatsAppTextMessage } from '@/lib/whatsapp/client'
import { getBusinessPlan } from '@/lib/billing/limits'
import { whatsappManualReplySchema } from '@/lib/validation/whatsapp'
import { captureApiError } from '@/lib/logging/api'
import { captureServerEvent } from '@/lib/analytics/server'

const PLAN_ORDER: Record<string, number> = { starter: 0, pro: 1, scale: 2 }

// POST /api/whatsapp/send
// Protected dashboard route — sends a manual WhatsApp reply from an agent.

export async function POST(request: NextRequest) {
  // 1. Auth
  const authClient = await createClient()
  const { data: { user }, error: authErr } = await authClient.auth.getUser()
  if (!user) {
    console.error('[whatsapp/send] auth failed:', authErr?.message)
    return NextResponse.json({ error: 'Please sign in to send WhatsApp messages.' }, { status: 401 })
  }

  // 2. Parse + validate body
  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const parsed = whatsappManualReplySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input.' }, { status: 400 })
  }

  const { session_id, message } = parsed.data

  // 3. Look up business via service role
  const db = createServiceRoleClient()
  const { data: membership } = await db
    .from('business_members').select('business_id').eq('user_id', user.id).limit(1).single()
  if (!membership) {
    return NextResponse.json({ error: 'Create a business profile first.' }, { status: 404 })
  }
  const businessId = (membership as { business_id: string }).business_id

  // 4. Plan gate — manual replies require Pro or Scale
  const plan = await getBusinessPlan(db, businessId)
  if ((PLAN_ORDER[plan] ?? 0) < (PLAN_ORDER['pro'] ?? 1)) {
    return NextResponse.json({ error: 'This feature requires the Pro plan.' }, { status: 402 })
  }

  // 5. Verify the session belongs to this business and channel is WhatsApp
  const { data: sess } = await db
    .from('chat_sessions')
    .select('id, business_id, external_thread_id, channel, handoff_status')
    .eq('id', session_id)
    .eq('business_id', businessId)
    .single()

  if (!sess) {
    return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 })
  }

  const session = sess as {
    id: string; business_id: string; external_thread_id: string | null
    channel: string; handoff_status: string
  }

  if (session.channel !== 'whatsapp' || !session.external_thread_id) {
    return NextResponse.json({ error: 'This conversation is not a WhatsApp session.' }, { status: 400 })
  }

  // 6. Verify WhatsApp connection is enabled for this business
  const { data: conn } = await db
    .from('whatsapp_connections')
    .select('is_enabled')
    .eq('business_id', businessId)
    .single()

  if (!(conn as { is_enabled?: boolean } | null)?.is_enabled) {
    return NextResponse.json({ error: 'WhatsApp channel is not enabled.' }, { status: 400 })
  }

  // 7. Send via Meta
  const sendResult = await sendWhatsAppTextMessage(session.external_thread_id, message)

  if (!sendResult.ok) {
    captureApiError(new Error(sendResult.error ?? 'send failed'), {
      route: '/api/whatsapp/send', error_type: 'manual_send_failed', business_id: businessId,
    })
    return NextResponse.json({ error: 'Failed to send WhatsApp message.' }, { status: 500 })
  }

  // 8. Save outbound message row
  const summary = message.length > 200 ? `${message.slice(0, 200)}…` : message
  await db.from('whatsapp_messages').insert({
    business_id:         businessId,
    chat_session_id:     session_id,
    whatsapp_message_id: sendResult.messageId ?? `manual_${Date.now()}`,
    from_phone:          process.env.WHATSAPP_PHONE_NUMBER_ID ?? 'system',
    to_phone:            session.external_thread_id,
    direction:           'outbound',
    message_type:        'text',
    content_summary:     summary,
    status:              'sent',
    sent_by_user_id:     user.id,
    metadata:            { manual_reply: true },
  }).catch((e: unknown) => console.error('[whatsapp/send] save outbound:', (e as Error).message))

  // 9. Update session: mark handoff_status = human if not already, set last_agent_reply_at
  const newStatus = session.handoff_status === 'ai' || session.handoff_status === 'human_requested'
    ? 'human'
    : session.handoff_status

  await db.from('chat_sessions').update({
    handoff_status:      newStatus,
    last_agent_reply_at: new Date().toISOString(),
  }).eq('id', session_id)

  // 10. Audit + analytics
  await db.from('audit_logs').insert({
    business_id: businessId,
    user_id:     user.id,
    action:      'whatsapp.manual_reply.sent',
    resource:    'chat_sessions',
    resource_id: session_id,
  }).catch(() => undefined)

  void captureServerEvent('whatsapp_reply_sent', {
    business_id: businessId.slice(0, 8),
    send_ok:     true,
    manual:      true,
    plan,
  })

  return NextResponse.json({ ok: true, message_id: sendResult.messageId })
}
