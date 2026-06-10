// POST /api/research-agent/leads/status
//
// Founder + outreach_agent. Updates a saved research lead's status:
//   ready_for_outreach | contacted | archived | saved
//
// This ONLY changes the status field. It does NOT send any message, email,
// or trigger outreach — that is intentionally out of scope for now.

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireOutreachAccess } from '@/lib/auth/require-admin'
import { leadScopeFor } from '@/lib/auth/permissions'
import { createServiceRoleClient } from '@/lib/supabase/server'

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

const statusSchema = z.object({
  id:     z.string().regex(UUID_RE, 'Invalid lead id.'),
  status: z.enum([
    'saved', 'ready_for_outreach', 'contacted',
    'interested', 'call_booked', 'not_interested', 'archived',
  ]),
})

export async function POST(request: NextRequest) {
  // The session scopes the update: an outreach_agent may only change the
  // status of leads THEY saved — anything else behaves as not found.
  const session = await requireOutreachAccess({ path: '/admin/mission-control/research-agent' })
  const scope = leadScopeFor(session.role, session.teamMemberId)

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 })
  }
  if (!scope.viewAll && !scope.ownTeamMemberId) {
    return NextResponse.json({ error: 'Lead not found.' }, { status: 404 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const parsed = statusSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input.' }, { status: 400 })
  }
  const { id, status } = parsed.data

  const db = createServiceRoleClient()
  let query = db
    .from('research_leads')
    .update({ status })
    .eq('id', id)
    .eq('is_saved', true) // only saved leads can change status here
  if (!scope.viewAll) {
    // Server-side ownership filter: 0 rows for someone else's lead → 404.
    query = query.eq('saved_by_team_member_id', scope.ownTeamMemberId)
  }
  const { data, error } = await query.select('id, status')

  if (error) {
    if (error.code === '42703' && !scope.viewAll) {
      return NextResponse.json(
        { error: 'Per-agent lead visibility requires migration 20260608120000_add_saved_by_attribution.sql in Supabase.', detail: detailOf(error) },
        { status: 503 },
      )
    }
    const missing = error.code === '42P01' || (error.message ?? '').toLowerCase().includes('does not exist')
    if (missing) {
      return NextResponse.json(
        { error: 'Research tables not found. Apply migration 20260606120000_create_research_agent.sql in Supabase, then retry.', detail: detailOf(error) },
        { status: 503 },
      )
    }
    console.error('[research/leads/status]', error)
    return NextResponse.json({ error: 'Could not update lead status. Try again.', detail: detailOf(error) }, { status: 500 })
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Lead not found.' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, id, status })
}
