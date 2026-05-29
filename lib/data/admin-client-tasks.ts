// ── Founder-only reads: client onboarding tasks (admin_client_tasks) ─
//
// SECURITY: requireAdmin() gates every call; service-role client used.
// RESILIENCE: missing table → empty/zero with migrationNeeded flag, so
// the drawer and Mission Control never crash before the migration.

import 'server-only'

import { requireAdmin } from '@/lib/auth/require-admin'
import { createServiceRoleClient } from '@/lib/supabase/server'
import type { TaskStatus, TaskPriority, TaskCategory } from '@/lib/admin/onboarding-tasks'

export type { TaskStatus, TaskPriority, TaskCategory } from '@/lib/admin/onboarding-tasks'

export interface ClientTask {
  id:           string
  title:        string
  description:  string | null
  category:     TaskCategory
  status:       TaskStatus
  priority:     TaskPriority
  due_date:     string | null
  completed_at: string | null
  created_at:   string
}

export interface ClientTasksResult {
  rows:            ClientTask[]
  migrationNeeded: boolean
  error:           string | null
}

export interface ClientTaskStats {
  total:       number
  done:        number
  todo:        number
  in_progress: number
  blocked:     number
  dueSoon:     number
}

export interface OnboardingProgress {
  total:     number
  completed: number
  pct:       number   // 0–100
}

export interface ClientsOnboardingSummary {
  clientsOnboarding: number   // admin_clients status = 'onboarding'
  blockedTasks:      number
  dueSoonTasks:      number
  readyToGoLive:     number   // onboarding clients whose tasks are all done
  error:             string | null
}

function isMissingTable(e: { code?: string; message?: string } | null): boolean {
  if (!e) return false
  if (e.code === '42P01') return true
  const m = (e.message ?? '').toLowerCase()
  return m.includes('relation') && m.includes('does not exist')
}

function normStatus(v: unknown): TaskStatus {
  if (v === 'todo' || v === 'in_progress' || v === 'blocked' || v === 'done') return v
  return 'todo'
}
function normPriority(v: unknown): TaskPriority {
  if (v === 'low' || v === 'normal' || v === 'high' || v === 'urgent') return v
  return 'normal'
}
function normCategory(v: unknown): TaskCategory {
  if (
    v === 'onboarding' || v === 'setup' || v === 'automation' ||
    v === 'communication' || v === 'QA' || v === 'handoff' || v === 'support'
  ) return v
  return 'onboarding'
}
function dstr(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null
}

const TASK_COLS = 'id, title, description, category, status, priority, due_date, completed_at, created_at'

function toTask(r: Record<string, unknown>): ClientTask {
  return {
    id:           String(r.id ?? ''),
    title:        typeof r.title === 'string' ? r.title : '(untitled)',
    description:  dstr(r.description),
    category:     normCategory(r.category),
    status:       normStatus(r.status),
    priority:     normPriority(r.priority),
    due_date:     dstr(r.due_date) ? String(r.due_date).slice(0, 10) : null,
    completed_at: dstr(r.completed_at),
    created_at:   typeof r.created_at === 'string' ? r.created_at : new Date(0).toISOString(),
  }
}

export async function getClientTasks(clientId: string): Promise<ClientTasksResult> {
  await requireAdmin({ path: '/admin/clients' })
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { rows: [], migrationNeeded: false, error: 'Service role key not configured.' }
  }
  try {
    const db = createServiceRoleClient()
    const { data, error } = await db
      .from('admin_client_tasks')
      .select(TASK_COLS)
      .eq('client_id', clientId)
      .order('created_at', { ascending: true })
      .limit(300)

    if (error) {
      if (isMissingTable(error)) return { rows: [], migrationNeeded: true, error: null }
      throw error
    }
    return { rows: ((data ?? []) as Record<string, unknown>[]).map(toTask), migrationNeeded: false, error: null }
  } catch (err) {
    console.error('[getClientTasks]', err instanceof Error ? err.message : err)
    return { rows: [], migrationNeeded: false, error: 'Tasks are temporarily unavailable.' }
  }
}

const SOON_MS = 7 * 86_400_000

export function taskStatsFromRows(rows: ClientTask[]): ClientTaskStats {
  const today   = new Date().toISOString().slice(0, 10)
  const soonIso = new Date(Date.now() + SOON_MS).toISOString().slice(0, 10)
  const stats: ClientTaskStats = { total: rows.length, done: 0, todo: 0, in_progress: 0, blocked: 0, dueSoon: 0 }
  for (const t of rows) {
    if (t.status === 'done') stats.done += 1
    else if (t.status === 'todo') stats.todo += 1
    else if (t.status === 'in_progress') stats.in_progress += 1
    else if (t.status === 'blocked') stats.blocked += 1
    if (t.status !== 'done' && t.due_date && t.due_date >= today && t.due_date <= soonIso) stats.dueSoon += 1
  }
  return stats
}

export function progressFromRows(rows: ClientTask[]): OnboardingProgress {
  const total = rows.length
  const completed = rows.filter((t) => t.status === 'done').length
  return { total, completed, pct: total > 0 ? Math.round((completed / total) * 100) : 0 }
}

export async function getClientTaskStats(clientId: string): Promise<ClientTaskStats> {
  const { rows } = await getClientTasks(clientId)
  return taskStatsFromRows(rows)
}

export async function getOnboardingProgress(clientId: string): Promise<OnboardingProgress> {
  const { rows } = await getClientTasks(clientId)
  return progressFromRows(rows)
}

// Roll-up for Mission Control. All-zero (error: null) when tables are
// missing, so the page never breaks before the migration.
export async function getClientsOnboardingSummary(): Promise<ClientsOnboardingSummary> {
  await requireAdmin({ path: '/admin/mission-control' })

  const empty: ClientsOnboardingSummary = {
    clientsOnboarding: 0, blockedTasks: 0, dueSoonTasks: 0, readyToGoLive: 0, error: null,
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return empty

  try {
    const db = createServiceRoleClient()

    const clientsRes = await db
      .from('admin_clients')
      .select('id, status')
      .neq('status', 'archived')

    if (clientsRes.error) {
      if (isMissingTable(clientsRes.error)) return empty
      throw clientsRes.error
    }
    const clients = (clientsRes.data ?? []) as { id: string; status: string }[]
    const onboardingIds = new Set(clients.filter((c) => c.status === 'onboarding').map((c) => c.id))

    const tasksRes = await db
      .from('admin_client_tasks')
      .select('client_id, status, due_date')

    if (tasksRes.error) {
      // No tasks table yet → report onboarding count only.
      if (isMissingTable(tasksRes.error)) {
        return { ...empty, clientsOnboarding: onboardingIds.size }
      }
      throw tasksRes.error
    }

    const tasks = (tasksRes.data ?? []) as { client_id: string; status: string; due_date: string | null }[]
    const today   = new Date().toISOString().slice(0, 10)
    const soonIso = new Date(Date.now() + SOON_MS).toISOString().slice(0, 10)

    let blockedTasks = 0
    let dueSoonTasks = 0
    const perClient = new Map<string, { total: number; done: number }>()

    for (const t of tasks) {
      if (t.status === 'blocked') blockedTasks += 1
      if (t.status !== 'done' && t.due_date && t.due_date >= today && t.due_date <= soonIso) dueSoonTasks += 1

      const agg = perClient.get(t.client_id) ?? { total: 0, done: 0 }
      agg.total += 1
      if (t.status === 'done') agg.done += 1
      perClient.set(t.client_id, agg)
    }

    let readyToGoLive = 0
    for (const id of onboardingIds) {
      const agg = perClient.get(id)
      if (agg && agg.total > 0 && agg.done === agg.total) readyToGoLive += 1
    }

    return {
      clientsOnboarding: onboardingIds.size,
      blockedTasks,
      dueSoonTasks,
      readyToGoLive,
      error: null,
    }
  } catch (err) {
    console.error('[getClientsOnboardingSummary]', err instanceof Error ? err.message : err)
    return { ...empty, error: 'Onboarding summary unavailable.' }
  }
}
