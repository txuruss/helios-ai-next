'use server'

// ── Founder admin actions: client CRM (admin_clients) ──────────────
//
// Server actions behind the /admin/clients row actions. Every action
// re-derives founder identity via requireAdmin(), uses the service-role
// client, validates the id as a UUID, and revalidates affected routes.
//
// SAFETY
//   • No hard deletes. Archive sets status='archived' + archived_at.
//   • Missing pipeline table degrades to a clear, user-safe error.

import { requireAdmin } from '@/lib/auth/require-admin'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { feesForPlan, isAdminPlan, type AdminPlan } from '@/lib/admin/plan-pricing'

export interface AdminClientActionResult {
  ok:     boolean
  error?: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const CLIENT_STATUSES = ['active', 'onboarding', 'paused', 'churned'] as const
type ClientStatus = (typeof CLIENT_STATUSES)[number]

function validId(raw: unknown): string | null {
  return typeof raw === 'string' && UUID_RE.test(raw) ? raw : null
}

function isMissingTable(e: { code?: string; message?: string } | null): boolean {
  if (!e) return false
  if (e.code === '42P01') return true
  const m = (e.message ?? '').toLowerCase()
  return m.includes('relation') && m.includes('does not exist')
}

const MIGRATION_HINT =
  'Pipeline tables not found. Apply migration 20260528120000_create_admin_pipeline.sql in Supabase, then retry.'

function guardServiceRole(): AdminClientActionResult | null {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[admin-clients] SUPABASE_SERVICE_ROLE_KEY missing')
    return { ok: false, error: 'Server configuration error.' }
  }
  return null
}

function revalidate() {
  revalidatePath('/admin/clients')
  revalidatePath('/admin/mission-control')
}

// ── Archive a client (soft) ────────────────────────────────────────
export async function archiveClient(clientId: string): Promise<AdminClientActionResult> {
  await requireAdmin({ path: '/admin/clients' })

  const id = validId(clientId)
  if (!id) return { ok: false, error: 'Invalid client id.' }

  const guard = guardServiceRole()
  if (guard) return guard

  const db = createServiceRoleClient()
  const { error } = await db
    .from('admin_clients')
    .update({ status: 'archived', archived_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    if (isMissingTable(error)) return { ok: false, error: MIGRATION_HINT }
    console.error('[archiveClient]', error.message, '| code:', error.code)
    return { ok: false, error: 'Could not archive client. Try again.' }
  }

  revalidate()
  return { ok: true }
}

// ── Update client status (e.g. Mark paused, Reactivate) ────────────
export async function updateClientStatus(
  clientId: string,
  status:   ClientStatus,
): Promise<AdminClientActionResult> {
  await requireAdmin({ path: '/admin/clients' })

  const id = validId(clientId)
  if (!id) return { ok: false, error: 'Invalid client id.' }
  if (!CLIENT_STATUSES.includes(status)) return { ok: false, error: 'Invalid status.' }

  const guard = guardServiceRole()
  if (guard) return guard

  const db = createServiceRoleClient()
  const { error } = await db.from('admin_clients').update({ status }).eq('id', id)

  if (error) {
    if (isMissingTable(error)) return { ok: false, error: MIGRATION_HINT }
    console.error('[updateClientStatus]', error.message, '| code:', error.code)
    return { ok: false, error: 'Could not update client status. Try again.' }
  }

  revalidate()
  return { ok: true }
}

// ── Update client plan (re-defaults fees from the new plan) ────────
// Fees remain editable; this convenience action resets them to the
// plan's standard rate when the plan changes.
export async function updateClientPlan(
  clientId: string,
  plan:     AdminPlan,
): Promise<AdminClientActionResult> {
  await requireAdmin({ path: '/admin/clients' })

  const id = validId(clientId)
  if (!id) return { ok: false, error: 'Invalid client id.' }
  if (!isAdminPlan(plan)) return { ok: false, error: 'Invalid plan.' }

  const guard = guardServiceRole()
  if (guard) return guard

  const fees = feesForPlan(plan)
  const db = createServiceRoleClient()
  const { error } = await db
    .from('admin_clients')
    .update({ plan, setup_fee: fees.setup_fee, monthly_fee: fees.monthly_fee })
    .eq('id', id)

  if (error) {
    if (isMissingTable(error)) return { ok: false, error: MIGRATION_HINT }
    console.error('[updateClientPlan]', error.message, '| code:', error.code)
    return { ok: false, error: 'Could not update client plan. Try again.' }
  }

  revalidate()
  return { ok: true }
}
