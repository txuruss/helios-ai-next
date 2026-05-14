import { NextResponse, type NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { buildSystemPrompt } from '@/lib/ai/prompt'
import type { AgentSettings, Business, FAQ, Service, WidgetSettings } from '@/types'

// ── Request validation ────────────────────────────────────────────

const messageSchema = z.object({
  role:    z.enum(['user', 'assistant']),
  content: z.string().min(1).max(2000).trim(),
})

const chatRequestSchema = z.object({
  business_id: z.string().uuid('Invalid business_id.'),
  messages:    z.array(messageSchema).min(1, 'At least one message required.').max(50, 'Too many messages.'),
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
}

function parseLeadAnnotation(raw: string): { clean: string; lead: LeadData | null } {
  const match = raw.match(LEAD_REGEX)
  if (!match) return { clean: raw.trim(), lead: null }
  const clean = raw.replace(LEAD_REGEX, '').trim()
  try {
    const lead = JSON.parse(match[1]) as LeadData
    return { clean, lead }
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

// ── Main handler ──────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Gate on required server-side env vars
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[chat] ANTHROPIC_API_KEY is not configured')
    return NextResponse.json(
      { error: 'AI service not configured. Contact the site administrator.' },
      { status: 503 },
    )
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[chat] SUPABASE_SERVICE_ROLE_KEY is not configured')
    return NextResponse.json(
      { error: 'Service not configured. Contact the site administrator.' },
      { status: 503 },
    )
  }

  // Parse body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const parsed = chatRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid request.' },
      { status: 400 },
    )
  }

  const { business_id, messages, session_id, visitor_id } = parsed.data

  // Service-role client for all privileged server-side DB ops (never exposed to browser)
  const db = createServiceRoleClient()

  // Load business config in parallel
  const [bizRes, agentRes, widgetRes, servicesRes, faqsRes] = await Promise.all([
    db.from('businesses').select('*').eq('id', business_id).single(),
    db.from('agent_settings').select('*').eq('business_id', business_id).single(),
    db.from('widget_settings').select('*').eq('business_id', business_id).single(),
    db.from('services').select('*').eq('business_id', business_id).eq('is_active', true).order('sort_order'),
    db.from('faqs').select('*').eq('business_id', business_id).eq('is_active', true).order('sort_order'),
  ])

  if (!bizRes.data) {
    console.error('[chat] Business not found:', business_id, bizRes.error?.message)
    return NextResponse.json({ error: 'Business not found.' }, { status: 404 })
  }

  const business = bizRes.data as Business
  const agentSettings = agentRes.data as AgentSettings | null
  const widgetSettings = widgetRes.data as WidgetSettings | null
  const services = (servicesRes.data ?? []) as Service[]
  const faqs    = (faqsRes.data    ?? []) as FAQ[]

  if (widgetSettings && !widgetSettings.is_enabled) {
    return NextResponse.json({ error: 'Chat is currently disabled.' }, { status: 403 })
  }

  // Get or create chat session
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
    }
  }

  // Persist incoming user message
  const lastMsg = messages[messages.length - 1]
  if (chatSessionId && lastMsg?.role === 'user') {
    await db.from('chat_messages').insert({
      session_id: chatSessionId,
      business_id,
      role: 'user',
      content: lastMsg.content,
    })
  }

  // Build system prompt (contains all business context — server-side only)
  const systemPrompt = buildSystemPrompt({ business, services, faqs, agentSettings, widgetSettings })

  // Call Anthropic — prompt-cache the system prompt for repeated requests per business
  let rawReply: string

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const response = await anthropic.messages.create({
      model:      'claude-haiku-4-5',
      max_tokens: 512,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' }, // cache per business — re-used across turns
        },
      ],
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    rawReply = textBlock?.type === 'text' ? textBlock.text : ''

    if (!rawReply) {
      console.error('[chat] Empty Anthropic response, stop_reason:', response.stop_reason)
      return NextResponse.json({ error: 'No response generated. Please try again.' }, { status: 500 })
    }

  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      console.error('[chat] Anthropic rate limit')
      return NextResponse.json(
        { error: 'Service temporarily busy. Please try again in a moment.' },
        { status: 429 },
      )
    }
    if (err instanceof Anthropic.AuthenticationError) {
      console.error('[chat] Anthropic auth error — check ANTHROPIC_API_KEY')
      return NextResponse.json(
        { error: 'AI service misconfigured. Contact the site administrator.' },
        { status: 503 },
      )
    }
    console.error('[chat] Anthropic error:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Failed to generate a response. Please try again.' }, { status: 500 })
  }

  // Strip lead annotation from reply and extract data
  const { clean: reply, lead: leadData } = parseLeadAnnotation(rawReply)

  // Persist assistant reply
  if (chatSessionId) {
    await db.from('chat_messages').insert({
      session_id: chatSessionId,
      business_id,
      role: 'assistant',
      content: reply,
    })
  }

  // Upsert lead when we have at least one contact field
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

      // Check for existing lead on this session
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
          // Link lead back to session
          if (leadId) {
            await db.from('chat_sessions').update({ lead_id: leadId }).eq('id', chatSessionId)
          }
        }
      }
    }
  }

  return NextResponse.json({ reply, session_id: chatSessionId, lead_id: leadId })
}
