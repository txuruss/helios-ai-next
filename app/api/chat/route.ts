import { NextResponse, type NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { buildSystemPrompt } from '@/lib/ai/prompt'
import { sendLeadNotification } from '@/lib/notifications/owner'
import { checkLimit, trackUsage } from '@/lib/billing/limits'
import { getAvailability, createBooking } from '@/lib/calcom/client'
import { isOriginAllowed, getCorsHeaders, type CorsHeaders } from '@/lib/cors'
import { checkChatRateLimit } from '@/lib/rate-limit/chat'
import { logApiEvent, hashIp, type ApiLogEvent } from '@/lib/logging/api'
import type { AgentSettings, Business, FAQ, Service, WidgetSettings } from '@/types'

// ── Constants ─────────────────────────────────────────────────────

const MAX_BODY_BYTES = 32 * 1024 // 32 KB hard limit before JSON parse
const CHAT_MODEL     = 'claude-haiku-4-5'

// ── Request validation ────────────────────────────────────────────

const messageSchema = z.object({
  role:    z.enum(['user', 'assistant']),
  // trim first so whitespace-only strings fail min(1)
  content: z.string().trim().min(1, 'Message content cannot be empty.').max(2000, 'Message too long.'),
})

const chatRequestSchema = z.object({
  business_id: z.string().uuid('Invalid business_id.'),
  messages:    z
    .array(messageSchema)
    .min(1, 'At least one message is required.')
    .max(50, 'Too many messages in history.'),
  session_id:  z.string().uuid().optional(),
  visitor_id:  z.string().max(100).optional(),
})

// ── Lead extraction ───────────────────────────────────────────────

const LEAD_REGEX = /\[LEAD:(\{[^[\]]*\})\]\s*$/

interface LeadData {
  name:           string | null
  email:          string | null
  phone:          string | null
  service:        string | null
  intent:         string | null
  preferred_date: string | null
  preferred_time: string | null
  selected_time:  string | null   // ISO 8601 when user confirms a Cal.com slot
}

function parseLeadAnnotation(raw: string): { clean: string; lead: LeadData | null } {
  const match = raw.match(LEAD_REGEX)
  if (!match) return { clean: raw.trim(), lead: null }
  const clean = raw.replace(LEAD_REGEX, '').trim()
  try {
    return { clean, lead: JSON.parse(match[1]) as LeadData }
  } catch {
    return { clean, lead: null }
  }
}

function scoreLead(lead: LeadData): number {
  let score = 0
  if (lead.name)           score += 20
  if (lead.email)          score += 30
  if (lead.phone)          score += 20
  if (lead.service)        score += 15
  if (lead.intent)         score += 10
  if (lead.preferred_date || lead.preferred_time) score += 5
  return Math.min(score, 100)
}

// ── Cal.com: real availability context for system prompt ──────────
// Scans recent user messages for service name mentions, fetches real
// availability from Cal.com, and returns a context string to inject
// into the system prompt.  Never invents times — only real slots.

type DbRow = Record<string, unknown>

async function getCalcomAvailabilityContext(
  db:         ReturnType<typeof createServiceRoleClient>,
  businessId: string,
  messages:   Array<{ role: string; content: string }>,
): Promise<string> {
  if (!process.env.CALCOM_API_KEY) return ''

  try {
    // Fetch services with mappings for this business
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

    // Scan last 5 user messages for a service name
    const recentText = messages
      .filter((m) => m.role === 'user')
      .slice(-5)
      .map((m) => m.content.toLowerCase())
      .join(' ')

    const matched = (mappings as DbRow[]).find((m) => {
      const svc = m.services as DbRow | null
      const name = typeof svc?.name === 'string' ? svc.name.toLowerCase() : ''
      return name && recentText.includes(name)
    })
    if (!matched) return ''

    const et  = matched.calcom_event_types as DbRow | null
    const svc = matched.services            as DbRow | null
    if (!et?.calcom_id || typeof et.calcom_id !== 'number') return ''

    // Fetch next 7 days of availability
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
    console.error('[chat] getCalcomAvailabilityContext error:', err instanceof Error ? err.message : err)
    return ''
  }
}

// ── Cal.com: create booking when lead confirms a selected_time ────

async function maybeCreateCalcomBooking(
  db:         ReturnType<typeof createServiceRoleClient>,
  businessId: string,
  lead:       LeadData,
  sessionId:  string | null,
): Promise<string | null> {
  if (!lead.selected_time || !lead.name || !lead.email || !lead.service) return null
  if (!process.env.CALCOM_API_KEY) return null

  // Validate selected_time is a real ISO datetime
  if (isNaN(Date.parse(lead.selected_time))) return null

  try {
    // Find service by name (case-insensitive)
    const { data: services } = await db
      .from('services')
      .select('id, name')
      .eq('business_id', businessId)
      .eq('is_active', true)

    const svc = (services ?? []).find(
      (s: DbRow) => typeof s.name === 'string' &&
        s.name.toLowerCase() === lead.service!.toLowerCase()
    ) as DbRow | undefined

    if (!svc?.id) return null

    // Find mapping
    const { data: mapping } = await db
      .from('service_event_mappings')
      .select('calcom_event_type_id')
      .eq('service_id', String(svc.id))
      .eq('business_id', businessId)
      .single()

    if (!mapping?.calcom_event_type_id) return null

    // Get Cal.com integer ID
    const { data: eventType } = await db
      .from('calcom_event_types')
      .select('calcom_id, duration_min')
      .eq('id', mapping.calcom_event_type_id)
      .single()

    if (!(eventType as DbRow | null)?.calcom_id) return null
    const etRow = eventType as DbRow

    const calResult = await createBooking({
      eventTypeId: etRow.calcom_id as number,
      start:       lead.selected_time,
      attendee:    { name: lead.name, email: lead.email },
      notes:       lead.intent ?? undefined,
    })

    if (!calResult.ok) {
      console.error('[chat] maybeCreateCalcomBooking:', calResult.error)
      return null
    }

    const cal = calResult.data

    // Find lead_id from session if available
    let leadId: string | null = null
    if (sessionId) {
      const { data: sess } = await db
        .from('chat_sessions')
        .select('lead_id')
        .eq('id', sessionId)
        .single()
      leadId = (sess as DbRow | null)?.lead_id as string | null ?? null
    }

    // Save to Supabase bookings
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
    console.error('[chat] maybeCreateCalcomBooking error:', err instanceof Error ? err.message : err)
    return null
  }
}

// ── Response helper ───────────────────────────────────────────────

function respond(
  body: object,
  status: number,
  cors: CorsHeaders = {},
): NextResponse {
  const res = NextResponse.json(body, { status })
  for (const [k, v] of Object.entries(cors)) res.headers.set(k, v)
  return res
}

// ── IP extraction ─────────────────────────────────────────────────

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1'
  )
}

// ── OPTIONS (preflight) ───────────────────────────────────────────

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin')
  if (!isOriginAllowed(origin)) {
    return new NextResponse(null, { status: 403 })
  }
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(origin) })
}

// ── POST ──────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const t0     = Date.now()
  const origin = request.headers.get('origin')
  const ip     = getClientIp(request)
  const ipHash = hashIp(ip)
  const cors   = getCorsHeaders(origin)
  const originOk = isOriginAllowed(origin)

  // Partial log state — filled as we progress
  const log: Partial<ApiLogEvent> & Pick<ApiLogEvent, 'route' | 'ip_hash' | 'origin' | 'origin_allowed'> = {
    route:          'chat',
    ip_hash:        ipHash,
    origin,
    origin_allowed: originOk,
    rate_limit:     'skipped',
  }

  function finish(status: number, error?: string) {
    logApiEvent({ ...log, status, error_type: error, ms: Date.now() - t0 } as ApiLogEvent)
  }

  // 1. CORS check
  if (!originOk) {
    // In development with no origin (e.g. curl / server-to-server), allow through.
    // In production, block any origin that isn't ALLOWED_ORIGIN.
    if (process.env.NODE_ENV === 'production') {
      finish(403, 'cors_blocked')
      return respond({ error: 'Origin not allowed.' }, 403)
    }
  }

  // 2. Env-var gates (fail fast before touching DB or Redis)
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[chat] ANTHROPIC_API_KEY not configured')
    finish(503, 'missing_anthropic_key')
    return respond({ error: 'AI service not configured. Contact the site administrator.' }, 503, cors)
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[chat] SUPABASE_SERVICE_ROLE_KEY not configured')
    finish(503, 'missing_service_key')
    return respond({ error: 'Service not configured. Contact the site administrator.' }, 503, cors)
  }

  // 3. Body size check (before JSON.parse)
  let rawBody: string
  try {
    rawBody = await request.text()
  } catch {
    finish(400, 'body_read_error')
    return respond({ error: 'Could not read request body.' }, 400, cors)
  }

  const bodyBytes = Buffer.byteLength(rawBody, 'utf8')
  log.body_size_bytes = bodyBytes

  if (bodyBytes > MAX_BODY_BYTES) {
    finish(413, 'body_too_large')
    return respond({ error: 'Request is too large.' }, 413, cors)
  }

  // 4. JSON parse
  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    finish(400, 'invalid_json')
    return respond({ error: 'Invalid JSON body.' }, 400, cors)
  }

  // 5. Schema validation
  const parsed = chatRequestSchema.safeParse(body)
  if (!parsed.success) {
    const msg = parsed.error.errors[0]?.message ?? 'Invalid request.'
    finish(400, 'validation_failed')
    return respond({ error: msg }, 400, cors)
  }

  const { business_id, messages, session_id, visitor_id } = parsed.data
  log.business_id = business_id
  if (session_id) log.session_id = session_id

  // 6. Rate limiting (IP → business → session)
  let rlResult: Awaited<ReturnType<typeof checkChatRateLimit>>
  try {
    rlResult = await checkChatRateLimit({ ip, businessId: business_id, sessionId: session_id })
  } catch (err) {
    // Redis failure is non-fatal — log and proceed
    console.error('[chat] Rate limit check failed:', err instanceof Error ? err.message : err)
    rlResult = { allowed: true, limit: 0, remaining: 0, reset: 0 }
  }

  if (!rlResult.allowed) {
    log.rate_limit = `blocked_${rlResult.reason}` as ApiLogEvent['rate_limit']
    finish(429, 'rate_limited')
    const res = respond({ error: 'Too many requests. Please wait and try again.' }, 429, cors)
    res.headers.set('Retry-After', String(Math.ceil((rlResult.reset - Date.now()) / 1000)))
    return res
  }
  log.rate_limit = rlResult.limit > 0 ? 'allowed' : 'skipped'

  // 7. Load business config (service-role — never exposed to browser)
  const db = createServiceRoleClient()

  const [bizRes, agentRes, widgetRes, servicesRes, faqsRes] = await Promise.all([
    db.from('businesses').select('*').eq('id', business_id).single(),
    db.from('agent_settings').select('*').eq('business_id', business_id).single(),
    db.from('widget_settings').select('*').eq('business_id', business_id).single(),
    db.from('services').select('*').eq('business_id', business_id).eq('is_active', true).order('sort_order'),
    db.from('faqs').select('*').eq('business_id', business_id).eq('is_active', true).order('sort_order'),
  ])

  if (!bizRes.data) {
    finish(404, 'business_not_found')
    return respond({ error: 'Business not found.' }, 404, cors)
  }

  const business      = bizRes.data    as Business
  const agentSettings = agentRes.data  as AgentSettings | null
  const widgetSettings = widgetRes.data as WidgetSettings | null
  const services      = (servicesRes.data ?? []) as Service[]
  const faqs          = (faqsRes.data    ?? []) as FAQ[]

  if (widgetSettings && !widgetSettings.is_enabled) {
    finish(403, 'widget_disabled')
    return respond({ error: 'Chat is currently disabled.' }, 403, cors)
  }

  // 8. Get or create chat session
  let chatSessionId = session_id ?? null

  if (!chatSessionId) {
    const { data: newSession, error: sessErr } = await db
      .from('chat_sessions')
      .insert({ business_id, visitor_id: visitor_id ?? null, status: 'active', channel: 'widget' })
      .select('id')
      .single()

    if (sessErr) {
      console.error('[chat] Session create error:', sessErr.message)
    } else {
      chatSessionId = newSession?.id ?? null
      if (chatSessionId) log.session_id = chatSessionId
    }
  }

  // 9. Persist user message
  const lastMsg = messages[messages.length - 1]
  const inputChars = messages.reduce((n, m) => n + m.content.length, 0)
  log.input_chars = inputChars

  if (chatSessionId && lastMsg?.role === 'user') {
    await db.from('chat_messages').insert({
      session_id: chatSessionId,
      business_id,
      role:     'user',
      content:  lastMsg.content,
      metadata: {
        estimated_input_chars: inputChars,
        model:                 CHAT_MODEL,
        rate_limit_checked:    rlResult.limit > 0,
        origin_allowed:        originOk,
      },
    })
  }

  // 9b. Plan limit check — before calling Anthropic to avoid unnecessary API cost
  const rlCheck = await checkLimit(db, business_id, 'ai_conversation')
  if (!rlCheck.allowed) {
    finish(402, 'plan_limit_ai')
    return respond(
      { error: 'Plan limit reached. Please upgrade to continue.' },
      402,
      cors,
    )
  }

  // 10. Fetch real Cal.com availability if a mapped service is mentioned (server-side only)
  const calcomContext = await getCalcomAvailabilityContext(db, business_id, messages)

  // Build system prompt — optionally includes real booking slots (never invented)
  const systemPrompt = buildSystemPrompt({ business, services, faqs, agentSettings, widgetSettings, calcomContext })

  // 11. Call Anthropic with cached system prompt
  let rawReply: string

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const aiResponse = await anthropic.messages.create({
      model:      CHAT_MODEL,
      max_tokens: 512,
      system: [
        {
          type:          'text',
          text:          systemPrompt,
          cache_control: { type: 'ephemeral' }, // cache per business across turns
        },
      ],
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    })

    const textBlock = aiResponse.content.find((b) => b.type === 'text')
    rawReply = textBlock?.type === 'text' ? textBlock.text : ''

    if (!rawReply) {
      console.error('[chat] Empty Anthropic response, stop_reason:', aiResponse.stop_reason)
      finish(500, 'empty_ai_response')
      return respond({ error: 'No response generated. Please try again.' }, 500, cors)
    }

  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      console.error('[chat] Anthropic rate limit hit')
      finish(429, 'anthropic_rate_limit')
      return respond({ error: 'Service temporarily busy. Please try again in a moment.' }, 429, cors)
    }
    if (err instanceof Anthropic.AuthenticationError) {
      console.error('[chat] Anthropic auth error — check ANTHROPIC_API_KEY')
      finish(503, 'anthropic_auth_error')
      return respond({ error: 'AI service misconfigured. Contact the site administrator.' }, 503, cors)
    }
    console.error('[chat] Anthropic error:', err instanceof Error ? err.message : String(err))
    finish(500, 'anthropic_error')
    return respond({ error: 'Failed to generate a response. Please try again.' }, 500, cors)
  }

  // 12. Strip lead annotation and extract structured data
  const { clean: reply, lead: leadData } = parseLeadAnnotation(rawReply)
  const outputChars = reply.length
  log.output_chars = outputChars

  // 13. If the customer confirmed a specific Cal.com slot, create the booking
  let calcomBookingUid: string | null = null
  if (leadData?.selected_time && leadData.name && leadData.email) {
    calcomBookingUid = await maybeCreateCalcomBooking(db, business_id, leadData, chatSessionId)
    if (calcomBookingUid) {
      console.log('[chat] Cal.com booking created:', calcomBookingUid)
    }
  }

  // 14. Persist assistant reply with usage metadata
  if (chatSessionId) {
    await db.from('chat_messages').insert({
      session_id: chatSessionId,
      business_id,
      role:     'assistant',
      content:  reply,
      metadata: {
        estimated_input_chars:  inputChars,
        estimated_output_chars: outputChars,
        model:                  CHAT_MODEL,
        rate_limit_checked:     rlResult.limit > 0,
        origin_allowed:         originOk,
      },
    })
  }

  // 14. Upsert lead when at least one contact field was extracted
  let leadId: string | null = null

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
        .from('leads')
        .select('id')
        .eq('session_id', chatSessionId)
        .limit(1)
        .single()

      if (existing) {
        const updates: Record<string, unknown> = { score, metadata: meta }
        if (leadData.name)   updates.name   = leadData.name
        if (leadData.email)  updates.email  = leadData.email
        if (leadData.phone)  updates.phone  = leadData.phone
        if (leadData.intent) updates.intent = leadData.intent
        await db.from('leads').update(updates).eq('id', existing.id)
        leadId = existing.id

      } else {
        const { data: newLead, error: leadErr } = await db
          .from('leads')
          .insert({
            business_id,
            session_id:  chatSessionId,
            name:        leadData.name,
            email:       leadData.email,
            phone:       leadData.phone,
            intent:      leadData.intent,
            source:      'widget',
            status:      'new',
            score,
            metadata:    meta,
          })
          .select('id')
          .single()

        if (leadErr) {
          console.error('[chat] Lead insert error:', leadErr.message)
        } else {
          leadId = newLead?.id ?? null
          if (leadId) {
            await db.from('chat_sessions').update({ lead_id: leadId }).eq('id', chatSessionId)

            // Fire-and-forget owner notification — never blocks the chat response
            const { data: biz } = await db
              .from('businesses')
              .select('name, owner_notification_email')
              .eq('id', business_id)
              .single()
            if (biz) {
              const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://helios.ai'
              sendLeadNotification(db, {
                businessId:    business_id,
                businessName:  (biz as { name: string; owner_notification_email: string | null }).name,
                ownerEmail:    (biz as { name: string; owner_notification_email: string | null }).owner_notification_email,
                customerName:  leadData?.name ?? null,
                customerEmail: leadData?.email ?? null,
                customerPhone: leadData?.phone ?? null,
                service:       leadData?.service ?? null,
                intent:        leadData?.intent ?? null,
                source:        'widget',
                leadId,
                dashboardUrl:  appUrl,
              }).catch((e) => console.error('[chat] lead notification:', e))
            }
          }
        }
      }
    }
  }

  // Track AI conversation usage (fire-and-forget — never blocks response)
  trackUsage(db, business_id, 'ai_conversation', { session_id: chatSessionId }).catch(() => undefined)

  finish(200)
  return respond(
    { reply, session_id: chatSessionId, lead_id: leadId, calcom_booking_uid: calcomBookingUid },
    200,
    cors,
  )
}
