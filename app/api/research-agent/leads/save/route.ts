// POST /api/research-agent/leads/save
//
// Founder-only. Saves one or more scored businesses (from a research run)
// into research_leads. Handles both "save lead" and "save all qualified"
// — the client sends an array either way.
//
// DEDUPE: a saved lead is unique per Google Maps URL (DB unique index +
// upsert ignore-duplicates). For results with no Maps URL, we fall back to
// matching business_name + address + research_run_id in this route. A
// duplicate is never an error — it is reported as "already saved" so a
// batch (Save All Qualified) never fails because one row already exists.
//
// SAFETY: only real Google Places results pass through here. We validate
// every row and never fabricate fields. Nothing is contacted.

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const leadSchema = z.object({
  name:             z.string().trim().min(1).max(200),
  niche:            z.string().trim().max(120).nullish(),
  address:          z.string().trim().max(500).nullish(),
  phone:            z.string().trim().max(80).nullish(),
  website:          z.string().trim().max(500).nullish(),
  googleMapsUrl:    z.string().trim().max(500).nullish(),
  rating:           z.number().nullish(),
  reviewCount:      z.number().int().nullish(),
  problemFound:     z.string().max(2000).nullish(),
  outreachAngle:    z.string().max(2000).nullish(),
  firstDm:          z.string().max(2000).nullish(),
  coldEmailOpening: z.string().max(2000).nullish(),
  leadScore:        z.number().int().min(0).max(100).nullish(),
})

const saveSchema = z.object({
  runId: z.string().regex(UUID_RE, 'Invalid run id.').nullish(),
  leads: z.array(leadSchema).min(1, 'Nothing to save.').max(50),
})

type Lead = z.infer<typeof leadSchema>

const MIGRATION_HINT =
  'Research tables not found. Apply migration 20260606120000_create_research_agent.sql in Supabase, then retry.'

function isMissingTable(e: { code?: string; message?: string } | null): boolean {
  if (!e) return false
  if (e.code === '42P01') return true
  return (e.message ?? '').toLowerCase().includes('does not exist')
}

function toRow(l: Lead, runId: string | null) {
  return {
    research_run_id:    runId ?? null,
    business_name:      l.name,
    niche:              l.niche ?? null,
    address:            l.address ?? null,
    phone:              l.phone ?? null,
    website:            l.website ?? null,
    google_maps_url:    l.googleMapsUrl ?? null,
    rating:             l.rating ?? null,
    review_count:       l.reviewCount ?? null,
    problem_found:      l.problemFound ?? null,
    outreach_angle:     l.outreachAngle ?? null,
    first_dm:           l.firstDm ?? null,
    cold_email_opening: l.coldEmailOpening ?? null,
    lead_score:         l.leadScore ?? null,
    status:             'new',
  }
}

export async function POST(request: NextRequest) {
  await requireAdmin({ path: '/admin/mission-control/research-agent' })

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const parsed = saveSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input.' }, { status: 400 })
  }
  const { leads } = parsed.data
  const runId: string | null = parsed.data.runId ?? null
  const db = createServiceRoleClient()

  let savedCount = 0
  let duplicateCount = 0

  // ── Group 1: rows WITH a Google Maps URL — DB-level dedupe ─────────
  // Upsert with ignoreDuplicates relies on the unique index on
  // google_maps_url. .select() returns only the rows actually inserted,
  // so anything skipped was already saved.
  const withUrl = leads.filter((l) => !!l.googleMapsUrl)
  if (withUrl.length > 0) {
    // De-dupe within this batch first (same business under two niches).
    const seen = new Set<string>()
    const rows: ReturnType<typeof toRow>[] = []
    for (const l of withUrl) {
      const key = l.googleMapsUrl as string
      if (seen.has(key)) { duplicateCount++; continue }
      seen.add(key)
      rows.push(toRow(l, runId))
    }

    const { data, error } = await db
      .from('research_leads')
      .upsert(rows, { onConflict: 'google_maps_url', ignoreDuplicates: true })
      .select('id')

    if (error) {
      if (isMissingTable(error)) return NextResponse.json({ error: MIGRATION_HINT }, { status: 503 })
      console.error('[research/leads/save] url group', error.message)
      return NextResponse.json({ error: 'Could not save leads. Try again.' }, { status: 500 })
    }
    const inserted = (data ?? []).length
    savedCount += inserted
    duplicateCount += rows.length - inserted
  }

  // ── Group 2: rows WITHOUT a Maps URL — app-level fallback dedupe ───
  // Match on business_name + address + research_run_id. Insert only the
  // ones not already present, de-duping within the batch as well.
  const withoutUrl = leads.filter((l) => !l.googleMapsUrl)
  if (withoutUrl.length > 0) {
    const seen = new Set<string>()
    const toInsert: ReturnType<typeof toRow>[] = []

    for (const l of withoutUrl) {
      const addr = l.address ?? null
      const key = `${l.name}|${addr ?? ''}|${runId ?? ''}`
      if (seen.has(key)) { duplicateCount++; continue }
      seen.add(key)

      let query = db.from('research_leads').select('id').limit(1).eq('business_name', l.name)
      query = runId ? query.eq('research_run_id', runId) : query.is('research_run_id', null)
      query = addr  ? query.eq('address', addr)          : query.is('address', null)

      const { data: existing, error } = await query
      if (error) {
        if (isMissingTable(error)) return NextResponse.json({ error: MIGRATION_HINT }, { status: 503 })
        console.error('[research/leads/save] dedupe check', error.message)
        return NextResponse.json({ error: 'Could not save leads. Try again.' }, { status: 500 })
      }
      if ((existing ?? []).length > 0) { duplicateCount++; continue }
      toInsert.push(toRow(l, runId))
    }

    if (toInsert.length > 0) {
      const { error } = await db.from('research_leads').insert(toInsert)
      if (error) {
        if (isMissingTable(error)) return NextResponse.json({ error: MIGRATION_HINT }, { status: 503 })
        console.error('[research/leads/save] insert group', error.message)
        return NextResponse.json({ error: 'Could not save leads. Try again.' }, { status: 500 })
      }
      savedCount += toInsert.length
    }
  }

  const message =
    savedCount === 0 && duplicateCount > 0
      ? duplicateCount === 1 ? 'Already saved' : 'All already saved'
      : duplicateCount > 0
        ? `${savedCount} saved · ${duplicateCount} already saved`
        : `${savedCount} saved`

  return NextResponse.json({ ok: true, savedCount, duplicateCount, message })
}
