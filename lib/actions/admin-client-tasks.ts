'use server'

// ── Founder admin actions: client onboarding tasks ─────────────────
//
// Behind the onboarding checklist in the client detail drawer. Every
// action re-derives founder identity (requireAdmin), uses the service
// role client, validates IDs/enums/lengths, and revalidates affected
// routes. No hard deletes — task removal would use a status pattern.

import { requireAdmin } from '@/lib/auth/require-admin'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getClientTasks } from '@/lib/data/admin-client-tasks'
import { seedDefaultTasksFor } from '@/lib/admin/onboarding-tasks'

export interface TaskActionResult {
  ok:      boolean
  error?:  string
  warning?: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const STATUSES   = ['todo', 'in_progress', 'blocked', 'done'] as const
const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const
const CATEGORIES = ['onboarding', 'setup', 'automation', 'communication', 'QA', 'handoff', 'support'] as const

const MIGRATION_HINT =
  'Apply the onboarding tasks migration (20260531120000_add_admin_client_tasks.sql) to enable client task tracking.'

function validId(raw: unknown): string | null {
  return typeof raw === 'string' && UUID_RE.test(raw) ? raw : null
}
function isMissingTable(e: { code?: string; message?: string } | null): boolean {
  if (!e) return false
  if (e.code === '42P01') return true
  const m = (e.message ?? '').toLowerCase()
  return m.includes('relation') && m.includes('does not exist')
}
function guardServiceRole(): TaskActionResult | null {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[admin-client-tasks] SUPABASE_SERVICE_ROLE_KEY missing')
    return { ok: false, error: 'Server configuration error.' }
  }
  return null
}
// '' → null (clear); valid date → string; invalid → undefined (reject)
function parseDate(raw: string | null | undefined): string | null | undefined {
  if (raw === null || raw === undefined) return null
  const t = raw.trim()
  if (t === '') return null
  if (!DATE_RE.test(t) || Number.isNaN(Date.parse(t))) return undefined
  return t
}
function cleanText(raw: string | null | undefined, max: number): string | null {
  if (typeof raw !== 'string') return null
  const t = raw.trim()
  return t.length === 0 ? null : t.slice(0, max)
}
function revalidate() {
  revalidatePath('/admin/clients')
  revalidatePath('/admin/delivery')
  revalidatePath('/admin/mission-control')
}

// ── Read wrapper (callable from the client drawer) ─────────────────
export async function loadClientTasks(clientId: string) {
  const id = validId(clientId)
  if (!id) return { rows: [], migrationNeeded: false, error: 'Invalid client id.' }
  return getClientTasks(id)
}

// ── Seed the default checklist (idempotent) ────────────────────────
export async function seedDefaultClientTasks(clientId: string): Promise<TaskActionResult> {
  await requireAdmin({ path: '/admin/clients' })
  const id = validId(clientId)
  if (!id) return { ok: false, error: 'Invalid client id.' }

  const guard = guardServiceRole()
  if (guard) return guard

  const db = createServiceRoleClient()

  // Look up the client's plan so the checklist matches their plan.
  const clientRow = await db.from('admin_clients').select('plan').eq('id', id).maybeSingle()
  const plan = !clientRow.error && clientRow.data && typeof clientRow.data.plan === 'string'
    ? clientRow.data.plan
    : null

  const res = await seedDefaultTasksFor(db, id, plan)

  if (res.missingTable) return { ok: false, error: MIGRATION_HINT }
  if (res.error)        return { ok: false, error: 'Could not create the default checklist. Try again.' }
  if (res.skipped)      return { ok: true, warning: 'Checklist already exists for this client.' }

  revalidate()
  return { ok: true }
}

// ── Rebuild checklist (future-safe; non-destructive for now) ───────
// Reserved for a future "rebuild to match plan" flow. Today it ONLY
// seeds when the client has no tasks — it never deletes or replaces
// existing tasks (no hard deletes). Existing clients keep their tasks.
export async function rebuildClientChecklist(clientId: string): Promise<TaskActionResult> {
  await requireAdmin({ path: '/admin/clients' })
  const id = validId(clientId)
  if (!id) return { ok: false, error: 'Invalid client id.' }

  const guard = guardServiceRole()
  if (guard) return guard

  const db = createServiceRoleClient()

  const existing = await db.from('admin_client_tasks').select('id').eq('client_id', id).limit(1)
  if (existing.error) {
    if (isMissingTable(existing.error)) return { ok: false, error: MIGRATION_HINT }
    console.error('[rebuildClientChecklist]', existing.error.message)
    return { ok: false, error: 'Could not read existing tasks. Try again.' }
  }
  if (existing.data && existing.data.length > 0) {
    // Destructive replacement is intentionally NOT enabled yet.
    return { ok: false, error: 'This client already has tasks. Destructive checklist rebuild is not enabled — existing tasks are preserved.' }
  }

  // No tasks → safe to seed the plan template.
  return seedDefaultClientTasks(id)
}

// ── Create a task ──────────────────────────────────────────────────
export interface CreateTaskInput {
  title:        string
  description?: string | null
  category?:    string
  priority?:    string
  due_date?:    string | null
}

export async function createClientTask(clientId: string, input: CreateTaskInput): Promise<TaskActionResult> {
  await requireAdmin({ path: '/admin/clients' })
  const id = validId(clientId)
  if (!id) return { ok: false, error: 'Invalid client id.' }

  const title = typeof input.title === 'string' ? input.title.trim() : ''
  if (title.length === 0)  return { ok: false, error: 'Task title is required.' }
  if (title.length > 200)  return { ok: false, error: 'Task title is too long (max 200).' }

  const category = CATEGORIES.includes(input.category as (typeof CATEGORIES)[number]) ? input.category : 'onboarding'
  const priority = PRIORITIES.includes(input.priority as (typeof PRIORITIES)[number]) ? input.priority : 'normal'
  const due = parseDate(input.due_date)
  if (due === undefined) return { ok: false, error: 'Invalid due date.' }

  const guard = guardServiceRole()
  if (guard) return guard

  const db = createServiceRoleClient()
  const { error } = await db.from('admin_client_tasks').insert({
    client_id:   id,
    title:       title.slice(0, 200),
    description: cleanText(input.description, 4000),
    category, priority, status: 'todo', due_date: due,
  })

  if (error) {
    if (isMissingTable(error)) return { ok: false, error: MIGRATION_HINT }
    console.error('[createClientTask]', error.message, '| code:', error.code)
    return { ok: false, error: 'Could not create task. Try again.' }
  }
  revalidate()
  return { ok: true }
}

// ── Update a task ──────────────────────────────────────────────────
export interface UpdateTaskInput {
  title?:       string
  description?: string | null
  status?:      string
  category?:    string
  priority?:    string
  due_date?:    string | null
}

export async function updateClientTask(taskId: string, input: UpdateTaskInput): Promise<TaskActionResult> {
  await requireAdmin({ path: '/admin/clients' })
  const id = validId(taskId)
  if (!id) return { ok: false, error: 'Invalid task id.' }

  const update: Record<string, unknown> = {}

  if (input.title !== undefined) {
    const title = input.title.trim()
    if (title.length === 0) return { ok: false, error: 'Task title is required.' }
    if (title.length > 200) return { ok: false, error: 'Task title is too long (max 200).' }
    update.title = title.slice(0, 200)
  }
  if (input.description !== undefined) update.description = cleanText(input.description, 4000)
  if (input.category !== undefined) {
    if (!CATEGORIES.includes(input.category as (typeof CATEGORIES)[number])) return { ok: false, error: 'Invalid category.' }
    update.category = input.category
  }
  if (input.priority !== undefined) {
    if (!PRIORITIES.includes(input.priority as (typeof PRIORITIES)[number])) return { ok: false, error: 'Invalid priority.' }
    update.priority = input.priority
  }
  if (input.due_date !== undefined) {
    const due = parseDate(input.due_date)
    if (due === undefined) return { ok: false, error: 'Invalid due date.' }
    update.due_date = due
  }
  if (input.status !== undefined) {
    if (!STATUSES.includes(input.status as (typeof STATUSES)[number])) return { ok: false, error: 'Invalid status.' }
    update.status = input.status
    update.completed_at = input.status === 'done' ? new Date().toISOString() : null
  }

  if (Object.keys(update).length === 0) return { ok: true }

  const guard = guardServiceRole()
  if (guard) return guard

  const db = createServiceRoleClient()
  const { error } = await db.from('admin_client_tasks').update(update).eq('id', id)

  if (error) {
    if (isMissingTable(error)) return { ok: false, error: MIGRATION_HINT }
    console.error('[updateClientTask]', error.message, '| code:', error.code)
    return { ok: false, error: 'Could not update task. Try again.' }
  }
  revalidate()
  return { ok: true }
}

// ── Complete / reopen shortcuts ────────────────────────────────────
export async function completeClientTask(taskId: string): Promise<TaskActionResult> {
  return updateClientTask(taskId, { status: 'done' })
}
export async function reopenClientTask(taskId: string): Promise<TaskActionResult> {
  return updateClientTask(taskId, { status: 'todo' })
}

// ── Bulk status update (Delivery board) ────────────────────────────
// No hard deletes — status changes only. Validates every id + the
// target status. Partial failures are reported but never roll back.
export interface BulkTaskResult extends TaskActionResult {
  updated?: number
}

export async function bulkUpdateClientTasks(
  taskIds: unknown[],
  status:  string,
): Promise<BulkTaskResult> {
  await requireAdmin({ path: '/admin/delivery' })

  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return { ok: false, error: 'No tasks selected.' }
  }
  if (!STATUSES.includes(status as (typeof STATUSES)[number])) {
    return { ok: false, error: 'Invalid status.' }
  }
  const ids = taskIds.filter((v): v is string => typeof v === 'string' && UUID_RE.test(v))
  if (ids.length === 0)  return { ok: false, error: 'Invalid task IDs.' }
  if (ids.length > 100)  return { ok: false, error: 'Too many tasks selected at once (max 100).' }

  const guard = guardServiceRole()
  if (guard) return guard

  const db = createServiceRoleClient()
  const { error, count } = await db
    .from('admin_client_tasks')
    .update(
      { status, completed_at: status === 'done' ? new Date().toISOString() : null },
      { count: 'exact' },
    )
    .in('id', ids)

  if (error) {
    if (isMissingTable(error)) return { ok: false, error: MIGRATION_HINT }
    console.error('[bulkUpdateClientTasks]', error.message, '| code:', error.code)
    return { ok: false, error: 'Could not update the selected tasks. Try again.' }
  }

  revalidate()
  return { ok: true, updated: count ?? ids.length }
}
