// POST /api/research-agent/run
//
// Founder-only. Runs a Google Places search for one or more niches in a
// location, scores each real result with rule-based logic, records the
// run in research_runs, and (optionally) auto-saves qualified leads.
//
// SAFETY: server-side only. GOOGLE_MAPS_API_KEY never leaves the server.
// Nothing is contacted — results are scored and (optionally) stored only.

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

// Map a scored lead → a research_leads insert row.
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
    status:             'qualified',
  }
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
    const leads = all.slice(0, leadTarget)

    // Optionally auto-save the qualified subset.
    let savedCount = 0
    const savedKeys = new Set<string>()
    if (saveQualified) {
      const qualified = leads.filter((l) => l.leadScore >= QUALIFIED_SCORE)
      if (qualified.length > 0) {
        // Upsert + ignoreDuplicates so a business already saved from an
        // earlier run is skipped (via the google_maps_url unique index)
        // instead of failing the whole batch. .select() returns only the
        // rows actually inserted.
        const { data: saved, error: saveErr } = await db
          .from('research_leads')
          .upsert(qualified.map((l) => toLeadRow(l, runId)), { onConflict: 'google_maps_url', ignoreDuplicates: true })
          .select('google_maps_url')
        if (saveErr) {
          console.error('[research/run] auto-save', saveErr.message)
        } else {
          // Newly inserted count drives the "saved automatically" note.
          savedCount = (saved ?? []).length
          // Every qualified lead is now in the DB (inserted now or already
          // present as a duplicate), so reflect all of them as saved.
          for (const l of qualified) savedKeys.add(l.googleMapsUrl ?? `${l.name}|${l.address}`)
        }
      }
    }

    await db.from('research_runs').update({ status: 'completed' }).eq('id', runId)

    // Tag each returned lead with a stable client id + saved flag.
    const out = leads.map((l, i) => ({
      ...l,
      id: `${runId}-${i}`,
      saved: savedKeys.has(l.googleMapsUrl ?? `${l.name}|${l.address}`),
    }))

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
