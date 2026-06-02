// GET /api/research-agent/runs/[id]
//
// Founder-only. Returns one research run's details plus all leads saved
// against it (research_run_id). Used by the "View Results" action.

import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { getResearchRunDetail } from '@/lib/data/admin-research'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin({ path: '/admin/mission-control/research-agent' })

  const { id } = await params
  const detail = await getResearchRunDetail(id)

  if (detail.migrationNeeded) {
    return NextResponse.json({ ok: false, migrationNeeded: true, error: 'Research tables not found.' }, { status: 503 })
  }
  if (detail.error) return NextResponse.json({ ok: false, error: detail.error }, { status: 500 })
  if (detail.notFound || !detail.run) return NextResponse.json({ ok: false, error: 'Run not found.' }, { status: 404 })

  return NextResponse.json({ ok: true, run: detail.run, leads: detail.leads })
}
