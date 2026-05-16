import { z } from 'zod'

const SEVERITY  = z.enum(['info','warning','error','critical'])
const PRIORITY  = z.enum(['low','normal','high','urgent'])
const OPS_STATUS = z.enum(['open','acknowledged','resolved'])
const TASK_STATUS = z.enum(['pending','in_progress','completed','cancelled'])
const ALERT_STATUS = z.enum(['active','acknowledged','resolved'])
const APPROVAL_STATUS = z.enum(['pending','approved','rejected','expired'])

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
  metadata:      z.record(z.unknown()).optional().default({}),
})

export const updateOpsStatusSchema = z.object({
  id:     z.string().uuid(),
  status: z.union([OPS_STATUS, TASK_STATUS, ALERT_STATUS, APPROVAL_STATUS]),
})

export const bulkOpsActionSchema = z.object({
  ids:    z.array(z.string().uuid()).min(1).max(50),
  action: z.enum(['resolve','acknowledge','dismiss','complete']),
})

export type OpsEventInput    = z.infer<typeof opsEventSchema>
export type OpsTaskInput     = z.infer<typeof opsTaskSchema>
export type OpsAlertInput    = z.infer<typeof opsAlertSchema>
export type ApprovalInput    = z.infer<typeof approvalItemSchema>
