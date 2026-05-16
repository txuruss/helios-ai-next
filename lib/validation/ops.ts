import { z } from 'zod'

const SEVERITY       = z.enum(['info','warning','error','critical'])
const PRIORITY       = z.enum(['low','normal','high','urgent'])
const OPS_STATUS     = z.enum(['open','acknowledged','resolved'])
const TASK_STATUS    = z.enum(['pending','in_progress','completed','cancelled'])
const ALERT_STATUS   = z.enum(['active','acknowledged','resolved'])
const APPROVAL_STATUS = z.enum(['pending','approved','rejected','expired'])
const ACTION_TYPE    = z.enum(['create_alert','create_task','create_approval','ignore'])
const EXPORT_TYPE    = z.enum(['ops_events','ops_alerts','ops_tasks','approvals'])
const EXPORT_FORMAT  = z.enum(['csv','json'])

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ── Base schemas ──────────────────────────────────────────────────

export const opsEventSchema = z.object({
  business_id:   z.string().uuid().optional(),
  source:        z.string().min(1).max(64),
  event_type:    z.string().min(1).max(128),
  severity:      SEVERITY.default('info'),
  title:         z.string().min(1).max(256),
  description:   z.string().max(2000).optional(),
  related_table: z.string().max(64).optional(),
  related_id:    z.string().uuid().optional(),
  metadata:      z.record(z.unknown()).optional().default({}),
})

export const opsTaskSchema = z.object({
  business_id:   z.string().uuid().optional(),
  title:         z.string().min(1).max(256),
  description:   z.string().max(2000).optional(),
  task_type:     z.string().min(1).max(128),
  priority:      PRIORITY.default('normal'),
  related_table: z.string().max(64).optional(),
  related_id:    z.string().uuid().optional(),
  due_at:        z.string().datetime().optional(),
  metadata:      z.record(z.unknown()).optional().default({}),
})

export const opsAlertSchema = z.object({
  business_id:   z.string().uuid().optional(),
  alert_type:    z.string().min(1).max(128),
  severity:      SEVERITY.default('warning'),
  title:         z.string().min(1).max(256),
  message:       z.string().max(2000).optional(),
  related_table: z.string().max(64).optional(),
  related_id:    z.string().uuid().optional(),
  metadata:      z.record(z.unknown()).optional().default({}),
})

export const approvalItemSchema = z.object({
  business_id:   z.string().uuid().optional(),
  approval_type: z.string().min(1).max(128),
  title:         z.string().min(1).max(256),
  description:   z.string().max(2000).optional(),
  content:       z.string().max(10000).optional(),
  requested_by:  z.string().max(256).optional(),
  related_table: z.string().max(64).optional(),
  related_id:    z.string().uuid().optional(),
  priority:      PRIORITY.default('normal'),
  source_table:  z.string().max(64).optional(),
  source_id:     z.string().uuid().optional(),
  metadata:      z.record(z.unknown()).optional().default({}),
})

export const updateOpsStatusSchema = z.object({
  id:     z.string().uuid(),
  status: z.union([OPS_STATUS, TASK_STATUS, ALERT_STATUS, APPROVAL_STATUS]),
})

export const bulkOpsActionSchema = z.object({
  ids:    z.array(z.string().uuid()).min(1).max(50),
  action: z.enum(['resolve','acknowledge','dismiss','complete','ignore','approve','reject','assign']),
})

// ── Phase 13 schemas ──────────────────────────────────────────────

export const opsAutomationRuleSchema = z.object({
  business_id:                 z.string().uuid().optional(),
  name:                        z.string().min(1).max(128),
  description:                 z.string().max(2000).optional(),
  trigger_source:              z.string().max(64).optional(),
  trigger_event_type:          z.string().max(128).optional(),
  trigger_severity:            SEVERITY.optional(),
  action_type:                 ACTION_TYPE,
  action_title_template:       z.string().min(1).max(256),
  action_description_template: z.string().max(2000).optional(),
  priority:                    PRIORITY.default('normal'),
  is_enabled:                  z.boolean().default(true),
  metadata:                    z.record(z.unknown()).optional().default({}),
})

export const toggleAutomationRuleSchema = z.object({
  id:         z.string().uuid(),
  is_enabled: z.boolean(),
})

export const runAutomationSchema = z.object({
  limit: z.number().int().min(1).max(100).default(50),
})

export const assignOpsItemSchema = z.object({
  table:       z.enum(['ops_events','ops_tasks','ops_alerts','approval_items']),
  id:          z.string().uuid(),
  assigned_to: z.string().uuid().nullable(),
})

export const exportOpsSchema = z.object({
  export_type:  EXPORT_TYPE,
  format:       EXPORT_FORMAT,
  status:       z.string().max(32).optional(),
  severity:     z.string().max(32).optional(),
  source:       z.string().max(64).optional(),
  search:       z.string().max(256).optional(),
  date_from:    z.string().datetime().optional(),
  date_to:      z.string().datetime().optional(),
  limit:        z.number().int().min(1).max(2000).default(500),
})

export const bulkOpsEventsSchema = z.object({
  ids:    z.array(z.string().regex(UUID_RE)).min(1).max(50),
  action: z.enum(['resolve','ignore','assign']),
  assigned_to: z.string().uuid().optional(),
})

export const bulkOpsAlertsSchema = z.object({
  ids:    z.array(z.string().regex(UUID_RE)).min(1).max(50),
  action: z.enum(['acknowledge','resolve','ignore','assign']),
  assigned_to: z.string().uuid().optional(),
})

export const bulkOpsTasksSchema = z.object({
  ids:    z.array(z.string().regex(UUID_RE)).min(1).max(50),
  action: z.enum(['start','complete','dismiss','assign']),
  assigned_to: z.string().uuid().optional(),
})

export const bulkApprovalItemsSchema = z.object({
  ids:    z.array(z.string().regex(UUID_RE)).min(1).max(50),
  action: z.enum(['approve','reject','archive','assign']),
  assigned_to: z.string().uuid().optional(),
})

// ── Phase 14 schemas ──────────────────────────────────────────────

const TRIGGER_TYPE = z.enum([
  'alert_created','task_created','approval_created','item_assigned',
  'sla_warning','sla_breached','escalation_created','automation_failed',
  'payment_failed','booking_failed','handoff_requested',
])

const CHANNEL        = z.enum(['email','dashboard','none'])
const RECIPIENT_TYPE = z.enum(['owner','assigned_user','all_admins','custom_email'])
const TARGET_TYPE    = z.enum(['event','alert','task','approval','conversation'])

export const opsNotificationRuleSchema = z.object({
  business_id:       z.string().uuid().optional(),
  name:              z.string().min(1).max(128),
  description:       z.string().max(2000).optional(),
  trigger_type:      TRIGGER_TYPE,
  source:            z.string().max(64).optional(),
  severity:          SEVERITY.optional(),
  priority:          PRIORITY.optional(),
  status:            z.string().max(32).optional(),
  channel:           CHANNEL.default('email'),
  recipient_type:    RECIPIENT_TYPE.default('owner'),
  recipient_user_id: z.string().uuid().optional(),
  recipient_email:   z.string().email().max(256).optional(),
  delay_minutes:     z.number().int().min(0).max(10080).default(0),
  is_enabled:        z.boolean().default(true),
  metadata:          z.record(z.unknown()).optional().default({}),
})

export const toggleNotificationRuleSchema = z.object({
  id:         z.string().uuid(),
  is_enabled: z.boolean(),
})

export const opsSlaPolicySchema = z.object({
  business_id:        z.string().uuid().optional(),
  name:               z.string().min(1).max(128),
  target_type:        TARGET_TYPE,
  source:             z.string().max(64).optional(),
  severity:           SEVERITY.optional(),
  priority:           PRIORITY.optional(),
  response_minutes:   z.number().int().min(1).max(43200),
  escalation_minutes: z.number().int().min(1).max(43200).optional(),
  is_enabled:         z.boolean().default(true),
  metadata:           z.record(z.unknown()).optional().default({}),
})

export const toggleSlaPolicySchema = z.object({
  id:         z.string().uuid(),
  is_enabled: z.boolean(),
})

export const runSlaCheckSchema = z.object({
  limit: z.number().int().min(1).max(200).default(100),
})

export const escalateOpsItemSchema = z.object({
  table: z.enum(['ops_events','ops_alerts','ops_tasks','approval_items']),
  id:    z.string().uuid(),
  level: z.number().int().min(1).max(5).default(1),
})

export const snoozeOpsItemSchema = z.object({
  table:        z.enum(['ops_events','ops_alerts','ops_tasks','approval_items']),
  id:           z.string().uuid(),
  snooze_until: z.string().datetime(),
})

export const opsAuditQuerySchema = z.object({
  limit:        z.number().int().min(1).max(200).default(50),
  target_table: z.string().max(64).optional(),
  target_id:    z.string().uuid().optional(),
})

// ── Phase 15: CRUD schemas ────────────────────────────────────────

export const createAutomationRuleSchema = opsAutomationRuleSchema.omit({ business_id: true, metadata: true })
export const updateAutomationRuleSchema = createAutomationRuleSchema.partial().extend({ id: z.string().uuid() })
export const deleteRuleSchema           = z.object({ id: z.string().uuid() })

export const createSlaPolicySchema = opsSlaPolicySchema.omit({ business_id: true, metadata: true })
export const updateSlaPolicySchema = createSlaPolicySchema.partial().extend({ id: z.string().uuid() })

export const createNotificationRuleSchema = opsNotificationRuleSchema.omit({ business_id: true, metadata: true, recipient_user_id: true })
  .extend({ recipient_user_id: z.string().uuid().optional() })
export const updateNotificationRuleSchema = createNotificationRuleSchema.partial().extend({ id: z.string().uuid() })

export const testNotificationRuleSchema = z.object({
  rule_id: z.string().uuid().optional(),
  to:      z.string().email().max(256).optional(),
})

export const opsSearchSchema = z.object({
  search:   z.string().max(256).optional(),
  status:   z.string().max(32).optional(),
  severity: z.string().max(32).optional(),
  source:   z.string().max(64).optional(),
  priority: z.string().max(32).optional(),
  page:     z.number().int().min(1).default(1),
  pageSize: z.number().int().min(5).max(100).default(25),
})

export const bulkAssignSchema = z.object({
  table:       z.enum(['ops_events','ops_tasks','ops_alerts','approval_items']),
  ids:         z.array(z.string().uuid()).min(1).max(50),
  assigned_to: z.string().uuid().nullable(),
})

export const rerunExportSchema = z.object({
  export_id: z.string().uuid(),
})

// ── Inferred types ────────────────────────────────────────────────

export type OpsEventInput            = z.infer<typeof opsEventSchema>
export type OpsTaskInput             = z.infer<typeof opsTaskSchema>
export type OpsAlertInput            = z.infer<typeof opsAlertSchema>
export type ApprovalInput            = z.infer<typeof approvalItemSchema>
export type AutomationRuleInput      = z.infer<typeof opsAutomationRuleSchema>
export type ExportOpsInput           = z.infer<typeof exportOpsSchema>
export type NotificationRuleInput    = z.infer<typeof opsNotificationRuleSchema>
export type SlaPolicyInput           = z.infer<typeof opsSlaPolicySchema>
export type CreateAutomationRuleInput = z.infer<typeof createAutomationRuleSchema>
export type CreateSlaPolicyInput     = z.infer<typeof createSlaPolicySchema>
export type CreateNotificationRuleInput = z.infer<typeof createNotificationRuleSchema>
export type OpsSearchInput           = z.infer<typeof opsSearchSchema>
