import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { sendTemplate } from '@/lib/whatsapp/templates'
import { getBusinessPlan } from '@/lib/billing/limits'
import { whatsappTemplateSendSchema } from '@/lib/validation/whatsapp'
import { captureApiError } from '@/lib/logging/api'
import { captureServerEvent } from '@/lib/analytics/server'

const PLAN_ORDER: Record<string, number> = { starter: 0, pro: 1, scale: 2 }

// POST /api/whatsapp/send-template
// Protected dashboard route — Scale plan only.
// Sends a pre-approved WhatsApp template message.

export async function POST(request: NextRequest) {
  // 1. Auth
  const authClient = await createClient()
  const { data: { user }, error: authErr } = await authClient.auth.getUser()
  if (!user) {
    console.error('[whatsapp/send-template] auth failed:', authErr?.message)
    return NextResponse.json({ error: 'Please sign in to send templates.' }, { status: 401 })
  }

  // 2. Parse + validate
  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const parsed = whatsappTemplateSendSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input.' }, { status: 400 })
  }

  const { session_id, template_name, template_language } = parsed.data

  // 3. Business lookup
  const db = createServiceRoleClient()
  const { data: membership } = await db
    .from('business_members').select('business_id').eq('user_id', user.id).limit(1).single()
  if (!membership) {
    return NextResponse.json({ error: 'Create a business profile first.' }, { status: 404 })
  }
  const businessId = (membership as { business_id: string }).business_id

  // 4. Scale plan gate — templates are Scale only
  const plan = await getBusinessPlan(db, businessId)
  if ((PLAN_ORDER[plan] ?? 0) < (PLAN_ORDER['scale'] ?? 2)) {
    return NextResponse.json({ error: 'Template messages require the Scale plan.' }, { status: 402 })
  }

  // 5. Verify session
  const { data: sess } = await db
    .from('chat_sessions')
    .select('id, business_id, external_thread_id, channel')
    .eq('id', session_id)
    .eq('business_id', businessId)
    .single()

  if (!sess) {
    return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 })
  }

  const session = sess as { id: string; external_thread_id: string | null; channel: string }
  if (session.channel !== 'whatsapp' || !session.external_thread_id) {
    return NextResponse.json({ error: 'This conversation is not a WhatsApp session.' }, { status: 400 })
  }

  // 6. Verify WhatsApp enabled
  const { data: conn } = await db
    .from('whatsapp_connections').select('is_enabled').eq('business_id', businessId).single()
  if (!(conn as { is_enabled?: boolean } | null)?.is_enabled) {
    return NextResponse.json({ error: 'WhatsApp channel is not enabled.' }, { status: 400 })
  }

  // 7. Send template
  const result = await sendTemplate({
    to:           session.external_thread_id,
    templateName: template_name,
    languageCode: template_language,
  })

  if (!result.ok) {
    captureApiError(new Error(result.error ?? 'template send failed'), {
      route: '/api/whatsapp/send-template', error_type: 'template_send_failed', business_id: businessId,
    })
    return NextResponse.json({ error: result.error ?? 'Failed to send template.' }, { status: 500 })
  }

  // 8. Save outbound row
  const displayName = `Template: ${template_name} (${template_language})`
  await db.from('whatsapp_messages').insert({
    business_id:         businessId,
    chat_session_id:     session_id,
    whatsapp_message_id: result.messageId ?? `tmpl_${Date.now()}`,
    from_phone:          process.env.WHATSAPP_PHONE_NUMBER_ID ?? 'system',
    to_phone:            session.external_thread_id,
    direction:           'outbound',
    message_type:        'template',
    content_summary:     displayName,
    status:              'sent',
    template_name,
    template_language,
    sent_by_user_id:     user.id,
    metadata:            { template_send: true },
  }).catch((e: unknown) => console.error('[whatsapp/send-template] save:', (e as Error).message))

  // 9. Audit + analytics
  await db.from('audit_logs').insert({
    business_id: businessId,
    user_id:     user.id,
    action:      'whatsapp.template.sent',
    resource:    'chat_sessions',
    resource_id: session_id,
  }).catch(() => undefined)

  void captureServerEvent('whatsapp_template_sent', {
    business_id: businessId.slice(0, 8),
    template:    template_name,
    language:    template_language,
    plan,
  })

  return NextResponse.json({ ok: true, message_id: result.messageId })
}
