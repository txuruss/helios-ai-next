// ── Founder-only reads: client launch readiness ───────────────────
//
// Cross-client launch-control view. Combines admin_clients +
// admin_client_files + admin_client_tasks and the deterministic handoff
// readiness helper. READ-ONLY — never writes, never changes status.
//
// RESILIENCE: missing files/tasks tables → empty data + migrationNeeded
// flags (payment/status still evaluated). Never crashes.

import 'server-only'

import { requireAdmin } from '@/lib/auth/require-admin'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { type ClientHandoffReadiness, type ReadinessFile, type ReadinessTask } from '@/lib/admin/client-handoff-readiness'
import { deriveLaunchState, type LaunchState } from '@/lib/admin/launch-state'

export type { LaunchState } from '@/lib/admin/launch-state'

export interface LaunchReadinessRow {
  id:             string
  business_name:  string
  contact_name:   string | null
  email:          string | null
  plan:           string
  status:         string            // lifecycle status
  payment_status: string | null
  hasHandoffDoc:  boolean
  hasBrandAssets: boolean
  hasSetupDoc:    boolean
  taskTotal:      number
  taskDone:       number
  taskOpen:       number
  taskBlocked:    number
  taskOverdue:    number
  readiness:      ClientHandoffReadiness
  launchState:    LaunchState
  nextAction:     string
}

export interface LaunchReadinessSummary {
  readyToLaunch:       number
  missingFiles:        number
  missingPayment:      number
  incompleteOnboarding: number
  blockedByTasks:      number
  activeClients:       number
}

export interface LaunchReadinessData {
  rows:                 LaunchReadinessRow[]
  summary:              LaunchReadinessSummary
  filesMigrationNeeded: boolean
  tasksMigrationNeeded: boolean
  error:                string | null
}

function isMissing(e: { code?: string; message?: string } | null): boolean {
  if (!e) return false
  if (e.code === '42P01' || e.code === '42703') return true
  const m = (e.message ?? '').toLowerCase()
  return (m.includes('relation') || m.includes('column')) && m.includes('does not exist')
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null
}

export async function getLaunchReadinessData(): Promise<LaunchReadinessData> {
  await requireAdmin({ path: '/admin/launch-readiness' })

  const empty: LaunchReadinessData = {
    rows: [],
    summary: { readyToLaunch: 0, missingFiles: 0, missingPayment: 0, incompleteOnboarding: 0, blockedByTasks: 0, activeClients: 0 },
    filesMigrationNeeded: false,
    tasksMigrationNeeded: false,
    error: null,
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { ...empty, error: 'Service role key not configured.' }

  try {
    const db = createServiceRoleClient()

    // Launch-relevant clients only: onboarding / active / paused.
    const clientsRes = await db.from('admin_clients').select('*').neq('status', 'archived')
    if (clientsRes.error) {
      if (isMissing(clientsRes.error)) return empty
      throw clientsRes.error
    }
    const clients = ((clientsRes.data ?? []) as Record<string, unknown>[])
      .filter((c) => {
        const s = typeof c.status === 'string' ? c.status : ''
        return s === 'onboarding' || s === 'active' || s === 'paused'
      })

    // Files grouped by client (non-archived).
    let filesMigrationNeeded = false
    const filesByClient = new Map<string, ReadinessFile[]>()
    const filesRes = await db
      .from('admin_client_files')
      .select('client_id, category, is_handoff')
      .is('archived_at', null)
    if (filesRes.error) {
      if (isMissing(filesRes.error)) filesMigrationNeeded = true
      else throw filesRes.error
    } else {
      for (const r of (filesRes.data ?? []) as Record<string, unknown>[]) {
        const cid = String(r.client_id ?? '')
        const arr = filesByClient.get(cid) ?? []
        arr.push({ category: typeof r.category === 'string' ? r.category : 'general', is_handoff: r.is_handoff === true })
        filesByClient.set(cid, arr)
      }
    }

    // Tasks grouped by client.
    let tasksMigrationNeeded = false
    const tasksByClient = new Map<string, ReadinessTask[]>()
    const tasksRes = await db.from('admin_client_tasks').select('client_id, status, due_date')
    if (tasksRes.error) {
      if (isMissing(tasksRes.error)) tasksMigrationNeeded = true
      else throw tasksRes.error
    } else {
      for (const r of (tasksRes.data ?? []) as Record<string, unknown>[]) {
        const cid = String(r.client_id ?? '')
        const arr = tasksByClient.get(cid) ?? []
        arr.push({ status: typeof r.status === 'string' ? r.status : 'todo', due_date: typeof r.due_date === 'string' ? r.due_date.slice(0, 10) : null })
        tasksByClient.set(cid, arr)
      }
    }

    const rows: LaunchReadinessRow[] = []
    const summary: LaunchReadinessSummary = {
      readyToLaunch: 0, missingFiles: 0, missingPayment: 0, incompleteOnboarding: 0, blockedByTasks: 0, activeClients: 0,
    }

    for (const c of clients) {
      const id = String(c.id ?? '')
      const status = typeof c.status === 'string' ? c.status : 'onboarding'
      const payment_status = str(c.payment_status)
      const files = filesByClient.get(id) ?? []
      const tasks = tasksByClient.get(id) ?? []

      const d = deriveLaunchState(
        { payment_status, onboarding_stage: str(c.onboarding_stage), status },
        files,
        tasks,
      )

      rows.push({
        id,
        business_name:  typeof c.business_name === 'string' ? c.business_name : '(unknown)',
        contact_name:   str(c.contact_name),
        email:          str(c.email),
        plan:           typeof c.plan === 'string' ? c.plan : '',
        status,
        payment_status,
        hasHandoffDoc:  d.hasHandoffDoc,
        hasBrandAssets: d.hasBrandAssets,
        hasSetupDoc:    d.hasSetupDoc,
        taskTotal:      d.taskTotal,
        taskDone:       d.taskDone,
        taskOpen:       d.taskOpen,
        taskBlocked:    d.taskBlocked,
        taskOverdue:    d.taskOverdue,
        readiness:      d.readiness,
        launchState:    d.launchState,
        nextAction:     d.nextAction,
      })

      // KPIs.
      if (status === 'active') {
        summary.activeClients += 1
      } else {
        if (d.launchState === 'ready') summary.readyToLaunch += 1
        if (!(d.hasHandoffDoc && d.hasBrandAssets && d.hasSetupDoc)) summary.missingFiles += 1
        if (payment_status === 'unpaid' || payment_status === 'overdue') summary.missingPayment += 1
        if (d.taskTotal > 0 && d.taskOpen > 0) summary.incompleteOnboarding += 1
        if (d.taskBlocked > 0 || d.taskOverdue > 0) summary.blockedByTasks += 1
      }
    }

    return { rows, summary, filesMigrationNeeded, tasksMigrationNeeded, error: null }
  } catch (err) {
    console.error('[getLaunchReadinessData]', err instanceof Error ? err.message : err)
    return { ...empty, error: 'Launch readiness is temporarily unavailable.' }
  }
}
