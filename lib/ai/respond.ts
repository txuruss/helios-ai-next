// ── Shared AI response engine — server-only ───────────────────────
// Used by /api/chat (widget) and /api/webhooks/whatsapp.
// All AI logic, lead extraction, and booking lives here.
// Never call this from client components.

import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { buildSystemPrompt } from '@/lib/ai/prompt'
import { sendLeadNotification } from '@/lib/notifications/owner'
import { checkLimit, trackUsage } from '@/lib/billing/limits'
import { getAvailability, createBooking } from '@/lib/calcom/client'
import { captureApiError } from '@/lib/logging/api'
import type { AgentSettings, Business, FAQ, Service, WidgetSettings } from '@/types'

const CHAT_MODEL = 'claude-haiku-4-5'

// ── Types ─────────────────────────────────────────────────────────

type DbClient = ReturnType<typeof import('@/lib/supabase/server').createServiceRoleClient>
type DbRow    = Record<string, unknown>

export interface AIRespondInput {
  businessId:         string
  channel:            'widget' | 'whatsapp' | 'test'
  messages:           Array<{ role: 'user' | 'assistant'; content: string }>
  db:                 DbClient
  existingSessionId?: string | null
  visitorId?:         string | null
  externalRef?:       string | null  // WhatsApp: from_phone used to find/create session
}

export type AIRespondErrorCode =
  | 'plan_limit'
  | 'business_not_found'
  | 'widget_disabled'
  | 'anthropic_error'
  | 'ai_empty'

export interface AIRespondOutput {
  ok:               boolean
  reply?:           string
  sessionId:        string | null
  leadId:           string | null
  leadCreated:      boolean
  calcomBookingUid: string | null
  error?:           string
  errorCode?:       AIRespondErrorCode
}

// ── Lead annotation ────────────────────────────────────────────────

const LEAD_REGEX = /\[LEAD:(\{[^[\]]*\})\]\s*$/

interface LeadData {
  name:           string | null
  email:          string | null
  phone:          string | null
  service:        string | null
  intent:         string | null
  preferred_date: string | null
  preferred_time: string | null
  selected_time:  string | null
}

export function parseLeadAnnotation(raw: string): { clean: string; lead: LeadData | null } {
  const match = raw.match(LEAD_REGEX)
  if (!match) return { clean: raw.trim(), lead: null }
  const clean = raw.replace(LEAD_REGEX, '').trim()
  try {
    return { clean, lead: JSON.parse(match[1]) as LeadData }
  } catch {
    return { clean, lead: null }
  }
}

export function scoreLead(lead: LeadData): number {
  let score = 0
  if (lead.name)                                        score += 20
  if (lead.email)                                       score += 30
  if (lead.phone)                                       score += 20
  if (lead.service)                                     score += 15
  if (lead.intent)                                      score += 10
  if (lead.preferred_date || lead.preferred_time)       score += 5
  return Math.min(score, 100)
}

// ── Cal.com: real availability context for system prompt ──────────

async function getCalcomAvailabilityContext(
  db:         DbClient,
  businessId: string,
  messages:   Array<{ role: string; content: string }>,
): Promise<string> {
  if (!process.env.CALCOM_API_KEY) return ''

  try {
    const { data: mappings } = await db
      .from('service_event_mappings')
      .select(`
        service_id,
        calcom_event_type_id,
        services   ( id, name ),
        calcom_event_types ( calcom_id, title, duration_min )
      `)
      .eq('business_id', businessId)

    if (!mappings?.length) return ''

    const recentText = messages
      .filter((m) => m.role === 'user')
      .slice(-5)
      .map((m) => m.content.toLowerCase())
      .join(' ')

    const matched = (mappings as DbRow[]).find((m) => {
      const svc  = m.services as DbRow | null
      const name = typeof svc?.name === 'string' ? svc.name.toLowerCase() : ''
      return name && recentText.includes(name)
    })
    if (!matched) return ''

    const et  = matched.calcom_event_types as DbRow | null
    const svc = matched.services            as DbRow | null
    if (!et?.calcom_id || typeof et.calcom_id !== 'number') return ''

    const now   = new Date()
    const later = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    const result = await getAvailability({
      eventTypeId: et.calcom_id,
      startTime:   now.toISOString(),
      endTime:     later.toISOString(),
    })
    if (!result.ok || result.data.length === 0) return ''

    const slotLines = result.data
      .slice(0, 16)
      .map((s) => {
        const d = new Date(s.time)
        return `• ${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} — ISO: ${s.time}`
      })
      .join('\n')

    const serviceName = typeof svc?.name === 'string' ? svc.name : 'the requested service'

    return `## REAL Available Booking Slots — ${serviceName}
The following times are confirmed available via Cal.com (do NOT invent others):
${slotLines}

When the customer chooses one of these times, confirm it and set "selected_time" to its ISO value in [LEAD:{...}].`
  } catch (err) {
    console.error('[ai/respond] getCalcomAvailabilityContext error:', err instanceof Error ? err.message : err)
    return ''
  }
}

// ── Cal.com: create booking when lead confirms a slot ─────────────

async function maybeCreateCalcomBooking(
  db:        DbClient,
  businessId: string,
  lead:       LeadData,
  sessionId:  string | null,
): Promise<string | null> {
  if (!lead.selected_time || !lead.name || !lead.email || !lead.service) return null
  if (!process.env.CALCOM_API_KEY) return null
  if (isNaN(Date.parse(lead.selected_time))) return null

  try {
    const { data: services } = await db
      .from('services')
      .select('id, name')
      .eq('business_id', businessId)
      .eq('is_active', true)

    const svc = (services ?? []).find(
      (s: DbRow) => typeof s.name === 'string' &&
        s.name.toLowerCase() === lead.service!.toLowerCase(),
    ) as DbRow | undefined
    if (!svc?.id) return null

    const { data: mapping } = await db
      .from('service_event_mappings')
      .select('calcom_event_type_id')
      .eq('service_id', String(svc.id))
      .eq('business_id', businessId)
      .single()
    if (!mapping?.calcom_event_type_id) return null

    const { data: eventType } = await db
      .from('calcom_event_types')
      .select('calcom_id, duration_min')
      .eq('id', mapping.calcom_event_type_id)
      .single()
    const etRow = eventType as DbRow | null
    if (!etRow?.calcom_id) return null

    const calResult = await createBooking({
      eventTypeId: etRow.calcom_id as number,
      start:       lead.selected_time,
      attendee:    { name: lead.name, email: lead.email },
      notes:       lead.intent ?? undefined,
    })
    if (!calResult.ok) {
      console.error('[ai/respond] maybeCreateCalcomBooking:', calResult.error)
      return null
    }

    const cal = calResult.data

    let leadId: string | null = null
    if (sessionId) {
      const { data: sess } = await db
        .from('chat_sessions').select('lead_id').eq('id', sessionId).single()
      leadId = (sess as DbRow | null)?.lead_id as string | null ?? null
    }

    await db.from('bookings').insert({
      business_id:          businessId,
      service_id:           String(svc.id),
      lead_id:              leadId,
      customer_name:        lead.name,
      customer_email:       lead.email,
      customer_phone:       lead.phone,
      scheduled_at:         lead.selected_time,
      status:               cal.status === 'ACCEPTED' ? 'confirmed' : 'pending',
      calcom_booking_uid:   cal.calcom_booking_uid,
      calcom_event_type_id: cal.calcom_id,
      metadata:             { source: 'chat', session_id: sessionId },
    })

    if (leadId) {
      await db.from('leads').update({ status: 'proposal' }).eq('id', leadId)
    }

    return cal.calcom_booking_uid

  } catch (err) {
    console.error('[ai/respond] maybeCreateCalcomBooking error:', err instanceof Error ? err.message : err)
    return null
  }
}

// ── Main: generateAIReply ─────────────────────────────────────────
// Shared by widget chat and WhatsApp webhook.

export async function generateAIReply(input: AIRespondInput): Promise<AIRespondOutput> {
  const { businessId, channel, messages, db, existingSessionId, visitorId, externalRef } = input

  const FAIL = (error: string, errorCode: AIRespondErrorCode): AIRespondOutput => ({
    ok: false, error, errorCode, sessionId: null, leadId: null, leadCreated: false, calcomBookingUid: null,
  })

  // Load business config
  const [bizRes, agentRes, widgetRes, servicesRes, faqsRes] = await Promise.all([
    db.from('businesses').select('*').eq('id', businessId).single(),
    db.from('agent_settings').select('*').eq('business_id', businessId).single(),
    db.from('widget_settings').select('*').eq('business_id', businessId).single(),
    db.from('services').select('*').eq('business_id', businessId).eq('is_active', true).order('sort_order'),
    db.from('faqs').select('*').eq('business_id', businessId).eq('is_active', true).order('sort_order'),
  ])

  if (!bizRes.data) {
    return FAIL('Business not found.', 'business_not_found')
  }

  const business       = bizRes.data    as Business
  const agentSettings  = agentRes.data  as AgentSettings | null
  const widgetSettings = widgetRes.data as WidgetSettings | null
  const services       = (servicesRes.data ?? []) as Service[]
  const faqs           = (faqsRes.data    ?? []) as FAQ[]

  // Widget-specific: check if widget is enabled
  if (channel === 'widget' && widgetSettings && !widgetSettings.is_enabled) {
    return FAIL('Chat is currently disabled.', 'widget_disabled')
  }

  // Plan limit check (fire-and-forget safe — returns error code to caller)
  const rlCheck = await checkLimit(db, businessId, 'ai_conversation')
  if (!rlCheck.allowed) {
    return FAIL('Plan limit reached. Please upgrade to continue.', 'plan_limit')
  }

  // Resolve chat session
  let chatSessionId: string | null = existingSessionId ?? null

  if (!chatSessionId) {
    if (channel === 'whatsapp' && externalRef) {
      // Try to find an existing active WhatsApp session for this phone number
      const { data: existingSession } = await db
        .from('chat_sessions')
        .select('id')
        .eq('business_id', businessId)
        .eq('external_thread_id', externalRef)
        .eq('channel', 'whatsapp')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (existingSession) {
        chatSessionId = (existingSession as DbRow).id as string
      }
    }

    if (!chatSessionId) {
      const sessionInsert: Record<string, unknown> = {
        business_id:        businessId,
        visitor_id:         visitorId ?? null,
        status:             'active',
        channel,
        external_thread_id: externalRef ?? null,
      }
      const { data: newSession, error: sessErr } = await db
        .from('chat_sessions')
        .insert(sessionInsert)
        .select('id')
        .single()

      if (sessErr) {
        console.error('[ai/respond] Session create error:', sessErr.message)
      } else {
        chatSessionId = (newSession as DbRow | null)?.id as string | null
      }
    }
  }

  // Persist user message
  const lastMsg   = messages[messages.length - 1]
  const inputChars = messages.reduce((n, m) => n + m.content.length, 0)

  if (chatSessionId && lastMsg?.role === 'user') {
    await db.from('chat_messages').insert({
      session_id:  chatSessionId,
      business_id: businessId,
      role:        'user',
      content:     lastMsg.content,
      metadata:    { channel, input_chars: inputChars },
    })
  }

  // Cal.com context + system prompt
  const calcomContext  = await getCalcomAvailabilityContext(db, businessId, messages)
  const systemPrompt   = buildSystemPrompt({ business, services, faqs, agentSettings, widgetSettings, calcomContext })

  // Call Anthropic
  let rawReply: string
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const aiResponse = await anthropic.messages.create({
      model:      CHAT_MODEL,
      max_tokens: 512,
      system: [
        { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } },
      ],
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    })

    const textBlock = aiResponse.content.find((b) => b.type === 'text')
    rawReply = textBlock?.type === 'text' ? textBlock.text : ''

    if (!rawReply) {
      console.error('[ai/respond] Empty Anthropic response')
      return FAIL('No response generated. Please try again.', 'ai_empty')
    }
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return FAIL('Service temporarily busy. Please try again in a moment.', 'anthropic_error')
    }
    if (err instanceof Anthropic.AuthenticationError) {
      console.error('[ai/respond] Anthropic auth error — check ANTHROPIC_API_KEY')
      return FAIL('AI service misconfigured. Contact the site administrator.', 'anthropic_error')
    }
    console.error('[ai/respond] Anthropic error:', err instanceof Error ? err.message : String(err))
    captureApiError(err, { route: 'ai/respond', error_type: 'anthropic_error', business_id: businessId })
    return FAIL('Failed to generate a response. Please try again.', 'anthropic_error')
  }

  // Strip lead annotation
  const { clean: reply, lead: leadData } = parseLeadAnnotation(rawReply)
  const outputChars = reply.length

  // Cal.com booking if slot confirmed
  let calcomBookingUid: string | null = null
  if (leadData?.selected_time && leadData.name && leadData.email) {
    calcomBookingUid = await maybeCreateCalcomBooking(db, businessId, leadData, chatSessionId)
  }

  // Persist assistant reply
  if (chatSessionId) {
    await db.from('chat_messages').insert({
      session_id:  chatSessionId,
      business_id: businessId,
      role:        'assistant',
      content:     reply,
      metadata:    { channel, input_chars: inputChars, output_chars: outputChars },
    })
  }

  // Upsert lead when contact info extracted
  let leadId:      string | null = null
  let leadCreated: boolean       = false

  if (leadData && chatSessionId) {
    const hasContact = leadData.name || leadData.email || leadData.phone
    if (hasContact) {
      const score = scoreLead(leadData)
      const meta  = {
        service_interest: leadData.service,
        preferred_date:   leadData.preferred_date,
        preferred_time:   leadData.preferred_time,
      }

      const { data: existing } = await db
        .from('leads').select('id').eq('session_id', chatSessionId).limit(1).single()

      if (existing) {
        const updates: Record<string, unknown> = { score, metadata: meta }
        if (leadData.name)   updates.name   = leadData.name
        if (leadData.email)  updates.email  = leadData.email
        if (leadData.phone)  updates.phone  = leadData.phone
        if (leadData.intent) updates.intent = leadData.intent
        await db.from('leads').update(updates).eq('id', (existing as DbRow).id)
        leadId = (existing as DbRow).id as string

      } else {
        const { data: newLead, error: leadErr } = await db
          .from('leads')
          .insert({
            business_id: businessId,
            session_id:  chatSessionId,
            name:        leadData.name,
            email:       leadData.email,
            phone:       leadData.phone ?? (channel === 'whatsapp' ? externalRef : null),
            intent:      leadData.intent,
            source:      channel === 'whatsapp' ? 'whatsapp' : 'widget',
            status:      'new',
            score,
            metadata:    meta,
          })
          .select('id')
          .single()

        if (leadErr) {
          console.error('[ai/respond] Lead insert error:', leadErr.message)
        } else {
          leadId = ((newLead as DbRow | null)?.id as string | undefined) ?? null
          leadCreated = !!leadId

          if (leadId) {
            await db.from('chat_sessions').update({ lead_id: leadId }).eq('id', chatSessionId)

            // Fire-and-forget owner notification
            const { data: biz } = await db
              .from('businesses')
              .select('name, owner_notification_email')
              .eq('id', businessId)
              .single()

            if (biz) {
              const b       = biz as { name: string; owner_notification_email: string | null }
              const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? 'https://helios.ai'
              const source  = channel === 'whatsapp' ? 'WhatsApp' : 'widget'
              sendLeadNotification(db, {
                businessId:    businessId,
                businessName:  b.name,
                ownerEmail:    b.owner_notification_email,
                customerName:  leadData.name ?? null,
                customerEmail: leadData.email ?? null,
                customerPhone: leadData.phone ?? (channel === 'whatsapp' ? (externalRef ?? null) : null),
                service:       leadData.service ?? null,
                intent:        leadData.intent ?? null,
                source,
                leadId,
                dashboardUrl:  appUrl,
              }).catch((e) => console.error('[ai/respond] lead notification:', e))
            }
          }
        }
      }
    }
  }

  // Track usage (fire-and-forget)
  trackUsage(db, businessId, 'ai_conversation', { session_id: chatSessionId, channel }).catch(() => undefined)

  return { ok: true, reply, sessionId: chatSessionId, leadId, leadCreated, calcomBookingUid }
}
