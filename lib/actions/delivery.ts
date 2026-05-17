'use server'

import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { captureApiError } from '@/lib/logging/api'
import { capture } from '@/lib/analytics/posthog'
import {
  updateDeliveryTaskSchema,
  DEFAULT_DELIVERY_TASKS,
  type DeliveryTaskStatus,
} from '@/lib/validation/delivery'

type DbRow = Record<string, unknown>

async function requireAuth(): Promise<
  { ok: true; userId: string; businessId: string } |
  { ok: false; error: string }
> {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated.' }
  const db = createServiceRoleClient()
  const { data: membership } = await db
    .from('business_members').select('business_id').eq('user_id', user.id).limit(1).single()
  if (!membership) return { ok: false, error: 'No business found.' }
  return { ok: true, userId: user.id, businessId: (membership as DbRow).business_id as string }
}

// ── Types ─────────────────────────────────────────────────────────

export interface DeliveryTask {
  id:             string
  business_id:    string
  intake_id:      string | null
  title:          string
  description:    string | null
  category:       string
  status:         DeliveryTaskStatus
  priority:       string
  assigned_to:    string | null
  due_at:         string | null
  completed_at:   string | null
  blocked_reason: string | null
  created_at:     string
  updated_at:     string
}

export interface DeliveryProgress {
  total:       number
  completed:   number
  blocked:     number
  in_progress: number
  pending:     number
  skipped:     number
  percent:     number
  launchReady: boolean
}

// ── Get tasks ─────────────────────────────────────────────────────

export async function getDeliveryTasks(): Promise<{
  tasks:    DeliveryTask[]
  progress: DeliveryProgress
  error:    string | null
}> {
  const EMPTY = { tasks: [], progress: emptyProgress(), error: null }
  const auth = await requireAuth()
  if (!auth.ok) return { ...EMPTY, error: auth.error }
  const db = createServiceRoleClient()

  try {
    const { data, error } = await db
      .from('client_delivery_tasks')
      .select('*')
      .eq('business_id', auth.businessId)
      .order('created_at', { ascending: true })
    if (error) throw error
    const tasks = (data ?? []) as DeliveryTask[]
    return { tasks, progress: computeProgress(tasks), error: null }
  } catch (err) {
    captureApiError(err, { route: 'actions/delivery', error_type: 'get_tasks_error', business_id: auth.businessId })
    return { ...EMPTY, error: 'Could not load delivery tasks.' }
  }
}

// ── Create default tasks (idempotent) ─────────────────────────────

export async function createDefaultDeliveryTasks(
  intakeId?: string,
): Promise<{ created: number; error?: string }> {
  const auth = await requireAuth()
  if (!auth.ok) return { created: 0, error: auth.error }
  const db = createServiceRoleClient()

  try {
    // Check how many already exist
    const { count: existing } = await db.from('client_delivery_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', auth.businessId)

    if ((existing ?? 0) >= DEFAULT_DELIVERY_TASKS.length) {
      return { created: 0 } // already seeded
    }

    const rows = DEFAULT_DELIVERY_TASKS.map((t) => ({
      business_id: auth.businessId,
      intake_id:   intakeId ?? null,
      title:       t.title,
      description: t.description,
      category:    t.category,
      priority:    t.priority,
      status:      'pending',
    }))

    await db.from('client_delivery_tasks').insert(rows)

    capture('delivery_tasks_created', { count: rows.length })
    return { created: rows.length }
  } catch (err) {
    captureApiError(err, { route: 'actions/delivery', error_type: 'create_tasks_error', business_id: auth.businessId })
    return { created: 0, error: 'Could not create delivery tasks.' }
  }
}

// ── Update task status ────────────────────────────────────────────

export async function updateDeliveryTaskStatus(
  id:             string,
  status:         DeliveryTaskStatus,
  blockedReason?: string,
): Promise<{ success?: string; error?: string }> {
  const parsed = updateDeliveryTaskSchema.safeParse({ id, status, blocked_reason: blockedReason })
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Invalid input.' }

  if (status === 'blocked' && !blockedReason?.trim()) {
    return { error: 'A reason is required when marking a task as blocked.' }
  }

  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const db = createServiceRoleClient()

  try {
    const { data: existing } = await db.from('client_delivery_tasks')
      .select('category, title').eq('id', id).eq('business_id', auth.businessId).single()
    if (!existing) return { error: 'Task not found.' }
    const e = existing as DbRow

    await db.from('client_delivery_tasks').update({
      status,
      blocked_reason: status === 'blocked' ? (blockedReason ?? null) : null,
      completed_at:   status === 'completed' ? new Date().toISOString() : null,
      updated_at:     new Date().toISOString(),
    }).eq('id', id).eq('business_id', auth.businessId)

    // Ops event (fire-and-forget)
    void import('@/lib/ops/events').then(({ createOpsEvent }) =>
      createOpsEvent({
        business_id: auth.businessId,
        source:      'delivery',
        event_type:  `delivery_task_${status}`,
        severity:    status === 'blocked' ? 'warning' : 'info',
        title:       `Delivery task ${status}: ${(e.title as string).slice(0, 60)}`,
        metadata:    { category: e.category },
      }, db)
    ).catch(() => undefined)

    capture(`delivery_task_${status}`, { category: e.category as string })

    return { success: `Task marked as ${status}.` }
  } catch (err) {
    captureApiError(err, { route: 'actions/delivery', error_type: 'update_task_error', business_id: auth.businessId })
    return { error: 'Could not update task.' }
  }
}

// ── Approve launch ────────────────────────────────────────────────

export async function approveDeliveryLaunch(): Promise<{ success?: string; error?: string }> {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const db = createServiceRoleClient()

  try {
    // Mark all QA and launch tasks complete if not already done
    const { data: launchTask } = await db.from('client_delivery_tasks')
      .select('id').eq('business_id', auth.businessId).eq('category', 'launch').single()
    if (launchTask) {
      await db.from('client_delivery_tasks').update({
        status:       'completed',
        completed_at: new Date().toISOString(),
        updated_at:   new Date().toISOString(),
      }).eq('id', (launchTask as { id: string }).id)
    }

    // Mark onboarding intake as approved
    await db.from('client_onboarding_intake').update({
      status:      'approved',
      reviewed_at: new Date().toISOString(),
      updated_at:  new Date().toISOString(),
    }).eq('business_id', auth.businessId)

    void import('@/lib/ops/events').then(({ createOpsEvent }) =>
      createOpsEvent({
        business_id: auth.businessId,
        source:      'delivery',
        event_type:  'launch_approved',
        severity:    'info',
        title:       'Client delivery launch approved',
        metadata:    {},
      }, db)
    ).catch(() => undefined)

    capture('launch_approved', { source: 'delivery' })

    return { success: 'Launch approved! Delivery pipeline complete.' }
  } catch (err) {
    captureApiError(err, { route: 'actions/delivery', error_type: 'approve_launch_error', business_id: auth.businessId })
    return { error: 'Could not approve launch.' }
  }
}

// ── Get delivery progress ─────────────────────────────────────────

export async function getDeliveryProgress(): Promise<{
  progress: DeliveryProgress
  error:    string | null
}> {
  const auth = await requireAuth()
  if (!auth.ok) return { progress: emptyProgress(), error: auth.error }
  const db = createServiceRoleClient()

  try {
    const { data } = await db.from('client_delivery_tasks')
      .select('status').eq('business_id', auth.businessId)
    const tasks = (data ?? []) as { status: DeliveryTaskStatus }[]
    return { progress: computeProgress(tasks as DeliveryTask[]), error: null }
  } catch {
    return { progress: emptyProgress(), error: null }
  }
}

// ── Helpers ───────────────────────────────────────────────────────

function emptyProgress(): DeliveryProgress {
  return { total: 0, completed: 0, blocked: 0, in_progress: 0, pending: 0, skipped: 0, percent: 0, launchReady: false }
}

function computeProgress(tasks: Pick<DeliveryTask, 'status'>[]): DeliveryProgress {
  const total       = tasks.length
  const completed   = tasks.filter((t) => t.status === 'completed').length
  const blocked     = tasks.filter((t) => t.status === 'blocked').length
  const in_progress = tasks.filter((t) => t.status === 'in_progress').length
  const pending     = tasks.filter((t) => t.status === 'pending').length
  const skipped     = tasks.filter((t) => t.status === 'skipped').length
  const done        = completed + skipped
  const percent     = total > 0 ? Math.round((done / total) * 100) : 0
  const launchReady = total > 0 && blocked === 0 && percent >= 80
  return { total, completed, blocked, in_progress, pending, skipped, percent, launchReady }
}
