// GET /api/research-agent/leads/saved
//
// Founder-only. Returns all saved research leads (is_saved=true, not
// archived) across runs, de-duplicated, newest-saved first.

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { getSavedResearchLeads } from '@/lib/data/admin-research'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  await requireAdmin({ path: '/admin/mission-control/research-agent' })

  const { rows, migrationNeeded, error } = await getSavedResearchLeads()
  if (error) return NextResponse.json({ ok: false, error }, { status: 500 })
  return NextResponse.json({ ok: true, leads: rows, migrationNeeded })
}
