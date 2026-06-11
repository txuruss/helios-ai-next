// ── Rule-based lead scoring for the Business Research Agent ────────
//
// PURE module — no I/O, no 'server-only'. Safe to import (types and
// helpers) from both server routes and client components.
//
// Phase 1 is deliberately rule-based: NO LLM calls. The score reflects
// how well a real Google Places business fits Helios AI (appointment-led
// local service businesses that likely lose leads they can't capture).
//
// SAFETY: we never invent contact details. We only reason over the
// fields Google Places actually returned. Generated openings are clearly
// generic templates the founder edits before sending — nothing is sent.

// A normalized Google Places result (filled by lib/research/googlePlaces).
export interface PlaceResult {
  placeId:        string | null   // Google Place ID — strongest dedupe key
  name:           string
  category:       string | null
  address:        string | null
  phone:          string | null
  website:        string | null
  googleMapsUrl:  string | null
  rating:         number | null
  reviewCount:    number | null
  businessStatus: string | null   // OPERATIONAL | CLOSED_TEMPORARILY | CLOSED_PERMANENTLY
  types:          string[]
}

// A scored lead = the place plus rule-derived intelligence.
export interface ScoredLead extends PlaceResult {
  niche:            string
  leadScore:        number   // 0–100
  problemFound:     string
  outreachAngle:    string
  firstDm:          string
  coldEmailOpening: string
  // Retainer fit (setup fee + monthly retainer model). Rule-based and
  // deliberately conservative — see retainerFitForLead().
  recommendedPackage: 'starter' | 'pro' | 'scale'
  retainerTier:       'light' | 'standard' | 'advanced'
  retainerReason:     string
}

// Leads at or above this score are considered "qualified" (auto-save +
// the "Save all qualified" action).
export const QUALIFIED_SCORE = 60

// Google Places type / category tokens that signal an appointment-led,
// booking-driven local service business (Helios AI's core fit).
const APPOINTMENT_TOKENS = [
  'salon', 'spa', 'barber', 'hair', 'beauty', 'nail', 'massage', 'tattoo',
  'dentist', 'dental', 'doctor', 'clinic', 'physiotherap', 'chiropract',
  'dermatolog', 'optometr', 'medical', 'health', 'wellness', 'aesthetic',
  'gym', 'fitness', 'yoga', 'pilates', 'personal_trainer',
  'lawyer', 'attorney', 'accountant', 'consultant', 'real_estate', 'agency',
  'plumber', 'electrician', 'hvac', 'contractor', 'roofing', 'cleaning',
  'veterinary', 'vet', 'pet', 'photographer', 'mechanic', 'car_repair',
  'driving_school', 'tutor', 'school', 'studio',
]

function hay(place: PlaceResult): string {
  return [place.category ?? '', ...(place.types ?? [])].join(' ').toLowerCase()
}

function isAppointmentBased(place: PlaceResult): boolean {
  const h = hay(place)
  return APPOINTMENT_TOKENS.some((t) => h.includes(t))
}

function isOpen(place: PlaceResult): boolean {
  // Treat unknown status as operational (Places omits it for many results).
  return !place.businessStatus || place.businessStatus === 'OPERATIONAL'
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

export interface ScoreBand { label: string; color: string }

// ── Dedupe helpers (shared by the run + save routes and the data layer) ──

// Bare hostname for a website, lowercased, without leading "www.".
export function websiteDomain(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    return u.hostname.replace(/^www\./, '').toLowerCase() || null
  } catch {
    return null
  }
}

// Stable dedupe key for a business: Google Place ID → website domain →
// phone digits → business name + address. Used to prevent duplicate saved
// leads within a single run.
export function leadDedupKey(p: {
  placeId?: string | null
  website?: string | null
  phone?:   string | null
  name?:    string | null
  address?: string | null
}): string {
  if (p.placeId) return `pid:${p.placeId}`
  const dom = websiteDomain(p.website ?? null)
  if (dom) return `dom:${dom}`
  const tel = (p.phone ?? '').replace(/\D/g, '')
  if (tel.length >= 7) return `tel:${tel}`
  return `na:${(p.name ?? '').trim().toLowerCase()}|${(p.address ?? '').trim().toLowerCase()}`
}

// Visual band for a 0–100 score, using the Mission Control palette.
export function scoreBand(score: number): ScoreBand {
  if (score >= 80) return { label: 'Excellent fit', color: '#22d093' }
  if (score >= QUALIFIED_SCORE) return { label: 'Strong fit', color: '#ffae3c' }
  if (score >= 40) return { label: 'Moderate', color: '#3b9eff' }
  return { label: 'Weak fit', color: '#6a6a6e' }
}

// ── Retainer fit (setup fee + monthly retainer model) ──────────────
//
// Rule-based, deliberately CONSERVATIVE recommendation for which package
// is realistic and how heavy the monthly retainer should be. We never
// overpitch small businesses — a solo provider gets a light retainer
// suggestion, not Ops Center. All wording uses careful language ("may",
// "could", "should be verified") because this is derived from public
// listing data only. Works from saved-lead fields too, so the Saved Leads
// detail view can derive the same answer without a schema change.

export interface RetainerFitInput {
  leadScore:   number | null
  rating:      number | null
  reviewCount: number | null
  website:     string | null
}

export interface RetainerFit {
  goodFit:            boolean
  recommendedPackage: 'starter' | 'pro' | 'scale'
  packageLabel:       string
  retainerTier:       'light' | 'standard' | 'advanced'
  tierLabel:          string
  reason:             string
}

const PACKAGE_LABELS = { starter: 'Starter Lead Response System', pro: 'Booking OS', scale: 'Ops Center' } as const
const TIER_LABELS    = { light: 'Light', standard: 'Standard', advanced: 'Advanced' } as const

export function retainerFitForLead(input: RetainerFitInput): RetainerFit {
  const score   = input.leadScore ?? 0
  const reviews = input.reviewCount ?? 0
  const hasSite = !!input.website

  const make = (
    pkg: RetainerFit['recommendedPackage'],
    tier: RetainerFit['retainerTier'],
    goodFit: boolean,
    reason: string,
  ): RetainerFit => ({
    goodFit,
    recommendedPackage: pkg,
    packageLabel: PACKAGE_LABELS[pkg],
    retainerTier: tier,
    tierLabel: TIER_LABELS[tier],
    reason,
  })

  // Weak overall fit → don't pitch a retainer from listing data alone.
  if (score < 40) {
    return make('starter', 'light', false,
      'Weak fit from listing data alone — whether any ongoing retainer makes sense should be verified on a discovery call before pitching.')
  }

  // High-volume, established business → advanced retainer is realistic.
  if (reviews >= 150 && hasSite) {
    return make('scale', 'advanced', true,
      `High inquiry volume is likely (${reviews} reviews), so changes to services, staff, and availability may be frequent — an advanced retainer keeps responses, FAQs, and follow-ups current across channels.`)
  }

  // Clear active demand → standard retainer on Booking OS.
  if (reviews >= 40) {
    return make('pro', 'standard', true,
      `Active demand (${reviews} reviews) means missed or slow replies could cost bookings — a standard retainer covers monthly optimization, lead-flow review, and reporting.`)
  }

  // Small business → keep it realistic: light retainer, no overpitch.
  return make('starter', 'light', true,
    'Smaller operation — a light retainer (monitoring, one monthly update, and a lead-flow check) is usually enough; recommend upgrades only if inquiry volume grows.')
}

// ── The scorer ─────────────────────────────────────────────────────
// Transparent, additive scoring. Disqualifiers (closed / no contact)
// short-circuit to a low score so they never look "qualified".
export function scoreLead(place: PlaceResult, niche: string): ScoredLead {
  const appointment = isAppointmentBased(place)
  const open        = isOpen(place)
  const rating      = typeof place.rating === 'number' ? place.rating : null
  const reviews     = typeof place.reviewCount === 'number' ? place.reviewCount : 0
  const hasWebsite  = !!place.website
  const hasPhone    = !!place.phone
  const reachable   = hasWebsite || hasPhone

  let score = 40 // neutral baseline

  // ── Score higher ──
  if (appointment) score += 18                       // appointment-based business
  if (!hasWebsite && hasPhone) score += 14           // no site → no online booking, relies on phone
  if (hasWebsite) score += 4                          // a site exists but conversion is usually weak
  if (rating !== null && rating >= 4.5) score += 12   // strong reviews
  else if (rating !== null && rating >= 4.0) score += 8
  if (reviews >= 100) score += 12                     // clear, active demand
  else if (reviews >= 40) score += 8
  else if (reviews >= 10) score += 4
  if (appointment && reviews >= 10) score += 4        // likely misses after-hours leads

  // ── Score lower / disqualify ──
  if (!open) score = Math.min(score, 8)               // closed → not a prospect
  if (!reachable) score = Math.min(score, 15)         // no way to reach them
  if (rating !== null && rating < 3.5 && reviews >= 5) score -= 18 // poor reviews
  if (!appointment) score -= 12                        // not appointment-led

  score = clamp(Math.round(score), 0, 100)

  const { problemFound, outreachAngle } = deriveAngle(place, { appointment, hasWebsite, hasPhone, open })
  const display = place.name
  const fit = retainerFitForLead({
    leadScore: score, rating, reviewCount: reviews, website: place.website,
  })

  return {
    ...place,
    niche,
    leadScore:        score,
    problemFound,
    outreachAngle,
    firstDm:          `Hi ${display} team — quick one: when someone messages or calls outside opening hours, who picks it up? I help local ${niche} businesses answer those enquiries automatically so they can turn into booked appointments.`,
    coldEmailOpening: `Hi ${display} — I looked you up while researching ${niche} businesses in the area. ${outreachAngle}`,
    recommendedPackage: fit.recommendedPackage,
    retainerTier:       fit.retainerTier,
    retainerReason:     fit.reason,
  }
}

// Rule-based problem + angle text. Never fabricates facts — every line is
// grounded in a field Google Places actually returned.
function deriveAngle(
  place: PlaceResult,
  f: { appointment: boolean; hasWebsite: boolean; hasPhone: boolean; open: boolean },
): { problemFound: string; outreachAngle: string } {
  if (!f.open) {
    return {
      problemFound:  'Business appears closed on Google.',
      outreachAngle: 'Listing looks closed — verify before any outreach.',
    }
  }

  const reviews = place.reviewCount ?? 0
  const rating  = place.rating

  if (!f.hasWebsite && f.hasPhone) {
    return {
      problemFound:  'No website found — enquiries appear to depend on phone calls, so after-hours messages and missed calls may be going unanswered (worth verifying on a call).',
      outreachAngle: rating && rating >= 4.3
        ? `Great reputation (${rating}★ over ${reviews} reviews) but no website — an AI assistant can capture calls and DMs into booked appointments 24/7.`
        : 'With no website, a simple AI booking assistant can capture phone and social enquiries around the clock.',
    }
  }

  if (f.hasWebsite) {
    return {
      problemFound:  'Website exists but may have no live chat or instant booking — visitors who do not call could be dropping off without converting (should be verified).',
      outreachAngle: reviews >= 40
        ? `Strong demand (${reviews} reviews) — adding an AI chat/booking layer could convert more of that website traffic into appointments.`
        : 'Adding an AI chat/booking assistant to the site could help convert more visitors into booked appointments.',
    }
  }

  return {
    problemFound:  'No clear contact method on the listing — hard for new customers to reach them.',
    outreachAngle: 'Help them capture and route enquiries so no new customer slips through.',
  }
}
