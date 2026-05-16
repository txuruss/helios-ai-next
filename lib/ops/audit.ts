// ── Ops audit trail — server-only ─────────────────────────────────
// Fire-and-forget safe. Audit failures must never affect primary flows.
// Stores only safe metadata — no raw payloads, no API keys, no full messages.

import 'server-only'
import { createServiceRoleClient } from '@/lib/supabase/server'

type DbClient = ReturnType<typeof createServiceRoleClient>
type DbRow    = Record<string, unknown>

export interface AuditLogParams {
  businessId:   string | null
  actorUserId?: string | null
  actorLabel?:  string
  action:       string
  targetTable:  string
  targetId?:    string
  beforeState?: Record<string, unknown> | null
  afterState?:  Record<string, unknown> | null
  metadata?:    Record<string, unknown>
}

export interface AuditTrailRow {
  id:            string
  business_id:   string | null
  actor_user_id: string | null
  actor_label:   string | null
  action:        string
  target_table:  string
  target_id:     string | null
  before_state:  Record<string, unknown> | null
  after_state:   Record<string, unknown> | null
  metadata:      Record<string, unknown>
  created_at:    string
}

// ── Create audit log ──────────────────────────────────────────────

export async function createOpsAuditLog(
  params: AuditLogParams,
  db?:    DbClient,
): Promise<void> {
  try {
    const client = db ?? createServiceRoleClient()
    await client.from('ops_audit_trail').insert({
      business_id:   params.businessId ?? null,
      actor_user_id: params.actorUserId ?? null,
      actor_label:   params.actorLabel ?? null,
      action:        params.action,
      target_table:  params.targetTable,
      target_id:     params.targetId ?? null,
      before_state:  params.beforeState ?? null,
      after_state:   params.afterState ?? null,
      metadata:      params.metadata ?? {},
    })
  } catch { /* silent */ }
}

// ── Audit status change ───────────────────────────────────────────

export async function auditStatusChange(params: {
  businessId:  string
  userId:      string
  table:       string
  targetId:    string
  beforeStatus: string
  afterStatus:  string
  db?:         DbClient
}): Promise<void> {
  await createOpsAuditLog({
    businessId:   params.businessId,
    actorUserId:  params.userId,
    action:       `status_changed.${params.afterStatus}`,
    targetTable:  params.table,
    targetId:     params.targetId,
    beforeState:  { status: params.beforeStatus },
    afterState:   { status: params.afterStatus },
  }, params.db)
}

// ── Audit assignment change ───────────────────────────────────────

export async function auditAssignmentChange(params: {
  businessId:    string
  userId:        string
  table:         string
  targetId:      string
  beforeUserId:  string | null
  afterUserId:   string | null
  db?:           DbClient
}): Promise<void> {
  await createOpsAuditLog({
    businessId:   params.businessId,
    actorUserId:  params.userId,
    action:       params.afterUserId ? 'assigned' : 'unassigned',
    targetTable:  params.table,
    targetId:     params.targetId,
    beforeState:  { assigned_to: params.beforeUserId },
    afterState:   { assigned_to: params.afterUserId },
  }, params.db)
}

// ── Audit bulk action ─────────────────────────────────────────────

export async function auditBulkAction(params: {
  businessId: string
  userId:     string
  table:      string
  action:     string
  count:      number
  db?:        DbClient
}): Promise<void> {
  await createOpsAuditLog({
    businessId:   params.businessId,
    actorUserId:  params.userId,
    action:       `bulk.${params.action}`,
    targetTable:  params.table,
    metadata:     { count: params.count },
  }, params.db)
}

// ── Get audit trail ───────────────────────────────────────────────

export async function getOpsAuditTrail(params: {
  businessId:   string
  limit?:       number
  targetTable?: string
  targetId?:    string
  db?:          DbClient
}): Promise<AuditTrailRow[]> {
  const { businessId, limit = 50, targetTable, targetId, db } = params
  const client = db ?? createServiceRoleClient()
  try {
    let query = client
      .from('ops_audit_trail')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (targetTable) query = query.eq('target_table', targetTable)
    if (targetId)    query = query.eq('target_id', targetId)

    const { data } = await query
    return (data ?? []) as AuditTrailRow[]
  } catch {
    return []
  }
}
