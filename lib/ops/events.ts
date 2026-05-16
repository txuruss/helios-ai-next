// ── Ops event helpers — server-only ──────────────────────────────
// Fire-and-forget safe. Ops logging failures must never break
// the main user flow. All callers should use void or .catch().

import 'server-only'
import { createServiceRoleClient } from '@/lib/supabase/server'
import type { OpsTaskInput, OpsAlertInput, ApprovalInput } from '@/lib/validation/ops'

// Partial input — metadata is optional for convenience at call sites
export interface OpsEventInput {
  business_id?:   string
  source:         string
  event_type:     string
  severity?:      'info' | 'warning' | 'error' | 'critical'
  title:          string
  description?:   string
  related_table?: string
  related_id?:    string
  metadata?:      Record<string, unknown>
}

type DbClient = ReturnType<typeof createServiceRoleClient>

function getDb(): DbClient { return createServiceRoleClient() }

// ── Create ops event + trigger automation ─────────────────────────

export async function createOpsEvent(
  input: OpsEventInput,
  db?:   DbClient,
): Promise<void> {
  try {
    const client = db ?? getDb()
    const { data } = await client.from('ops_events').insert({
      business_id:   input.business_id ?? null,
      source:        input.source,
      event_type:    input.event_type,
      severity:      input.severity ?? 'info',
      title:         input.title,
      description:   input.description ?? null,
      related_table: input.related_table ?? null,
      related_id:    input.related_id ?? null,
      metadata:      input.metadata ?? {},
    }).select('id').single()

    const eventId = (data as { id: string } | null)?.id
    if (eventId) {
      // Fire-and-forget automation — dynamic import avoids circular dependency
      import('@/lib/ops/automation')
        .then(({ processOpsEvent }) => processOpsEvent(eventId, client))
        .catch(() => undefined)
    }
  } catch {
    // Silently swallow — ops logging must never affect main flow
  }
}

// ── Create ops task ───────────────────────────────────────────────

export async function createOpsTask(
  input: OpsTaskInput,
  db?:   DbClient,
): Promise<void> {
  try {
    const client = db ?? getDb()
    await client.from('ops_tasks').insert({
      business_id:   input.business_id ?? null,
      title:         input.title,
      description:   input.description ?? null,
      task_type:     input.task_type,
      priority:      input.priority ?? 'normal',
      related_table: input.related_table ?? null,
      related_id:    input.related_id ?? null,
      due_at:        input.due_at ?? null,
      metadata:      input.metadata ?? {},
    })
  } catch { /* silent */ }
}

// ── Create ops alert ──────────────────────────────────────────────

export async function createOpsAlert(
  input: OpsAlertInput,
  db?:   DbClient,
): Promise<void> {
  try {
    const client = db ?? getDb()
    await client.from('ops_alerts').insert({
      business_id:   input.business_id ?? null,
      alert_type:    input.alert_type,
      severity:      input.severity ?? 'warning',
      title:         input.title,
      message:       input.message ?? null,
      related_table: input.related_table ?? null,
      related_id:    input.related_id ?? null,
      metadata:      input.metadata ?? {},
    })
  } catch { /* silent */ }
}

// ── Create approval item ──────────────────────────────────────────

export async function createApprovalItem(
  input: ApprovalInput,
  db?:   DbClient,
): Promise<void> {
  try {
    const client = db ?? getDb()
    await client.from('approval_items').insert({
      business_id:   input.business_id ?? null,
      approval_type: input.approval_type,
      title:         input.title,
      description:   input.description ?? null,
      content:       input.content ?? null,
      requested_by:  input.requested_by ?? null,
      related_table: input.related_table ?? null,
      related_id:    input.related_id ?? null,
      priority:      input.priority ?? 'normal',
      source_table:  (input as { source_table?: string }).source_table ?? null,
      source_id:     (input as { source_id?: string }).source_id ?? null,
      metadata:      input.metadata ?? {},
    })
  } catch { /* silent */ }
}

// ── Status updaters ───────────────────────────────────────────────

export async function resolveOpsEvent(id: string, db?: DbClient): Promise<void> {
  try {
    const client = db ?? getDb()
    await client.from('ops_events')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('id', id)
  } catch { /* silent */ }
}

export async function acknowledgeOpsAlert(id: string, db?: DbClient): Promise<void> {
  try {
    const client = db ?? getDb()
    await client.from('ops_alerts')
      .update({ status: 'acknowledged', acknowledged_at: new Date().toISOString() })
      .eq('id', id)
  } catch { /* silent */ }
}

export async function completeOpsTask(id: string, db?: DbClient): Promise<void> {
  try {
    const client = db ?? getDb()
    await client.from('ops_tasks')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', id)
  } catch { /* silent */ }
}

export async function updateApprovalStatus(
  id:     string,
  status: 'approved' | 'rejected',
  userId: string,
  db?:    DbClient,
): Promise<void> {
  try {
    const client = db ?? getDb()
    await client.from('approval_items')
      .update({ status, reviewed_by: userId, reviewed_at: new Date().toISOString() })
      .eq('id', id)
  } catch { /* silent */ }
}
