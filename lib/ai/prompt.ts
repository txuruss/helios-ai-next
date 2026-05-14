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
  business: Business
  services: Service[]
  faqs: FAQ[]
  agentSettings: AgentSettings | null
  widgetSettings: WidgetSettings | null
}

export function buildSystemPrompt({
  business,
  services,
  faqs,
  agentSettings,
  widgetSettings,
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

  // Role and guidelines
  lines.push('', '## Your Role')
  lines.push(`You help customers by:
- Answering questions about ${business.name}'s services, pricing, and hours
- Helping customers book appointments
- Collecting their contact information when they want to book or follow up

When a customer wants to book or be contacted, collect: ${collectFields || 'their name and contact details'}.
Then let them know the team will confirm their appointment or follow up shortly.

## Response Guidelines
- Keep responses concise — 2 to 4 sentences maximum
- Be warm, professional, and helpful
- Only state information that is explicitly listed above
- Do not invent prices, availability, or policies not stated above
- If asked something you do not know, say so and offer to have the team follow up
- Do not create bookings in external systems (Cal.com, etc.)`)

  // Lead extraction annotation (stripped server-side before sending to client)
  lines.push('', '## Lead Data Extraction')
  lines.push(`At the end of EVERY response, on its own line, output exactly:
[LEAD:{}]
Replace {} with a JSON object using these exact keys (null for any unknown value):
{"name":null,"email":null,"phone":null,"service":null,"intent":null,"preferred_date":null,"preferred_time":null}

Example:
[LEAD:{"name":"Jane Smith","email":"jane@example.com","phone":null,"service":"Signature Facial","intent":"book appointment","preferred_date":"Saturday","preferred_time":"afternoon"}]

This line is automatically stripped before the response reaches the customer. Always include it.`)

  return lines.join('\n')
}
