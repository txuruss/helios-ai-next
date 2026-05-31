// ── Outreach domain constants (pure module — no DB / no 'server-only') ──
//
// Shared by the /admin/outreach client UI AND the server actions (for enum
// validation). Keep this file free of React and server-only imports so both
// sides can import it.

export const OUTREACH_REPLY_STATUSES = [
  'new', 'contacted', 'follow_up_needed', 'replied', 'demo_sent',
  'call_booked', 'proposal_sent', 'won', 'lost', 'nurture', 'archived',
] as const
export type OutreachReplyStatus = (typeof OUTREACH_REPLY_STATUSES)[number]

export const OUTREACH_CONTACT_METHODS = [
  'instagram', 'whatsapp', 'email', 'phone', 'website', 'in_person', 'other',
] as const
export type OutreachContactMethod = (typeof OUTREACH_CONTACT_METHODS)[number]

export function isReplyStatus(v: unknown): v is OutreachReplyStatus {
  return typeof v === 'string' && (OUTREACH_REPLY_STATUSES as readonly string[]).includes(v)
}
export function isContactMethod(v: unknown): v is OutreachContactMethod {
  return typeof v === 'string' && (OUTREACH_CONTACT_METHODS as readonly string[]).includes(v)
}

// Status pill config — label + accent color (matches admin palette).
export const STATUS_CONFIG: Record<OutreachReplyStatus, { label: string; color: string }> = {
  new:              { label: 'New',              color: '#6a6a6e' },
  contacted:        { label: 'Contacted',        color: '#3b9eff' },
  follow_up_needed: { label: 'Follow-up needed', color: '#ffae3c' },
  replied:          { label: 'Replied',          color: '#a07cff' },
  demo_sent:        { label: 'Demo sent',        color: '#3b9eff' },
  call_booked:      { label: 'Call booked',      color: '#22d093' },
  proposal_sent:    { label: 'Proposal sent',    color: '#ffae3c' },
  won:              { label: 'Won',              color: '#22d093' },
  lost:             { label: 'Lost',             color: '#ff8a7a' },
  nurture:          { label: 'Nurture',          color: '#9a9a9d' },
  archived:         { label: 'Archived',         color: '#6a6a6e' },
}

export const CONTACT_METHOD_LABELS: Record<OutreachContactMethod, string> = {
  instagram: 'Instagram', whatsapp: 'WhatsApp', email: 'Email', phone: 'Phone',
  website: 'Website', in_person: 'In person', other: 'Other',
}

export const TODAYS_OUTREACH_TARGET = 10

// Statuses that count as "engaged" (the prospect responded in some way).
export const REPLIED_STATUSES: OutreachReplyStatus[] =
  ['replied', 'demo_sent', 'call_booked', 'proposal_sent', 'won']

// Terminal / inactive statuses (excluded from "active" rollups).
export const INACTIVE_STATUSES: OutreachReplyStatus[] = ['won', 'lost', 'archived', 'nurture']

// ── Lead scoring checklist (0–10) ──────────────────────────────────
export const SCORING_ITEMS: string[] = [
  'They take appointments',
  'They rely on DMs, WhatsApp, calls, forms, or website inquiries',
  'Booking flow is manual, weak, or unclear',
  'They are active online',
  'They likely miss messages while busy',
  'They look established enough to pay',
  'Owner or manager seems reachable',
  'Problem feels current',
  'Good fit for website chat or WhatsApp automation',
  'Visible demand through reviews, comments, posts, or traffic',
]

export function scoreBand(score: number): { label: string; color: string } {
  if (score >= 9) return { label: 'Strong lead',   color: '#22d093' }
  if (score >= 7) return { label: 'Good lead',     color: '#3b9eff' }
  if (score >= 5) return { label: 'Possible lead', color: '#ffae3c' }
  return { label: 'Weak lead', color: '#ff8a7a' }
}

// ── DM scripts (copyable) ──────────────────────────────────────────
export interface OutreachScript { id: string; label: string; text: string }

export const OUTREACH_SCRIPTS: OutreachScript[] = [
  {
    id: 'barbershop',
    label: 'Barbershop',
    text:
`Hey [Name], quick question. Do booking DMs ever pile up while you're cutting?

I help barbershops set up an AI booking assistant that answers prices, hours, and booking questions automatically, then sends people the booking link.

Want me to send a quick demo?`,
  },
  {
    id: 'salon',
    label: 'Salon',
    text:
`Hey [Name], when the salon gets busy, do booking messages ever sit for a while?

I help salons set up an AI assistant that replies instantly, answers price and availability questions, and helps clients book.

Want me to show you a quick example?`,
  },
  {
    id: 'spa',
    label: 'Spa',
    text:
`Hey [Name], do treatment or package questions ever come in after hours?

I help spas set up an AI assistant that answers common questions, captures client details, and sends the booking link automatically.

Would a quick demo be useful?`,
  },
]

// ── Follow-up sequence ─────────────────────────────────────────────
export interface FollowUpStep { day: string; text: string }

export const FOLLOWUP_SEQUENCE: FollowUpStep[] = [
  { day: 'Day 1',      text: 'First DM' },
  { day: 'Day 2 or 3', text: 'No worries if you’re busy. Want me to just send the demo so you can look when you get a sec?' },
  { day: 'Day 5',      text: 'I can also send a quick audit showing where bookings might be slipping. Want that instead?' },
  { day: 'Day 7',      text: 'Quick one. Do messages ever pile up during busy hours, or do you already have that handled?' },
  { day: 'Day 10',     text: 'All good, I’ll leave it here. If you ever want the booking assistant demo, just say the word.' },
]

// ── Reply handling templates ───────────────────────────────────────
export interface ReplyTemplate { trigger: string; text: string }

export const REPLY_TEMPLATES: ReplyTemplate[] = [
  {
    trigger: 'If they say “Send info”',
    text:
`Sure — here’s the short version. I set up an AI assistant on your website + WhatsApp that answers price/hours/booking questions instantly and sends people the booking link, so you stop losing customers while you’re busy. Want me to send a quick demo so you can see it in action?`,
  },
  {
    trigger: 'If they say “How much?”',
    text:
`It depends how much you want it to handle. Most local businesses start on Starter — $997 setup, then $149/month — which covers website chat, FAQs, and lead capture. If you want WhatsApp + a full booking flow, that’s Booking OS ($2,500 setup, $399/month). Happy to point you to the right one after a quick demo — want me to send it?`,
  },
  {
    trigger: 'If they say “I’m interested”',
    text:
`Awesome. Easiest next step is a quick 15-minute call so I can show you exactly how it’d work for your business and answer pricing. What day/time works this week? I can also send a short demo first if you’d prefer.`,
  },
  {
    trigger: 'If they say “Not now”',
    text:
`Totally fair — no pressure at all. I’ll send over a quick demo so it’s in your pocket for whenever things slow down. If it’s ever useful, just reply here and we’ll pick it back up.`,
  },
  {
    trigger: 'If they say “We already have a booking system”',
    text:
`Nice — most of what I do actually sits on top of that. The booking tool takes the appointment, but the AI handles the messages before that: price/hours questions, DMs, and after-hours inquiries that usually get missed, then it hands people to your booking link. Want a quick demo so you can see the difference?`,
  },
]

// First-client guidance shown in the reply panel.
export const PRICING_GUIDANCE =
  'Pricing — Starter: $997 setup, $149/mo · Booking OS: $2,500 setup, $399/mo · Ops Center: $5,000 setup, $999/mo. ' +
  'For your first client, prioritize Starter or a light Booking OS — not Ops Center.'

// ── Daily plan + end-of-day checklists ─────────────────────────────
export const DAILY_PLAN: string[] = [
  'Find 10 businesses',
  'Score 10 businesses',
  'Contact 10 businesses',
  'Track every lead',
  'Set follow-up dates',
  'Book discovery calls from interested replies',
]

export const END_OF_DAY_CHECKLIST: string[] = [
  'Found 10 businesses',
  'Scored all 10 leads',
  'Sent 10 first DMs',
  'Logged every lead',
  'Marked each lead status',
  'Set follow-up dates',
  'Identified top 3 hottest leads',
  'Replied to interested leads',
  'Tried to book a call',
  'Wrote down what message got the best response',
]
