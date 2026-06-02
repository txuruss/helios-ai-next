// POST /api/research-agent/leads/save
//
// Founder-only. Promotes already-stored research_leads rows from "found" to
// "saved" (is_saved=true, status='saved', saved_at=now()). Handles both
// "Save lead" and "Save all qualified" — the client sends an array of row
// ids either way.
//
// Rows are created at run time (every found business), so saving is an
// UPDATE, not an insert. Already-saved rows are skipped (the is_saved=false
// filter), so a batch never fails because one row was already saved.
//
// SAFETY: founder-gated; service role used; ids validated as UUIDs.

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const saveSchema = z.object({
  runId: z.string().regex(UUID_RE, 'Invalid run id.').nullish(),
  ids:   z.array(z.string().regex(UUID_RE, 'Invalid lead id.')).min(1, 'Nothing to save.').max(100),
})

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
  const { ids } = parsed.data
  const runId: string | null = parsed.data.runId ?? null

  // De-dupe requested ids so counts are accurate.
  const uniqueIds = Array.from(new Set(ids))

  const db = createServiceRoleClient()
  let query = db
    .from('research_leads')
    .update({ is_saved: true, status: 'saved', saved_at: new Date().toISOString() })
    .in('id', uniqueIds)
    .eq('is_saved', false) // already-saved rows are skipped, not errored
  if (runId) query = query.eq('research_run_id', runId) // scope to the run for safety

  const { data, error } = await query.select('id')
  if (error) {
    const missing = error.code === '42P01' || (error.message ?? '').toLowerCase().includes('does not exist')
    if (missing) {
      return NextResponse.json(
        { error: 'Research tables not found. Apply migration 20260606120000_create_research_agent.sql in Supabase, then retry.' },
        { status: 503 },
      )
    }
    console.error('[research/leads/save]', error.message)
    return NextResponse.json({ error: 'Could not save leads. Try again.' }, { status: 500 })
  }

  const savedCount = (data ?? []).length
  // Anything requested but not newly updated was already saved (or stale).
  const duplicateCount = Math.max(0, uniqueIds.length - savedCount)

  const message =
    savedCount === 0 && duplicateCount > 0
      ? duplicateCount === 1 ? 'Already saved' : 'All already saved'
      : duplicateCount > 0
        ? `${savedCount} saved · ${duplicateCount} already saved`
        : `${savedCount} saved`

  return NextResponse.json({ ok: true, savedCount, duplicateCount, message })
}
