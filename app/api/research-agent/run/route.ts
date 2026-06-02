// POST /api/research-agent/run
//
// Founder-only. Runs a Google Places search for one or more niches in a
// location, scores each real result with rule-based logic, and stores the
// run in research_runs (with the full scored set in raw_results JSON).
//
// Storage rules:
//   • A research_runs row is ALWAYS created for a successful run — history
//     does not depend on auto-save.
//   • Lead records (research_leads) are created ONLY when saveQualified is
//     true, and only for qualified results, de-duplicated within the run.
//
// SAFETY: server-side only. GOOGLE_MAPS_API_KEY never leaves the server.
// Nothing is contacted — results are scored and stored only.

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { googleMapsConfigured, searchPlaces, GooglePlacesError } from '@/lib/research/googlePlaces'
import { scoreLead, leadDedupKey, QUALIFIED_SCORE, type ScoredLead } from '@/lib/research/leadScoring'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const runSchema = z.object({
  location:      z.string().trim().min(1, 'Location is required.').max(200),
  niches:        z.array(z.string().trim().min(1).max(120)).min(1, 'Add at least one niche.').max(6),
  leadTarget:    z.number().int().min(1).max(50).default(10),
  radiusKm:      z.number().int().min(1).max(100).default(10),
  saveQualified: z.boolean().default(false),
})

// Real error detail in development only; never leak internals in production.
const isDev = process.env.NODE_ENV !== 'production'
function detailOf(err: unknown): string | undefined {
  if (!isDev) return undefined
  if (err && typeof err === 'object') {
    const e = err as { message?: string; details?: string; hint?: string; code?: string }
    return [e.code, e.message, e.details, e.hint].filter(Boolean).join(' | ') || String(err)
  }
  return String(err)
}
function fail(error: string, status: number, err?: unknown) {
  return NextResponse.json({ error, detail: detailOf(err) }, { status })
}

// A scored, qualified lead → a research_leads (saved) insert row.
function toSavedLeadRow(lead: ScoredLead, runId: string) {
  return {
    research_run_id:    runId,
    place_id:           lead.placeId,
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
    is_saved:           true,
    saved_at:           new Date().toISOString(),
    status:             'saved',
  }
}

export async function POST(request: NextRequest) {
  // Founder gate first (redirects on failure — must not be inside try/catch).
  await requireAdmin({ path: '/admin/mission-control/research-agent' })

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return fail('Server configuration error.', 500)
  }
  if (!googleMapsConfigured()) {
    return fail('GOOGLE_MAPS_API_KEY is not set. Add it to the server environment to run research.', 400)
  }

  // ── Defensive validation ──
  let body: unknown
  try { body = await request.json() } catch {
    return fail('Invalid JSON.', 400)
  }
  const parsed = runSchema.safeParse(body)
  if (!parsed.success) {
    return fail(parsed.error.errors[0]?.message ?? 'Invalid input.', 400)
  }
  const { location, niches, leadTarget, radiusKm, saveQualified } = parsed.data

  const db = createServiceRoleClient()

  // Create the run row up front (status running) so failures are recorded.
  const title = `${niches.join(', ')} in ${location}`
  const { data: runRow, error: runErr } = await db
    .from('research_runs')
    .insert({ title, location, niches, radius_km: radiusKm, lead_target: leadTarget, status: 'running' })
    .select('id')
    .single()

  if (runErr) {
    const missing = runErr.code === '42P01' || (runErr.message ?? '').toLowerCase().includes('does not exist')
    if (missing) {
      return fail(
        'Research tables not found. Apply migration 20260606120000_create_research_agent.sql in Supabase, then retry.',
        503, runErr,
      )
    }
    console.error('[research/run] insert run', runErr)
    return fail('Could not start research run.', 500, runErr)
  }
  const runId = (runRow as { id: string }).id

  try {
    // ── Search + score ──
    const all: ScoredLead[] = []
    for (const niche of niches) {
      const places = await searchPlaces({ location, niche, radiusKm, limit: leadTarget })
      for (const place of places) all.push(scoreLead(place, niche))
    }

    // Best fits first, cap to the requested total, de-dupe within the run.
    all.sort((a, b) => b.leadScore - a.leadScore)
    const capped = all.slice(0, leadTarget)
    const seen = new Set<string>()
    const unique: ScoredLead[] = []
    for (const l of capped) {
      const k = leadDedupKey(l)
      if (seen.has(k)) continue
      seen.add(k)
      unique.push(l)
    }

    const resultsFound   = unique.length
    const qualified      = unique.filter((l) => l.leadScore >= QUALIFIED_SCORE)
    const qualifiedCount = qualified.length

    // Stable per-result id so the UI + raw_results agree.
    const rawLeads = unique.map((l, i) => ({ ...l, id: `${runId}-${i}`, saved: false }))

    // ── Auto-save: create lead records ONLY when requested ──
    let savedLeadCount = 0
    const savedKeys = new Set<string>()
    if (saveQualified && qualified.length > 0) {
      // qualified is already de-duped (it is a subset of `unique`).
      const { data: savedRows, error: saveErr } = await db
        .from('research_leads')
        .insert(qualified.map((l) => toSavedLeadRow(l, runId)))
        .select('place_id, website, phone, business_name, address')
      if (saveErr) {
        // Non-fatal: the run + raw_results still save. Surface in dev.
        console.error('[research/run] auto-save leads', saveErr)
      } else {
        savedLeadCount = (savedRows ?? []).length
        for (const l of qualified) savedKeys.add(leadDedupKey(l))
      }
    }

    // Reflect saved status in the returned + stored results.
    for (const l of rawLeads) if (savedKeys.has(leadDedupKey(l))) l.saved = true

    // ── Persist the run (history) ──
    const { error: updErr } = await db
      .from('research_runs')
      .update({
        status:           'completed',
        leads_found:      resultsFound,
        qualified_count:  qualifiedCount,
        saved_lead_count: savedLeadCount,
        raw_results:      rawLeads,
        error_message:    null,
      })
      .eq('id', runId)

    if (updErr) {
      await db.from('research_runs')
        .update({ status: 'failed', error_message: updErr.message?.slice(0, 1000) ?? 'storage error' })
        .eq('id', runId)
      console.error('[research/run] persist results', updErr)
      return fail('Could not store research results.', 500, updErr)
    }

    return NextResponse.json({
      ok: true,
      runId,
      leads: rawLeads,
      resultsFound,
      qualifiedCount,
      savedCount: savedLeadCount,
      qualifiedScore: QUALIFIED_SCORE,
    })
  } catch (err) {
    await db.from('research_runs')
      .update({ status: 'failed', error_message: (err instanceof Error ? err.message : String(err)).slice(0, 1000) })
      .eq('id', runId)
    if (err instanceof GooglePlacesError) {
      return fail(err.message, 502, err)
    }
    console.error('[research/run]', err)
    return fail('Research run failed. Try again.', 500, err)
  }
}
