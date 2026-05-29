// ── Founder-only read: handoff readiness for a status change ───────
//
// Fetches the client + non-archived files + tasks and computes the
// deterministic handoff readiness. Read-only, never writes. Used when a
// status change is triggered from the Clients table (where files/tasks
// are not already loaded). Degrades gracefully if migrations are missing.

import 'server-only'

import { requireAdmin } from '@/lib/auth/require-admin'
import { createServiceRoleClient } from '@/lib/supabase/server'
import {
  getClientHandoffReadiness, type ClientHandoffReadiness,
  type ReadinessFile, type ReadinessTask,
} from '@/lib/admin/client-handoff-readiness'

export interface ClientReadinessResult {
  readiness: ClientHandoffReadiness | null
  error:     string | null   // soft message; activation is never blocked
}

function isMissing(e: { code?: string; message?: string } | null): boolean {
  if (!e) return false
  if (e.code === '42P01' || e.code === '42703') return true
  const m = (e.message ?? '').toLowerCase()
  return (m.includes('relation') || m.includes('column')) && m.includes('does not exist')
}

export async function getClientReadinessForStatusChange(
  clientId: string,
): Promise<ClientReadinessResult> {
  await requireAdmin({ path: '/admin/clients' })
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { readiness: null, error: 'Readiness data is unavailable.' }
  }

  try {
    const db = createServiceRoleClient()

    const clientRes = await db.from('admin_clients').select('*').eq('id', clientId).maybeSingle()
    if (clientRes.error) {
      if (isMissing(clientRes.error)) {
        return { readiness: null, error: 'Readiness data is unavailable until migrations are applied.' }
      }
      throw clientRes.error
    }
    if (!clientRes.data) return { readiness: null, error: 'Client not found.' }
    const c = clientRes.data as Record<string, unknown>

    // Files (non-archived). Missing table/columns → treat as no files + flag.
    let files: ReadinessFile[] = []
    let dataMissing = false
    const filesRes = await db
      .from('admin_client_files')
      .select('category, is_handoff')
      .eq('client_id', clientId)
      .is('archived_at', null)
    if (filesRes.error) {
      if (isMissing(filesRes.error)) dataMissing = true
      else throw filesRes.error
    } else {
      files = ((filesRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
        category:   typeof r.category === 'string' ? r.category : 'general',
        is_handoff: r.is_handoff === true,
      }))
    }

    // Tasks. Missing table → treat as no tasks + flag.
    let tasks: ReadinessTask[] = []
    const tasksRes = await db
      .from('admin_client_tasks')
      .select('status, due_date')
      .eq('client_id', clientId)
    if (tasksRes.error) {
      if (isMissing(tasksRes.error)) dataMissing = true
      else throw tasksRes.error
    } else {
      tasks = ((tasksRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
        status:   typeof r.status === 'string' ? r.status : 'todo',
        due_date: typeof r.due_date === 'string' ? r.due_date.slice(0, 10) : null,
      }))
    }

    const readiness = getClientHandoffReadiness(
      {
        payment_status:   typeof c.payment_status === 'string' ? c.payment_status : null,
        onboarding_stage: typeof c.onboarding_stage === 'string' ? c.onboarding_stage : null,
      },
      files,
      tasks,
    )

    return {
      readiness,
      error: dataMissing ? 'Readiness data is unavailable until migrations are applied.' : null,
    }
  } catch (err) {
    console.error('[getClientReadinessForStatusChange]', err instanceof Error ? err.message : err)
    return { readiness: null, error: 'Could not fully verify handoff readiness.' }
  }
}
