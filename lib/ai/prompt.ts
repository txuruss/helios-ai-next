import type { AgentSettings, Business, FAQ, Service, WidgetSettings } from '@/types'

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const DAY_NAMES: Record<string, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday',
  thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
}

function formatHours(hours: Business['hours']): string {
  if (!hours || Object.keys(hours).length === 0) return 'Not specified'
  return DAYS
    .map((day) => {
      const h = hours[day]
      if (!h) return null
      if (h.closed) return `${DAY_NAMES[day]}: Closed`
      return `${DAY_NAMES[day]}: ${h.open} – ${h.close}`
    })
    .filter(Boolean)
    .join('\n')
}

function formatPrice(cents: number | null): string {
  if (!cents) return ''
  return ` ($${(cents / 100).toFixed(2)})`
}

interface PromptParams {
  business:       Business
  services:       Service[]
  faqs:           FAQ[]
  agentSettings:  AgentSettings | null
  widgetSettings: WidgetSettings | null
  // Real Cal.com availability context — injected by chat route when available.
  // NEVER invented — only set from actual Cal.com API response.
  calcomContext?: string
}

export function buildSystemPrompt({
  business,
  services,
  faqs,
  agentSettings,
  widgetSettings,
  calcomContext,
}: PromptParams): string {
  const botName = agentSettings?.agent_name ?? widgetSettings?.bot_name ?? 'AI Assistant'
  const persona = agentSettings?.persona_prompt ?? ''

  const activeServices = services.filter((s) => s.is_active)
  const activeFaqs = faqs.filter((f) => f.is_active)

  const collectName  = agentSettings?.collect_name  ?? true
  const collectEmail = agentSettings?.collect_email ?? true
  const collectPhone = agentSettings?.collect_phone ?? false

  const collectFields = [
    collectName  && 'full name',
    collectEmail && 'email address',
    collectPhone && 'phone number',
  ].filter(Boolean).join(', ')

  const lines: string[] = []

  lines.push(`You are ${botName}, the AI assistant for ${business.name}.`)

  if (persona) {
    lines.push('', persona)
  }

  // Business info
  lines.push('', '## Business Information')
  lines.push(`Name: ${business.name}`)
  if (business.business_type) lines.push(`Type: ${business.business_type}`)
  if (business.city) {
    lines.push(`Location: ${business.city}${business.country ? `, ${business.country}` : ''}`)
  }
  if (business.phone)       lines.push(`Phone: ${business.phone}`)
  if (business.website_url) lines.push(`Website: ${business.website_url}`)
  if (business.description) lines.push(`About: ${business.description}`)

  // Hours
  if (business.hours && Object.keys(business.hours).length > 0) {
    lines.push('', '## Operating Hours', formatHours(business.hours))
  }

  // Services
  if (activeServices.length > 0) {
    lines.push('', '## Services We Offer')
    for (const s of activeServices) {
      const duration = s.duration_min ? ` — ${s.duration_min} min` : ''
      lines.push(`• ${s.name}${formatPrice(s.price_cents)}${duration}`)
      if (s.description) lines.push(`  ${s.description}`)
    }
  }

  // FAQs
  if (activeFaqs.length > 0) {
    lines.push('', '## Frequently Asked Questions')
    for (const f of activeFaqs) {
      lines.push(`Q: ${f.question}`, `A: ${f.answer}`, '')
    }
  }

  // Cal.com real availability (only present when actual slots were fetched)
  if (calcomContext) {
    lines.push('', calcomContext)
  }

  // Role and guidelines
  const bookingGuideline = calcomContext
    ? `When a customer selects a specific available time from the list above, confirm it with them and set "selected_time" (ISO 8601) in the LEAD annotation. Only use times from the list above — never invent availability.`
    : `When a customer wants to book, collect their details and let them know the team will confirm availability and follow up shortly.`

  lines.push('', '## Your Role')
  lines.push(`You help customers by:
- Answering questions about ${business.name}'s services, pricing, and hours
- Helping customers book appointments
- Collecting their contact information when they want to book or follow up

When a customer wants to book, collect: ${collectFields || 'their name and contact details'}.
${bookingGuideline}

## Response Guidelines
- Keep responses concise — 2 to 4 sentences maximum
- Be warm, professional, and helpful
- Only state information that is explicitly listed above
- NEVER invent prices, availability, or appointment times
- If asked something you do not know, say so and offer to have the team follow up
- ${calcomContext ? 'Only offer the exact times listed in the Real Available Slots section above.' : 'Do not commit to specific times — the team will confirm availability.'}`)


  // Lead extraction annotation — stripped server-side before sending to client
  lines.push('', '## Lead Data Extraction')
  lines.push(`At the end of EVERY response, on its own line, output exactly:
[LEAD:{}]
Replace {} with a JSON object using these exact keys (null for any unknown value):
{"name":null,"email":null,"phone":null,"service":null,"intent":null,"preferred_date":null,"preferred_time":null,"selected_time":null}

- "preferred_date": what the customer said (e.g. "Saturday", "next week")
- "preferred_time": what the customer said (e.g. "afternoon", "2pm")
- "selected_time": ONLY set this when the customer has confirmed a specific slot from the Available Slots list above (ISO 8601 format, e.g. "2024-01-10T14:00:00.000Z"). Leave null otherwise.

Example:
[LEAD:{"name":"Jane Smith","email":"jane@example.com","phone":null,"service":"Signature Facial","intent":"book appointment","preferred_date":"Saturday","preferred_time":"afternoon","selected_time":"2024-01-13T14:00:00.000Z"}]

This line is automatically stripped before the response reaches the customer. Always include it.`)

  return lines.join('\n')
}
