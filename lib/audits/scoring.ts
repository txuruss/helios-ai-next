// ── Deployment Score Audit Engine ─────────────────────────────────
// Rule-based scoring for booking readiness, lead capture, and automation.
// No live API calls — reads from existing Supabase data only.

import type { FindingCategory, FindingSeverity } from '@/lib/validation/audits'

export interface AuditInput {
  // Business
  hasOwnerEmail:        boolean
  businessType:         string | null
  // Services & FAQs
  serviceCount:         number
  faqCount:             number
  // Widget
  widgetEnabled:        boolean
  // WhatsApp
  whatsappConnected:    boolean
  // Cal.com
  calcomConnected:      boolean
  // Leads & Bookings
  leadCount:            number
  bookingCount:         number
  // Setup progress
  setupPercent:         number
  // Delivery progress
  deliveryPercent:      number
  // Inbox
  hasHandoffSession:    boolean
  // AI
  hasAiConfidence:      boolean
}

export interface AuditFinding {
  category:       FindingCategory
  severity:       FindingSeverity
  title:          string
  description:    string
  recommendation: string
  relatedPlan:    'starter' | 'pro' | 'scale' | null
  sortOrder:      number
}

export interface AuditScores {
  response:     number
  booking:      number
  leadCapture:  number
  trust:        number
  automation:   number
  overall:      number
}

// ── Score calculation ─────────────────────────────────────────────

export function calculateScores(input: AuditInput): AuditScores {
  // Response Score (25%)
  let response = 0
  if (input.widgetEnabled)       response += 30
  if (input.whatsappConnected)   response += 30
  if (input.hasOwnerEmail)       response += 20
  if (input.hasHandoffSession)   response += 10
  if (input.hasAiConfidence)     response += 10
  response = Math.min(100, response)

  // Booking Score (25%)
  let booking = 0
  if (input.serviceCount > 0)    booking += 30
  if (input.calcomConnected)     booking += 35
  if (input.bookingCount > 0)    booking += 20
  if (input.faqCount > 0)       booking += 15
  booking = Math.min(100, booking)

  // Lead Capture Score (20%)
  let leadCapture = 0
  if (input.widgetEnabled)       leadCapture += 25
  if (input.faqCount > 0)       leadCapture += 25
  if (input.leadCount > 0)      leadCapture += 30
  if (input.serviceCount > 0)   leadCapture += 20
  leadCapture = Math.min(100, leadCapture)

  // Trust Score (15%)
  let trust = 0
  if (input.hasHandoffSession)   trust += 30
  if (input.hasAiConfidence)     trust += 20
  if (input.setupPercent >= 50)  trust += 25
  if (input.hasOwnerEmail)       trust += 15
  if (input.widgetEnabled)       trust += 10
  trust = Math.min(100, trust)

  // Automation Score (15%)
  let automation = 0
  if (input.deliveryPercent >= 50) automation += 40
  if (input.setupPercent >= 70)    automation += 30
  if (input.whatsappConnected)     automation += 20
  if (input.calcomConnected)       automation += 10
  automation = Math.min(100, automation)

  // Weighted overall
  const overall = Math.round(
    response   * 0.25 +
    booking    * 0.25 +
    leadCapture * 0.20 +
    trust      * 0.15 +
    automation * 0.15,
  )

  return { response, booking, leadCapture, trust, automation, overall }
}

// ── Finding generation ────────────────────────────────────────────

export function generateFindings(input: AuditInput): AuditFinding[] {
  const findings: AuditFinding[] = []
  let order = 0

  const add = (
    category: FindingCategory,
    severity: FindingSeverity,
    title: string,
    description: string,
    recommendation: string,
    plan: 'starter' | 'pro' | 'scale' | null = null,
  ) => findings.push({ category, severity, title, description, recommendation, relatedPlan: plan, sortOrder: order++ })

  // Response
  if (!input.widgetEnabled) {
    add('response_speed', 'critical',
      'No instant response channel on website',
      'Customers who visit your website have no way to ask questions or request bookings instantly. They may leave without contacting you.',
      'Install the Helios AI website chat widget. It answers questions and captures leads 24/7, even when you\'re busy.',
      'starter',
    )
  }
  if (!input.whatsappConnected) {
    add('whatsapp', 'high',
      'WhatsApp not connected',
      'Many local service customers prefer WhatsApp for quick questions. Without automation, every message requires manual replies.',
      'Connect WhatsApp Business to Helios AI to automatically reply to messages, capture leads, and route booking requests.',
      'pro',
    )
  }
  if (!input.hasOwnerEmail) {
    add('response_speed', 'medium',
      'Owner notification email not set',
      'When a new lead or booking comes in, no one is notified by email. You may miss time-sensitive requests.',
      'Add your owner notification email in /dashboard/business to receive instant alerts for new leads and bookings.',
      'starter',
    )
  }

  // Booking
  if (input.serviceCount === 0) {
    add('booking_flow', 'critical',
      'No services configured',
      'Without services, the AI cannot answer pricing questions, duration questions, or route booking requests correctly.',
      'Add your services in /dashboard/services. Include names, pricing ranges, and duration for best AI performance.',
      'starter',
    )
  }
  if (!input.calcomConnected) {
    add('booking_flow', 'high',
      'Online booking not connected',
      'Customers cannot book directly through your AI assistant. Booking requests require manual follow-up.',
      'Connect Cal.com in /dashboard/calcom to allow the AI to check real availability and create bookings automatically.',
      'pro',
    )
  }
  if (input.bookingCount === 0 && input.calcomConnected) {
    add('booking_flow', 'medium',
      'No bookings received yet',
      'Cal.com is connected but no bookings have come through the AI system. The flow may need testing.',
      'Test the booking flow by sending a chat message and requesting a booking through the widget.',
      'pro',
    )
  }

  // Lead Capture
  if (input.faqCount === 0) {
    add('lead_capture', 'high',
      'No FAQs configured',
      'The AI cannot answer the most common customer questions. This increases the chance customers leave without engaging.',
      'Add your top 5–10 FAQs in /dashboard/services. Include pricing, hours, policies, and common concerns.',
      'starter',
    )
  }
  if (input.leadCount === 0) {
    add('lead_capture', 'medium',
      'No leads captured yet',
      'No leads have been collected through the AI system. Lead capture is core to measuring booking system performance.',
      'Start a test chat conversation through the widget. The AI should capture your name and contact before booking.',
      'starter',
    )
  }

  // Trust
  if (!input.hasHandoffSession) {
    add('trust', 'medium',
      'Human handoff not tested',
      'The human handoff feature ensures a real person can take over conversations when the AI reaches its limits.',
      'Test handoff by sending "I want to speak to someone" in the inbox. Confirm the AI transitions the conversation.',
      'pro',
    )
  }

  // Automation
  if (input.setupPercent < 50) {
    add('operations', 'high',
      'Setup checklist below 50%',
      'Core setup tasks are not complete. The system may not perform correctly for real customers.',
      'Complete the setup checklist in /dashboard/setup. Prioritize: business profile, services, FAQs, and widget.',
      'starter',
    )
  }
  if (input.deliveryPercent < 40) {
    add('automation', 'medium',
      'Delivery pipeline not started',
      'The delivery pipeline tracks all tasks required to launch. Most tasks are not complete.',
      'Work through the delivery pipeline in /dashboard/delivery to ensure every setup step is verified.',
      'starter',
    )
  }

  // Follow-up (always useful)
  if (input.leadCount > 0 && input.bookingCount === 0) {
    add('follow_up', 'high',
      'Leads captured but no bookings confirmed',
      `You have ${input.leadCount} lead${input.leadCount !== 1 ? 's' : ''} but no confirmed bookings. Leads may not be converting to booked appointments.`,
      'Connect Cal.com and test the full booking flow. Review the inbox for any incomplete conversations.',
      'pro',
    )
  }

  // Good signs (low severity — shows what's working)
  if (input.widgetEnabled && input.leadCount > 0) {
    add('lead_capture', 'low',
      'Website chat is active and capturing leads',
      `The AI assistant has captured ${input.leadCount} lead${input.leadCount !== 1 ? 's' : ''} through the website widget.`,
      'Keep FAQs and services up to date to improve AI reply quality and lead conversion.',
      null,
    )
  }

  return findings.sort((a, b) => {
    const sev = { critical: 0, high: 1, medium: 2, low: 3 }
    return (sev[a.severity] ?? 3) - (sev[b.severity] ?? 3)
  })
}

// ── Revenue risk estimates ─────────────────────────────────────────

export function estimateRevenueRisk(input: AuditInput, businessType: string | null): string {
  if (!input.widgetEnabled && !input.whatsappConnected) {
    return '$500 – $2,000+ per month in missed bookings and unanswered inquiries'
  }
  if (!input.whatsappConnected) {
    return '$200 – $800 per month in missed WhatsApp booking requests'
  }
  if (!input.calcomConnected) {
    return '$150 – $500 per month in manual booking overhead and missed conversions'
  }
  return 'Most gaps addressed — minor optimizations available'
}
