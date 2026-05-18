// ── Shared Ops types ──────────────────────────────────────────────
// Client-safe type definitions for Ops Center components.
// Import from here instead of from lib/actions/ops to avoid
// type-only re-exports in server action files (Next.js strict mode).

export type { SlaPolicy, SlaSummary, SlaCheckResult } from '@/lib/ops/sla'
export type { NotificationRule } from '@/lib/ops/notifications'
export type { AuditTrailRow } from '@/lib/ops/audit'
export type { AutomationRule } from '@/lib/ops/automation'

// ── Core ops entity types (mirrored from lib/actions/ops.ts) ──────

export interface OpsEvent {
  id:                 string
  business_id:        string | null
  source:             string
  event_type:         string
  severity:           string
  title:              string
  description:        string | null
  status:             string
  related_table:      string | null
  related_id:         string | null
  metadata:           Record<string, unknown>
  created_at:         string
  resolved_at:        string | null
  sla_due_at:         string | null
  escalation_level:   number
  escalated_at:       string | null
  notified_at:        string | null
  notification_status: string | null
  assigned_user_name: string | null
  assigned_to:        string | null
}

export interface OpsTask {
  id:                  string
  business_id:         string | null
  title:               string
  description:         string | null
  task_type:           string
  priority:            string
  status:              string
  related_table:       string | null
  related_id:          string | null
  assigned_to:         string | null
  due_at:              string | null
  metadata:            Record<string, unknown>
  created_at:          string
  completed_at:        string | null
  sla_due_at:          string | null
  overdue_at:          string | null
  escalation_level:    number
  escalated_at:        string | null
  notified_at:         string | null
  notification_status: string | null
  assigned_user_name:  string | null
}

export interface OpsAlert {
  id:                  string
  business_id:         string | null
  alert_type:          string
  severity:            string
  title:               string
  message:             string | null
  status:              string
  related_table:       string | null
  related_id:          string | null
  metadata:            Record<string, unknown>
  created_at:          string
  acknowledged_at:     string | null
  resolved_at:         string | null
  sla_due_at:          string | null
  escalation_level:    number
  escalated_at:        string | null
  notified_at:         string | null
  notification_status: string | null
  assigned_to:         string | null
  assigned_user_name:  string | null
}

export interface ApprovalItem {
  id:                  string
  business_id:         string | null
  approval_type:       string
  title:               string
  description:         string | null
  content:             string | null
  status:              string
  requested_by:        string | null
  reviewed_by:         string | null
  related_table:       string | null
  related_id:          string | null
  priority:            string
  assigned_to:         string | null
  source_table:        string | null
  source_id:           string | null
  metadata:            Record<string, unknown>
  created_at:          string
  reviewed_at:         string | null
  sla_due_at:          string | null
  escalation_level:    number
  escalated_at:        string | null
  notified_at:         string | null
  notification_status: string | null
  assigned_user_name:  string | null
}

export interface OpsOverviewMetrics {
  openEvents:       number
  activeTasks:      number
  activeAlerts:     number
  pendingApprovals: number
  criticalCount:    number
  resolvedToday:    number
}

export interface SystemHealthItem {
  name:      string
  status:    'healthy' | 'degraded' | 'unconfigured' | 'unknown'
  detail:    string
}

export interface PaginatedOpsResult<T> {
  rows:          T[]
  total_count:   number
  page:          number
  pageSize:      number
  has_next:      boolean
  has_previous:  boolean
  error:         string | null
}

export interface OpsSearchParams {
  search?:          string
  status?:          string
  severity?:        string
  source?:          string
  priority?:        string
  date_from?:       string
  date_to?:         string
  page?:            number
  pageSize?:        number
  include_snoozed?: boolean
  limit?:           number
}

export interface BusinessMember {
  user_id:   string
  email:     string
  full_name: string | null
  role:      string
}

export interface OpsExportRow {
  id:                string
  business_id:       string
  export_type:       string
  format:            string
  status:            string
  requested_by:      string | null
  filters:           Record<string, unknown>
  sanitized_filters: Record<string, unknown>
  row_count:         number
  created_at:        string
  completed_at:      string | null
}

export interface LaunchCheck {
  id:             string
  business_id:    string
  check_key:      string
  category:       string
  title:          string
  description:    string | null
  status:         string
  severity:       string
  result_summary: string | null
  last_checked_at: string | null
  metadata:       Record<string, unknown>
  created_at:     string
  updated_at:     string
}

export interface OpsCronRun {
  id:                  string
  business_id:         string | null
  job_name:            string
  status:              string
  checked_count:       number
  breached_count:      number
  escalated_count:     number
  notified_count:      number
  failed_count:        number | null
  skipped_count:       number | null
  error_message:       string | null
  duration_ms:         number | null
  trigger_source:      string | null
  cron_secret_type:    string | null
  verification_method: string | null
  request_source:      string | null
  businesses_checked:  number
  metadata:            Record<string, unknown>
  started_at:          string
  completed_at:        string | null
}

export interface ClientSystem {
  id:          string
  business_id: string | null
  name:        string
  status:      'healthy' | 'degraded' | 'unconfigured' | 'unknown'
  detail:      string
  last_check:  string | null
}

export interface SystemHealthSummary {
  items:  SystemHealthItem[]
  error:  string | null
}
