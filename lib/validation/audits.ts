import { z } from 'zod'

export const AUDIT_STATUSES   = ['draft','running','completed','failed','archived'] as const
export const AUDIT_SOURCES    = ['manual','demo','website','imported'] as const
export const AUDIT_PLANS      = ['starter','pro','scale'] as const
export const FINDING_CATEGORIES = ['response_speed','booking_flow','lead_capture','website','whatsapp','trust','operations','automation','follow_up','analytics'] as const
export const FINDING_SEVERITIES = ['low','medium','high','critical'] as const

export type AuditStatus    = typeof AUDIT_STATUSES[number]
export type AuditSource    = typeof AUDIT_SOURCES[number]
export type AuditPlan      = typeof AUDIT_PLANS[number]
export type FindingCategory = typeof FINDING_CATEGORIES[number]
export type FindingSeverity  = typeof FINDING_SEVERITIES[number]

export const createBusinessAuditSchema = z.object({
  audit_name:    z.string().min(1).max(256).default(() => `Audit ${new Date().toLocaleDateString()}`),
  business_name: z.string().max(256).optional(),
  website_url:   z.string().url().max(512).optional().or(z.literal('')),
  business_type: z.string().max(256).optional(),
  city:          z.string().max(256).optional(),
  country:       z.string().max(256).optional(),
  source:        z.enum(AUDIT_SOURCES).default('manual'),
})

export const runBusinessAuditSchema = z.object({
  audit_id: z.string().uuid(),
})

export const archiveBusinessAuditSchema = z.object({
  audit_id: z.string().uuid(),
})

export const generateAuditReportSchema = z.object({
  audit_id:    z.string().uuid(),
  export_type: z.enum(['markdown','copy','pdf_ready']).default('copy'),
})

// Score labels
export function getScoreLabel(score: number): string {
  if (score >= 80) return 'Production Ready'
  if (score >= 60) return 'Demo Ready'
  if (score >= 40) return 'Needs Improvement'
  return 'Critical Gaps'
}

export function getScoreColor(score: number): string {
  if (score >= 80) return '#22d093'
  if (score >= 60) return '#3b9eff'
  if (score >= 40) return '#ffae3c'
  return '#ff8a7a'
}

export type CreateBusinessAuditInput = z.input<typeof createBusinessAuditSchema>
