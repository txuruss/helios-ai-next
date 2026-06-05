// ── Founder-only reads: team roster (team_members) ─────────────────
//
// SECURITY: requireFounderAdmin() gates every call; service-role client
// used (read-only). RESILIENCE: if the allowed_tools column (migration
// 20260607120000) is not yet applied, we still return the roster and flag
// migrationNeeded rather than crashing.

import 'server-only'

import { requireFounderAdmin } from '@/lib/auth/require-admin'
import { createServiceRoleClient } from '@/lib/supabase/server'

export interface TeamMemberRow {
  id:            string
  email:         string
  full_name:     string | null
  role:          string
  status:        string
  allowed_tools: string[]
  created_at:    string
}

export interface TeamMembersResult {
  rows:            TeamMemberRow[]
  migrationNeeded: boolean   // true when allowed_tools (20260607120000) is missing
  error:           string | null
}

function isMissingTable(e: { code?: string; message?: string } | null): boolean {
  if (!e) return false
  if (e.code === '42P01') return true
  const m = (e.message ?? '').toLowerCase()
  return m.includes('relation') && m.includes('does not exist')
}

function isMissingColumn(e: { code?: string; message?: string } | null): boolean {
  if (!e) return false
  if (e.code === '42703') return true
  const m = (e.message ?? '').toLowerCase()
  return m.includes('column') && m.includes('does not exist')
}

const BASE_COLS = 'id, email, full_name, role, status, created_at'

function toRow(r: Record<string, unknown>): TeamMemberRow {
  return {
    id:            String(r.id ?? ''),
    email:         typeof r.email === 'string' ? r.email : '—',
    full_name:     typeof r.full_name === 'string' && r.full_name.length > 0 ? r.full_name : null,
    role:          typeof r.role === 'string' ? r.role : 'viewer',
    status:        typeof r.status === 'string' ? r.status : 'active',
    allowed_tools: Array.isArray(r.allowed_tools) ? r.allowed_tools.map(String) : [],
    created_at:    typeof r.created_at === 'string' ? r.created_at : new Date(0).toISOString(),
  }
}

// Full team roster, oldest first (founder row created first appears first).
export async function getTeamMembers(): Promise<TeamMembersResult> {
  await requireFounderAdmin({ path: '/admin/team' })

  const empty: TeamMembersResult = { rows: [], migrationNeeded: false, error: null }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ...empty, error: 'Server configuration error.' }
  }

  try {
    const db = createServiceRoleClient()

    // Prefer the full read (with allowed_tools).
    const full = await db
      .from('team_members')
      .select(`${BASE_COLS}, allowed_tools`)
      .order('created_at', { ascending: true })

    if (!full.error) {
      const rows = ((full.data ?? []) as Record<string, unknown>[]).map(toRow)
      return { rows, migrationNeeded: false, error: null }
    }

    if (isMissingTable(full.error)) return { rows: [], migrationNeeded: true, error: null }

    // allowed_tools not migrated yet — fall back to the base columns so the
    // roster still renders, and flag the missing migration.
    if (isMissingColumn(full.error)) {
      const base = await db
        .from('team_members')
        .select(BASE_COLS)
        .order('created_at', { ascending: true })
      if (base.error) {
        if (isMissingTable(base.error)) return { rows: [], migrationNeeded: true, error: null }
        throw base.error
      }
      const rows = ((base.data ?? []) as Record<string, unknown>[]).map(toRow)
      return { rows, migrationNeeded: true, error: null }
    }

    throw full.error
  } catch (err) {
    console.error('[getTeamMembers]', err instanceof Error ? err.message : err)
    return { ...empty, error: 'Could not load team members.' }
  }
}
