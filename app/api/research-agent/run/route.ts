// POST /api/research-agent/run
//
// Founder-only. Runs a Google Places search for one or more niches in a
// location, scores each real result with rule-based logic, records the run
// in research_runs, and stores EVERY found business in research_leads
// (is_saved=false, status='found'). If "save qualified" is on, qualified
// rows are promoted to saved in the same request.
//
// SAFETY: server-side only. GOOGLE_MAPS_API_KEY never leaves the server.
// Nothing is contacted — results are scored and stored only.

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { googleMapsConfigured, searchPlaces, GooglePlacesError } from '@/lib/research/googlePlaces'
import { scoreLead, QUALIFIED_SCORE, type ScoredLead } from '@/lib/research/leadScoring'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const runSchema = z.object({
  location:      z.string().trim().min(2, 'Location is required.').max(200),
  niches:        z.array(z.string().trim().min(1).max(120)).min(1, 'Add at least one niche.').max(6),
  leadTarget:    z.number().int().min(1).max(50).default(10),
  radiusKm:      z.number().int().min(1).max(100).default(10),
  saveQualified: z.boolean().default(false),
})

// Within-run dedupe key: Maps URL when present, else name+address.
function keyOf(gmaps: string | null | undefined, name: string, addr: string | null | undefined): string {
  return gmaps ? `url:${gmaps}` : `na:${name}|${addr ?? ''}`
}

// Map a scored lead → a research_leads insert row. Every found business is
// stored unsaved (is_saved=false, status='found') until promoted.
function toLeadRow(lead: ScoredLead, runId: string) {
  return {
    research_run_id:    runId,
    business_name:      lead.name,
    niche:              lead.niche,
    address:            lead.address,
    phone:              lead.phone,
    website:            lead.website,
    google_maps_url:    lead.googleMapsUrl,
    rating:             lead.rating,
    review_count:       lead.reviewCount,
    problem_found:      lead.problemFound,
    outreach_angle:     lead.outreachAngle,
    first_dm:           lead.firstDm,
    cold_email_opening: lead.coldEmailOpening,
    lead_score:         lead.leadScore,
    is_saved:           false,
    status:             'found',
  }
}

interface InsertedRow {
  id:              string
  google_maps_url: string | null
  business_name:   string
  address:         string | null
  lead_score:      number | null
}

export async function POST(request: NextRequest) {
  // Founder gate first (redirects on failure — must not be inside try/catch).
  await requireAdmin({ path: '/admin/mission-control/research-agent' })

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 })
  }
  if (!googleMapsConfigured()) {
    return NextResponse.json(
      { error: 'GOOGLE_MAPS_API_KEY is not set. Add it to the server environment to run research.' },
      { status: 400 },
    )
  }

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const parsed = runSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input.' }, { status: 400 })
  }
  const { location, niches, leadTarget, radiusKm, saveQualified } = parsed.data

  const db = createServiceRoleClient()

  // Record the run (history) before doing the work.
  const title = `${niches.join(', ')} in ${location}`
  const { data: runRow, error: runErr } = await db
    .from('research_runs')
    .insert({ title, location, niches, radius_km: radiusKm, lead_target: leadTarget, status: 'running' })
    .select('id')
    .single()

  if (runErr) {
    const missing = runErr.code === '42P01' || (runErr.message ?? '').toLowerCase().includes('does not exist')
    if (missing) {
      return NextResponse.json(
        { error: 'Research tables not found. Apply migration 20260606120000_create_research_agent.sql in Supabase, then retry.' },
        { status: 503 },
      )
    }
    console.error('[research/run] insert run', runErr.message)
    return NextResponse.json({ error: 'Could not start research run.' }, { status: 500 })
  }
  const runId = (runRow as { id: string }).id

  // Per-niche search → score. Errors mark the run failed and surface clearly.
  try {
    const all: ScoredLead[] = []
    for (const niche of niches) {
      const places = await searchPlaces({ location, niche, radiusKm, limit: leadTarget })
      for (const place of places) all.push(scoreLead(place, niche))
    }

    // Best fits first, then cap to the requested total.
    all.sort((a, b) => b.leadScore - a.leadScore)
    const capped = all.slice(0, leadTarget)

    // De-dupe within this run (same business under two niches). The run id is
    // brand new, so there are no pre-existing rows to conflict with.
    const seen = new Set<string>()
    const unique: ScoredLead[] = []
    for (const l of capped) {
      const k = keyOf(l.googleMapsUrl, l.name, l.address)
      if (seen.has(k)) continue
      seen.add(k)
      unique.push(l)
    }

    // Store EVERY found business (unsaved).
    let inserted: InsertedRow[] = []
    if (unique.length > 0) {
      const { data, error: insErr } = await db
        .from('research_leads')
        .insert(unique.map((l) => toLeadRow(l, runId)))
        .select('id, google_maps_url, business_name, address, lead_score')
      if (insErr) {
        await db.from('research_runs').update({ status: 'failed' }).eq('id', runId)
        console.error('[research/run] insert leads', insErr.message)
        return NextResponse.json({ error: 'Could not store research results.' }, { status: 500 })
      }
      inserted = (data ?? []) as InsertedRow[]
    }

    // Map dedupe-key → DB id so returned leads carry their real row id.
    const idByKey = new Map<string, string>()
    for (const r of inserted) idByKey.set(keyOf(r.google_maps_url, r.business_name, r.address), r.id)

    // Optionally promote the qualified subset to saved.
    let savedCount = 0
    const savedKeys = new Set<string>()
    if (saveQualified) {
      const qualifiedIds = inserted.filter((r) => (r.lead_score ?? 0) >= QUALIFIED_SCORE).map((r) => r.id)
      if (qualifiedIds.length > 0) {
        const { data: promoted, error: upErr } = await db
          .from('research_leads')
          .update({ is_saved: true, status: 'saved', saved_at: new Date().toISOString() })
          .in('id', qualifiedIds)
          .eq('is_saved', false)
          .select('google_maps_url, business_name, address')
        if (upErr) {
          console.error('[research/run] auto-save', upErr.message)
        } else {
          savedCount = (promoted ?? []).length
          for (const r of (promoted ?? []) as Pick<InsertedRow, 'google_maps_url' | 'business_name' | 'address'>[]) {
            savedKeys.add(keyOf(r.google_maps_url, r.business_name, r.address))
          }
        }
      }
    }

    await db.from('research_runs').update({ status: 'completed', leads_found: unique.length }).eq('id', runId)

    // Return leads with their real row id + saved flag.
    const out = unique.map((l) => {
      const k = keyOf(l.googleMapsUrl, l.name, l.address)
      return { ...l, id: idByKey.get(k) ?? k, saved: savedKeys.has(k) }
    })

    return NextResponse.json({ ok: true, runId, leads: out, savedCount, qualifiedScore: QUALIFIED_SCORE })
  } catch (err) {
    await db.from('research_runs').update({ status: 'failed' }).eq('id', runId)
    if (err instanceof GooglePlacesError) {
      return NextResponse.json({ error: err.message }, { status: 502 })
    }
    console.error('[research/run]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Research run failed. Try again.' }, { status: 500 })
  }
}
