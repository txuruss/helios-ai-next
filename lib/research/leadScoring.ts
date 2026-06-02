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

// Visual band for a 0–100 score, using the Mission Control palette.
export function scoreBand(score: number): ScoreBand {
  if (score >= 80) return { label: 'Excellent fit', color: '#22d093' }
  if (score >= QUALIFIED_SCORE) return { label: 'Strong fit', color: '#ffae3c' }
  if (score >= 40) return { label: 'Moderate', color: '#3b9eff' }
  return { label: 'Weak fit', color: '#6a6a6e' }
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

  return {
    ...place,
    niche,
    leadScore:        score,
    problemFound,
    outreachAngle,
    firstDm:          `Hi ${display} team — quick one: when someone messages or calls outside opening hours, who picks it up? I help local ${niche} businesses capture those missed enquiries automatically so they turn into booked appointments.`,
    coldEmailOpening: `Hi ${display} — I looked you up while researching ${niche} businesses in the area. ${outreachAngle}`,
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
      problemFound:  'No website found — enquiries depend entirely on phone calls, so after-hours and missed calls are lost leads.',
      outreachAngle: rating && rating >= 4.3
        ? `Great reputation (${rating}★ over ${reviews} reviews) but no website — an AI assistant can capture calls and DMs into booked appointments 24/7.`
        : 'With no website, a simple AI booking assistant can capture phone and social enquiries around the clock.',
    }
  }

  if (f.hasWebsite) {
    return {
      problemFound:  'Website exists but likely has no live chat or instant booking, so visitors who do not call drop off without converting.',
      outreachAngle: reviews >= 40
        ? `Strong demand (${reviews} reviews) — adding an AI chat/booking layer would convert more of that website traffic into appointments.`
        : 'Adding an AI chat/booking assistant to the site would convert more visitors into booked appointments.',
    }
  }

  return {
    problemFound:  'No clear contact method on the listing — hard for new customers to reach them.',
    outreachAngle: 'Help them capture and route enquiries so no new customer slips through.',
  }
}
