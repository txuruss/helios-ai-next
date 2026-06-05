// GET /api/research-agent/runs
//
// Founder + outreach_agent. Returns recent research runs with a saved-lead count each.
// Used to refresh the run-history panel after a new run.

import { NextResponse } from 'next/server'
import { requireOutreachAccess } from '@/lib/auth/require-admin'
import { getResearchRuns } from '@/lib/data/admin-research'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  await requireOutreachAccess({ path: '/admin/mission-control/research-agent' })

  const { rows, migrationNeeded, error } = await getResearchRuns(15)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ ok: true, runs: rows, migrationNeeded })
}
