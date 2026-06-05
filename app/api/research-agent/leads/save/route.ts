// POST /api/research-agent/leads/save
//
// Founder + outreach_agent. Manually saves research results into research_leads (the
// saved-leads CRM). Handles both "Save lead" and "Save all qualified" — the
// client sends an array of lead payloads either way.
//
// Results live in the run's raw_results JSON until the founder saves them,
// so saving is an INSERT. Duplicates are skipped (per-run dedupe by place
// id / website domain / phone / name+address), so a batch never fails
// because a business was already saved.
//
// SAFETY: founder-gated; service role used; inputs validated.

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireOutreachAccess } from '@/lib/auth/require-admin'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { leadDedupKey } from '@/lib/research/leadScoring'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const isDev = process.env.NODE_ENV !== 'production'
function detailOf(err: unknown): string | undefined {
  if (!isDev) return undefined
  if (err && typeof err === 'object') {
    const e = err as { message?: string; details?: string; hint?: string; code?: string }
    return [e.code, e.message, e.details, e.hint].filter(Boolean).join(' | ') || String(err)
  }
  return String(err)
}

const leadSchema = z.object({
  placeId:          z.string().trim().max(300).nullish(),
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
  leads: z.array(leadSchema).min(1, 'Nothing to save.').max(100),
})

type Lead = z.infer<typeof leadSchema>

function toRow(l: Lead, runId: string | null) {
  return {
    research_run_id:    runId,
    place_id:           l.placeId ?? null,
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
    is_saved:           true,
    saved_at:           new Date().toISOString(),
    status:             'saved',
  }
}

export async function POST(request: NextRequest) {
  await requireOutreachAccess({ path: '/admin/mission-control/research-agent' })

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

  try {
    // Existing saved leads for this run → dedupe set.
    const existingKeys = new Set<string>()
    if (runId) {
      const { data: existing, error: exErr } = await db
        .from('research_leads')
        .select('place_id, website, phone, business_name, address')
        .eq('research_run_id', runId)
      if (exErr) {
        const missing = exErr.code === '42P01' || (exErr.message ?? '').toLowerCase().includes('does not exist')
        if (missing) {
          return NextResponse.json(
            { error: 'Research tables not found. Apply migration 20260606120000_create_research_agent.sql in Supabase, then retry.', detail: detailOf(exErr) },
            { status: 503 },
          )
        }
        throw exErr
      }
      for (const r of (existing ?? []) as Record<string, unknown>[]) {
        existingKeys.add(leadDedupKey({
          placeId: r.place_id as string | null,
          website: r.website as string | null,
          phone:   r.phone as string | null,
          name:    r.business_name as string | null,
          address: r.address as string | null,
        }))
      }
    }

    // Filter out duplicates (already-saved + within this batch).
    const batchKeys = new Set<string>()
    const toInsert: ReturnType<typeof toRow>[] = []
    let duplicateCount = 0
    for (const l of leads) {
      const key = leadDedupKey(l)
      if (existingKeys.has(key) || batchKeys.has(key)) { duplicateCount++; continue }
      batchKeys.add(key)
      toInsert.push(toRow(l, runId))
    }

    let savedCount = 0
    if (toInsert.length > 0) {
      const { data, error } = await db.from('research_leads').insert(toInsert).select('id')
      if (error) {
        // Unique-index race (per-run google_maps_url) → treat as duplicates.
        if (error.code === '23505') {
          duplicateCount += toInsert.length
        } else {
          const missing = error.code === '42P01' || (error.message ?? '').toLowerCase().includes('does not exist')
          if (missing) {
            return NextResponse.json(
              { error: 'Research tables not found. Apply migration 20260606120000_create_research_agent.sql in Supabase, then retry.', detail: detailOf(error) },
              { status: 503 },
            )
          }
          throw error
        }
      } else {
        savedCount = (data ?? []).length
      }
    }

    const message =
      savedCount === 0 && duplicateCount > 0
        ? duplicateCount === 1 ? 'Already saved' : 'All already saved'
        : duplicateCount > 0
          ? `${savedCount} saved · ${duplicateCount} already saved`
          : `${savedCount} saved`

    return NextResponse.json({ ok: true, savedCount, duplicateCount, message })
  } catch (err) {
    console.error('[research/leads/save]', err)
    return NextResponse.json({ error: 'Could not save leads. Try again.', detail: detailOf(err) }, { status: 500 })
  }
}
