// ── Google Places API client (server-only) ────────────────────────
//
// SECURITY: imports 'server-only' so this can NEVER reach the browser
// bundle. GOOGLE_MAPS_API_KEY is read here and used only in server-side
// fetches. It must NOT be prefixed with NEXT_PUBLIC_ and is never returned
// to the client.
//
// Uses the Places API (New) Text Search endpoint, which returns business
// name, category, address, phone, website, rating, review count, and the
// Google Maps URL in a single request per niche (field-masked).

import 'server-only'

import type { PlaceResult } from './leadScoring'

const TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText'

// The exact set of fields we request. Field masks are required by the new
// Places API and keep the response (and billing) tight.
const FIELD_MASK = [
  'places.displayName',
  'places.formattedAddress',
  'places.internationalPhoneNumber',
  'places.nationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'places.googleMapsUri',
  'places.primaryType',
  'places.primaryTypeDisplayName',
  'places.types',
  'places.businessStatus',
].join(',')

export function googleMapsConfigured(): boolean {
  return !!process.env.GOOGLE_MAPS_API_KEY
}

export class GooglePlacesError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'GooglePlacesError'
    this.status = status
  }
}

interface SearchPlacesArgs {
  location: string
  niche:    string
  /** Advisory in Phase 1 — recorded on the run; the text query drives results. */
  radiusKm: number
  /** Max results to request for this niche (Places returns up to 20/page). */
  limit:    number
}

function s(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null
}

// Shape of a single place in the Places API (New) response.
interface RawPlace {
  displayName?:              { text?: string }
  formattedAddress?:         string
  internationalPhoneNumber?: string
  nationalPhoneNumber?:      string
  websiteUri?:               string
  rating?:                   number
  userRatingCount?:          number
  googleMapsUri?:            string
  primaryType?:              string
  primaryTypeDisplayName?:   { text?: string }
  types?:                    string[]
  businessStatus?:           string
}

function toPlaceResult(p: RawPlace): PlaceResult | null {
  const name = s(p.displayName?.text)
  if (!name) return null // never keep a result without a real business name
  return {
    name,
    category:       s(p.primaryTypeDisplayName?.text) ?? s(p.primaryType) ?? (p.types?.[0] ?? null),
    address:        s(p.formattedAddress),
    phone:          s(p.internationalPhoneNumber) ?? s(p.nationalPhoneNumber),
    website:        s(p.websiteUri),
    googleMapsUrl:  s(p.googleMapsUri),
    rating:         typeof p.rating === 'number' ? p.rating : null,
    reviewCount:    typeof p.userRatingCount === 'number' ? p.userRatingCount : null,
    businessStatus: s(p.businessStatus),
    types:          Array.isArray(p.types) ? p.types.filter((t): t is string => typeof t === 'string') : [],
  }
}

// Search Google Places for one niche in one location. Returns ONLY real
// results from Google. Throws GooglePlacesError on a failed request so the
// caller can surface a clear error state.
export async function searchPlaces({ location, niche, limit }: SearchPlacesArgs): Promise<PlaceResult[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) throw new GooglePlacesError('GOOGLE_MAPS_API_KEY is not configured.', 500)

  const pageSize = Math.max(1, Math.min(20, limit))
  const textQuery = `${niche} in ${location}`

  let res: Response
  try {
    res = await fetch(TEXT_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type':     'application/json',
        'X-Goog-Api-Key':   apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify({ textQuery, pageSize, languageCode: 'en' }),
      cache: 'no-store',
    })
  } catch (err) {
    throw new GooglePlacesError(
      `Could not reach Google Places: ${err instanceof Error ? err.message : 'network error'}`,
      502,
    )
  }

  if (!res.ok) {
    let detail = ''
    try {
      const body = await res.json()
      detail = body?.error?.message ?? ''
    } catch { /* ignore parse failure */ }
    throw new GooglePlacesError(
      `Google Places request failed (${res.status})${detail ? `: ${detail}` : ''}. ` +
        'Confirm the Places API (New) is enabled for this key and billing is active.',
      res.status,
    )
  }

  let data: { places?: RawPlace[] }
  try {
    data = await res.json()
  } catch {
    throw new GooglePlacesError('Google Places returned an unreadable response.', 502)
  }

  const places = Array.isArray(data.places) ? data.places : []
  return places.map(toPlaceResult).filter((p): p is PlaceResult => p !== null)
}
