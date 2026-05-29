// ── Founder-only reads: cross-client delivery board ────────────────
//
// Powers /admin/delivery — all onboarding tasks across all clients,
// joined with client name/plan, plus delivery KPIs.
//
// SECURITY: requireAdmin() gates the read; service-role client used.
// RESILIENCE: missing tables → empty data + migrationNeeded, never crash.
// Uses REAL admin_client_tasks / admin_clients data only.

import 'server-only'

import { requireAdmin } from '@/lib/auth/require-admin'
import { createServiceRoleClient } from '@/lib/supabase/server'
import type { TaskStatus, TaskPriority, TaskCategory } from '@/lib/admin/onboarding-tasks'

export type { TaskStatus, TaskPriority, TaskCategory } from '@/lib/admin/onboarding-tasks'

export type DeliveryDueFilter = 'all' | 'overdue' | 'due_today' | 'due_week' | 'no_due_date'

export interface AdminDeliveryTaskRow {
  id:                    string
  client_id:             string
  client_business_name:  string
  client_plan:           string
  client_payment_status: string | null
  title:                 string
  description:          string | null
  category:             TaskCategory
  status:               TaskStatus
  priority:             TaskPriority
  due_date:             string | null
  created_at:           string
}

export interface AdminDeliverySummary {
  overdueTasks:         number
  dueSoonTasks:         number
  blockedTasks:         number
  openTasks:            number
  clientsInOnboarding:  number
  readyToGoLiveClients: number
}

export interface AdminDeliveryData {
  tasks:           AdminDeliveryTaskRow[]
  summary:         AdminDeliverySummary
  migrationNeeded: boolean
  error:           string | null
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
  return typeof v === 'string' && v.length > 0 ? v.slice(0, 10) : null
}

const SOON_MS = 7 * 86_400_000

export async function getDeliveryData(): Promise<AdminDeliveryData> {
  await requireAdmin({ path: '/admin/delivery' })

  const empty: AdminDeliveryData = {
    tasks: [],
    summary: {
      overdueTasks: 0, dueSoonTasks: 0, blockedTasks: 0,
      openTasks: 0, clientsInOnboarding: 0, readyToGoLiveClients: 0,
    },
    migrationNeeded: false,
    error: null,
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ...empty, error: 'Service role key not configured.' }
  }

  try {
    const db = createServiceRoleClient()

    // select('*') keeps this resilient to optional columns (onboarding_stage,
    // payment_status) that depend on later migrations — missing columns just
    // come back undefined rather than erroring.
    const clientsRes = await db
      .from('admin_clients')
      .select('*')
      .neq('status', 'archived')

    if (clientsRes.error) {
      if (isMissingTable(clientsRes.error)) return empty   // pipeline not applied
      throw clientsRes.error
    }
    const clients = ((clientsRes.data ?? []) as Record<string, unknown>[]).map((c) => ({
      id:               String(c.id ?? ''),
      business_name:    typeof c.business_name === 'string' ? c.business_name : '(unknown)',
      plan:             typeof c.plan === 'string' ? c.plan : null,
      status:           typeof c.status === 'string' ? c.status : 'onboarding',
      onboarding_stage: typeof c.onboarding_stage === 'string' ? c.onboarding_stage : null,
      payment_status:   typeof c.payment_status === 'string' ? c.payment_status : null,
    }))
    const clientMap = new Map(clients.map((c) => [c.id, c]))

    // Clients in onboarding: status onboarding OR stage not complete/live.
    const clientsInOnboarding = clients.filter(
      (c) => c.status === 'onboarding' ||
        (c.onboarding_stage !== 'complete' && c.onboarding_stage !== 'live'),
    ).length

    const tasksRes = await db
      .from('admin_client_tasks')
      .select('id, client_id, title, description, category, status, priority, due_date, created_at')

    if (tasksRes.error) {
      if (isMissingTable(tasksRes.error)) {
        return { ...empty, summary: { ...empty.summary, clientsInOnboarding }, migrationNeeded: true }
      }
      throw tasksRes.error
    }

    const today   = new Date().toISOString().slice(0, 10)
    const soonIso = new Date(Date.now() + SOON_MS).toISOString().slice(0, 10)

    const tasks: AdminDeliveryTaskRow[] = ((tasksRes.data ?? []) as Record<string, unknown>[]).map((r) => {
      const cid = String(r.client_id ?? '')
      const c   = clientMap.get(cid)
      return {
        id:                   String(r.id ?? ''),
        client_id:            cid,
        client_business_name:  c?.business_name ?? '(unknown)',
        client_plan:           (c?.plan ?? '') || '',
        client_payment_status: c?.payment_status ?? null,
        title:                 typeof r.title === 'string' ? r.title : '(untitled)',
        description:          typeof r.description === 'string' && r.description ? r.description : null,
        category:             normCategory(r.category),
        status:               normStatus(r.status),
        priority:             normPriority(r.priority),
        due_date:             dstr(r.due_date),
        created_at:           typeof r.created_at === 'string' ? r.created_at : new Date(0).toISOString(),
      }
    })

    let overdue = 0, dueSoon = 0, blocked = 0, open = 0
    const perClient = new Map<string, { total: number; done: number }>()

    for (const t of tasks) {
      const o = t.status !== 'done'
      if (o) open += 1
      if (t.status === 'blocked') blocked += 1
      if (o && t.due_date && t.due_date < today) overdue += 1
      if (o && t.due_date && t.due_date >= today && t.due_date <= soonIso) dueSoon += 1

      const agg = perClient.get(t.client_id) ?? { total: 0, done: 0 }
      agg.total += 1
      if (t.status === 'done') agg.done += 1
      perClient.set(t.client_id, agg)
    }

    let ready = 0
    for (const c of clients) {
      if (c.status !== 'onboarding') continue
      const agg = perClient.get(c.id)
      if (agg && agg.total > 0 && agg.done === agg.total) ready += 1
    }

    return {
      tasks,
      summary: {
        overdueTasks: overdue,
        dueSoonTasks: dueSoon,
        blockedTasks: blocked,
        openTasks: open,
        clientsInOnboarding,
        readyToGoLiveClients: ready,
      },
      migrationNeeded: false,
      error: null,
    }
  } catch (err) {
    console.error('[getDeliveryData]', err instanceof Error ? err.message : err)
    return { ...empty, error: 'Delivery board is temporarily unavailable.' }
  }
}
