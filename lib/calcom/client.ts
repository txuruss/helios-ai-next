// ── Cal.com server-only API client ────────────────────────────────
// NEVER import this file in client components.
// All Cal.com credentials stay server-side only.

const BASE_URL = 'https://api.cal.com'

function apiVersion(): string {
  return process.env.CALCOM_API_VERSION ?? '2'
}

function baseUrl(): string {
  return `${BASE_URL}/v${apiVersion()}`
}

function authHeaders(): Record<string, string> {
  return {
    Authorization:   `Bearer ${process.env.CALCOM_API_KEY}`,
    'Content-Type':  'application/json',
    'cal-api-v2-authorization': process.env.CALCOM_API_KEY ?? '',
  }
}

// ── Typed return wrapper ──────────────────────────────────────────

export type CalcomResult<T> =
  | { ok: true;  data: T }
  | { ok: false; error: string }

// ── Domain types (exported for use in server-side code only) ──────

export interface CalcomEventType {
  calcom_id:    number
  title:        string
  slug:         string | null
  duration_min: number | null
  is_active:    boolean
  raw_data:     Record<string, unknown>
}

export interface CalcomSlot {
  time:     string   // ISO 8601
  date_key: string   // YYYY-MM-DD
}

export interface CalcomBookingResult {
  calcom_booking_uid: string
  calcom_id:          number
  status:             string
  start:              string
  end:                string | null
  title:              string | null
}

// ── Internal fetch helper ─────────────────────────────────────────

async function calFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<CalcomResult<T>> {
  if (!process.env.CALCOM_API_KEY) {
    return { ok: false, error: 'CALCOM_API_KEY not configured' }
  }

  const url = `${baseUrl()}${path}`

  try {
    const res = await fetch(url, {
      ...options,
      headers: { ...authHeaders(), ...options?.headers },
    })

    const raw = await res.json().catch(() => ({}))

    if (!res.ok) {
      const msg = raw?.message ?? raw?.error ?? `HTTP ${res.status}`
      console.error('[calcom]', options?.method ?? 'GET', url, res.status, msg)
      return { ok: false, error: 'Cal.com request failed.' }
    }

    // v2 wraps data under { status, data }; v1 returns data directly
    const data = (raw?.data ?? raw) as T
    return { ok: true, data }

  } catch (err) {
    console.error('[calcom] fetch error:', err instanceof Error ? err.message : err)
    return { ok: false, error: 'Unable to reach Cal.com.' }
  }
}

// ── getEventTypes ─────────────────────────────────────────────────

export async function getEventTypes(): Promise<CalcomResult<CalcomEventType[]>> {
  const result = await calFetch<unknown>('/event-types')
  if (!result.ok) return result

  try {
    const raw = result.data as Record<string, unknown>

    // v2: { eventTypeGroups: [{ eventTypes: [...] }] }
    const groups = raw?.eventTypeGroups as Array<{ eventTypes: unknown[] }> | undefined
    const rawTypes: unknown[] = groups?.flatMap((g) => g.eventTypes ?? []) ?? []

    // v1 fallback: { event_types: [...] }
    const v1Types = raw?.event_types as unknown[] | undefined
    const source = rawTypes.length > 0 ? rawTypes : (v1Types ?? [])

    const types: CalcomEventType[] = source.map((et: unknown) => {
      const e = et as Record<string, unknown>
      return {
        calcom_id:    Number(e.id),
        title:        String(e.title ?? ''),
        slug:         e.slug ? String(e.slug) : null,
        duration_min: e.length ? Number(e.length) : (e.duration ? Number(e.duration) : null),
        is_active:    e.active !== false && e.isActive !== false,
        raw_data:     e,
      }
    }).filter((et) => et.calcom_id > 0 && et.title)

    return { ok: true, data: types }
  } catch (err) {
    console.error('[calcom] getEventTypes parse error:', err)
    return { ok: false, error: 'Could not parse event types from Cal.com.' }
  }
}

// ── getAvailability ───────────────────────────────────────────────

export interface AvailabilityParams {
  eventTypeId: number
  startTime:   string   // ISO 8601
  endTime:     string   // ISO 8601
  timezone?:   string
}

export async function getAvailability(
  params: AvailabilityParams,
): Promise<CalcomResult<CalcomSlot[]>> {
  const qs = new URLSearchParams({
    startTime:   params.startTime,
    endTime:     params.endTime,
    eventTypeId: String(params.eventTypeId),
    ...(params.timezone ? { timeZone: params.timezone } : {}),
  })

  const result = await calFetch<unknown>(`/slots/available?${qs}`)
  if (!result.ok) return result

  try {
    const raw = result.data as Record<string, unknown>
    // v2: { slots: { "2024-01-10": [{ time: "..." }] } }
    // v1: same structure
    const slotsMap = (raw?.slots ?? {}) as Record<string, Array<{ time: string }>>

    const slots: CalcomSlot[] = Object.entries(slotsMap).flatMap(([dateKey, daySlots]) =>
      (daySlots ?? []).map((s) => ({ time: s.time, date_key: dateKey })),
    )

    return { ok: true, data: slots }
  } catch (err) {
    console.error('[calcom] getAvailability parse error:', err)
    return { ok: false, error: 'Could not parse availability from Cal.com.' }
  }
}

// ── createBooking ─────────────────────────────────────────────────

export interface CreateBookingParams {
  eventTypeId: number
  start:       string   // ISO 8601
  timezone?:   string
  attendee: {
    name:     string
    email:    string
    language?: string
  }
  notes?:  string
  metadata?: Record<string, string>
}

export async function createBooking(
  params: CreateBookingParams,
): Promise<CalcomResult<CalcomBookingResult>> {
  const tz = params.timezone ?? 'UTC'

  const body = {
    eventTypeId: params.eventTypeId,
    start:       params.start,
    timeZone:    tz,
    language:    params.attendee.language ?? 'en',
    metadata:    params.metadata ?? {},
    attendee: {
      name:     params.attendee.name,
      email:    params.attendee.email,
      timeZone: tz,
      language: params.attendee.language ?? 'en',
    },
    responses: {
      name:   params.attendee.name,
      email:  params.attendee.email,
      guests: [] as string[],
      ...(params.notes ? { notes: params.notes } : {}),
    },
  }

  const result = await calFetch<unknown>('/bookings', {
    method:  'POST',
    body:    JSON.stringify(body),
  })
  if (!result.ok) return result

  try {
    const raw = result.data as Record<string, unknown>
    const booking: CalcomBookingResult = {
      calcom_booking_uid: String(raw?.uid ?? raw?.id ?? ''),
      calcom_id:          Number(raw?.id ?? 0),
      status:             String(raw?.status ?? 'PENDING').toUpperCase(),
      start:              String(raw?.start ?? raw?.startTime ?? params.start),
      end:                raw?.end ? String(raw.end) : null,
      title:              raw?.title ? String(raw.title) : null,
    }
    return { ok: true, data: booking }
  } catch (err) {
    console.error('[calcom] createBooking parse error:', err)
    return { ok: false, error: 'Could not parse booking response from Cal.com.' }
  }
}
