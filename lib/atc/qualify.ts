// ── Audit-to-Close: deterministic lead qualification ───────────────
// PURE module — no I/O, no AI calls. Qualification must be transparent
// and repeatable, so it is rule-based (same ethos as
// lib/research/leadScoring.ts): every point is a named signal grounded
// in a field we actually hold. Careful language only — no guaranteed
// revenue, no invented facts.

import type { AtcLead, AtcAudit, AtcPainPoint, AtcQualification, AtcPackageId } from './types'
import { PACKAGES } from '@/lib/billing/packages'

// Industry tokens that signal an appointment-led local service business.
const APPOINTMENT_TOKENS = [
  'salon', 'spa', 'barber', 'hair', 'beauty', 'nail', 'massage', 'tattoo',
  'dentist', 'dental', 'clinic', 'doctor', 'medspa', 'med spa', 'aesthetic',
  'physio', 'chiro', 'dermatolog', 'optometr', 'medical', 'health', 'wellness',
  'gym', 'fitness', 'yoga', 'pilates', 'trainer', 'studio',
  'lawyer', 'attorney', 'accountant', 'consultant', 'real estate', 'agency',
  'plumb', 'electric', 'hvac', 'contractor', 'roof', 'cleaning', 'detailing',
  'vet', 'pet', 'photograph', 'mechanic', 'repair', 'tutor', 'driving',
]

function weakScore(v: number | null): boolean { return v !== null && v <= 4 }
function clamp(n: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, n)) }

// Count distinct services listed in the freeform services field.
function serviceCount(services: string | null): number {
  if (!services) return 0
  return services.split(/[,\n;•·]+/).map((s) => s.trim()).filter((s) => s.length > 1).length
}

export interface QualifyInput {
  lead:       AtcLead
  audit:      AtcAudit
  painPoints: AtcPainPoint[]
}

export function qualifyLeadRules({ lead, audit, painPoints }: QualifyInput): AtcQualification {
  const signals: AtcQualification['signals'] = []
  const add = (signal: string, points: number, note: string) => {
    signals.push({ signal, points, note })
  }

  const industry   = (lead.industry ?? '').toLowerCase()
  const services   = serviceCount(lead.services)
  const reviews    = lead.review_count ?? 0
  const rating     = lead.rating
  const hasSite    = !!lead.website_url
  const hasSocial  = !!lead.instagram_url || !!lead.facebook_url
  const appointment = APPOINTMENT_TOKENS.some((t) => industry.includes(t))
  const highPain   = painPoints.some((p) => p.severity === 'high' || p.severity === 'critical')

  // 1. Appointment-based business — Helios AI's core fit.
  if (appointment) add('Appointment-based business', 15, `"${lead.industry}" is an appointment-led service business.`)
  else add('Appointment-based business', 0, 'Industry does not clearly indicate an appointment-led business — verify on a call.')

  // 2. Clear customer demand.
  if (reviews >= 100)     add('Customer demand', 15, `${reviews} reviews indicate clear, active demand.`)
  else if (reviews >= 40) add('Customer demand', 11, `${reviews} reviews suggest steady demand.`)
  else if (reviews >= 10) add('Customer demand', 6,  `${reviews} reviews — some demand, verify volume on a call.`)
  else                    add('Customer demand', 0,  'Few or no reviews found — demand should be verified.')
  if (rating !== null && rating >= 4.3 && reviews >= 10) add('Reputation', 3, `${rating}★ rating supports demand quality.`)

  // 3. Website or social presence.
  if (hasSite && hasSocial) add('Online presence', 8, 'Has both a website and social profiles.')
  else if (hasSite)         add('Online presence', 6, 'Has a website.')
  else if (hasSocial)       add('Online presence', 4, 'Social presence only — no website found.')
  else                      add('Online presence', 0, 'No website or social profile on record.')

  // 4. Weak booking flow (from the audit) — the gap we fix.
  if (weakScore(audit.booking_score)) add('Weak booking flow', 14, `Audit booking score ${audit.booking_score}/10 — booking friction is likely costing appointments.`)
  else add('Weak booking flow', audit.booking_score === null ? 4 : 0,
    audit.booking_score === null ? 'Booking flow not yet assessed.' : `Booking flow scored ${audit.booking_score}/10 — already reasonable.`)

  // 5. Weak lead capture (from the audit).
  if (weakScore(audit.lead_capture_score)) add('Weak lead capture', 12, `Audit lead-capture score ${audit.lead_capture_score}/10 — inquiries may be going unrecorded.`)
  else add('Weak lead capture', audit.lead_capture_score === null ? 3 : 0,
    audit.lead_capture_score === null ? 'Lead capture not yet assessed.' : `Lead capture scored ${audit.lead_capture_score}/10.`)

  // 6. WhatsApp opportunity.
  if (lead.whatsapp_number) add('WhatsApp opportunity', 8, 'Uses WhatsApp — a WhatsApp assistant is directly relevant.')
  else if (lead.phone && weakScore(audit.whatsapp_score)) add('WhatsApp opportunity', 6, 'Phone-reliant with weak WhatsApp visibility — a WhatsApp channel could capture missed messages.')
  else add('WhatsApp opportunity', 0, 'No clear WhatsApp signal.')

  // 7. Service complexity — enough to need routing/automation.
  if (services >= 5)      add('Service complexity', 8, `${services} services listed — routing and intake automation add real value.`)
  else if (services >= 3) add('Service complexity', 6, `${services} services listed.`)
  else                    add('Service complexity', 0, 'Few services listed — a simple setup may be enough.')

  // 8. Can likely afford Helios AI (conservative proxy — verify on a call).
  if (reviews >= 40 && hasSite)      add('Affordability signal', 8, 'Established presence + steady demand suggest budget is realistic (verify on a call).')
  else if (reviews >= 40 || hasSite) add('Affordability signal', 5, 'Some establishment signals — affordability should be verified.')
  else                               add('Affordability signal', 0, 'No affordability signals — do not overpitch.')

  // 9. Clear owner pain.
  if (highPain)                    add('Owner pain', 10, 'High-severity pain points identified from the audit.')
  else if (painPoints.length > 0)  add('Owner pain', 6,  `${painPoints.length} pain point(s) identified.`)
  else if (lead.notes)             add('Owner pain', 3,  'Notes suggest possible pain — generate pain points to confirm.')
  else                             add('Owner pain', 0,  'No documented pain yet.')

  const fit_score = clamp(signals.reduce((s, x) => s + x.points, 0), 0, 100)

  const fit_level: AtcQualification['fit_level'] =
    fit_score >= 80 ? 'strong' :
    fit_score >= 60 ? 'good' :
    fit_score >= 40 ? 'possible' : 'poor'

  // Package recommendation — conservative; never overpitch small businesses.
  let recommended_package: AtcPackageId = 'starter'
  if (fit_score >= 60 && reviews >= 150 && services >= 5) recommended_package = 'scale'
  else if (fit_score >= 50 && (lead.whatsapp_number || reviews >= 40 || weakScore(audit.booking_score))) recommended_package = 'pro'

  // Close difficulty — bigger ticket and weaker pain are harder closes.
  let close_difficulty: AtcQualification['close_difficulty'] = 'medium'
  if (fit_score >= 75 && recommended_package !== 'scale' && highPain) close_difficulty = 'easy'
  else if (fit_score < 50 || recommended_package === 'scale') close_difficulty = 'hard'

  // Composed, careful-language summary grounded ONLY in the signals above.
  const pkg = PACKAGES[recommended_package]
  const strongest = [...signals].sort((a, b) => b.points - a.points)[0]
  const qualification_summary =
    `${lead.business_name} scores ${fit_score}/100 (${fit_level} fit). ` +
    `Strongest signal: ${strongest.signal.toLowerCase()} — ${strongest.note} ` +
    `Recommended starting point: ${pkg.displayName} (${pkg.setupFeeLabel} setup + ${pkg.monthlyFeeLabel}), ` +
    `expected close difficulty: ${close_difficulty}. Key assumptions should be verified on a discovery call.`

  // Objections composed from the gaps (careful language).
  const objections: string[] = []
  if (!hasSite)      objections.push('"We don\'t have a website" — position the assistant on WhatsApp/social first; a simple lead page can come with setup.')
  if (reviews < 10)  objections.push('"We\'re too small for this" — recommend Starter only; do not overpitch.')
  if (!weakScore(audit.booking_score) && audit.booking_score !== null)
    objections.push('"Our booking already works" — focus on after-hours capture and follow-up instead of the booking flow.')
  if (recommended_package === 'scale')
    objections.push(`"${pkg.setupFeeLabel} is a lot" — anchor on the monthly cost of missed inquiries; offer to start with Booking OS if needed.`)
  objections.push('"Is this going to sound robotic?" — offer a live demo on their own business before any commitment.')

  // Best outreach angle = highest-severity documented pain, else strongest signal.
  const topPain = [...painPoints].sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0]
  const best_outreach_angle = topPain?.sales_angle
    ?? topPain?.evidence
    ?? `${strongest.note} Lead with that observation and offer a quick demo.`

  return {
    fit_score, fit_level, recommended_package, close_difficulty,
    qualification_summary, objections, best_outreach_angle, signals,
  }
}

function severityRank(s: string): number {
  return s === 'critical' ? 3 : s === 'high' ? 2 : s === 'medium' ? 1 : 0
}
