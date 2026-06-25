'use server'

import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { captureApiError } from '@/lib/logging/api'
import { capture } from '@/lib/analytics/posthog'
import {
  createBusinessAuditSchema,
  generateAuditReportSchema,
  archiveBusinessAuditSchema,
  getScoreLabel,
  type AuditStatus,
  type AuditPlan,
} from '@/lib/validation/audits'
import type { CreateBusinessAuditInput } from '@/lib/validation/audits'

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

export interface BusinessAudit {
  id:                            string
  business_id:                   string
  audit_name:                    string
  business_name:                 string | null
  business_type:                 string | null
  city:                          string | null
  status:                        AuditStatus
  overall_score:                 number
  response_score:                number
  booking_score:                 number
  lead_capture_score:            number
  trust_score:                   number
  automation_score:              number
  recommended_plan:              AuditPlan | null
  estimated_revenue_risk:        string | null
  summary:                       string | null
  completed_at:                  string | null
  created_at:                    string
  metadata:                      Record<string, unknown>
}

export interface AuditFinding {
  id:             string
  category:       string
  severity:       string
  title:          string
  description:    string | null
  recommendation: string | null
  related_plan:   string | null
  sort_order:     number
}

export interface AuditRecommendation {
  id:               string
  recommended_plan: string
  setup_fee:        string | null
  monthly_fee:      string | null
  reason:           string | null
  included_features: string[]
  next_steps:       string[]
}

// ── Get audit list ────────────────────────────────────────────────

export async function getBusinessAudits(): Promise<{
  audits: BusinessAudit[]
  error:  string | null
}> {
  const auth = await requireAuth()
  if (!auth.ok) return { audits: [], error: auth.error }
  const db = createServiceRoleClient()

  try {
    const { data, error } = await db
      .from('business_audits')
      .select('*')
      .eq('business_id', auth.businessId)
      .neq('status', 'archived')
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) throw error
    return { audits: (data ?? []) as BusinessAudit[], error: null }
  } catch (err) {
    captureApiError(err, { route: 'actions/audits', error_type: 'get_audits_error', business_id: auth.businessId })
    return { audits: [], error: 'Could not load audits.' }
  }
}

// ── Get latest audit summary ──────────────────────────────────────

export async function getLatestAuditSummary(): Promise<{
  audit: Pick<BusinessAudit, 'id' | 'overall_score' | 'recommended_plan' | 'status' | 'completed_at'> | null
  criticalCount: number
  error: string | null
}> {
  const auth = await requireAuth()
  if (!auth.ok) return { audit: null, criticalCount: 0, error: auth.error }
  const db = createServiceRoleClient()

  try {
    const { data } = await db.from('business_audits')
      .select('id, overall_score, recommended_plan, status, completed_at')
      .eq('business_id', auth.businessId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single()

    if (!data) return { audit: null, criticalCount: 0, error: null }

    const audit = data as Pick<BusinessAudit, 'id' | 'overall_score' | 'recommended_plan' | 'status' | 'completed_at'>

    const { count: criticalCount } = await db.from('business_audit_findings')
      .select('id', { count: 'exact', head: true })
      .eq('audit_id', audit.id)
      .eq('severity', 'critical')

    return { audit, criticalCount: criticalCount ?? 0, error: null }
  } catch {
    return { audit: null, criticalCount: 0, error: null }
  }
}

// ── Get single audit with findings ───────────────────────────────

export async function getBusinessAuditById(auditId: string): Promise<{
  audit:          BusinessAudit | null
  findings:       AuditFinding[]
  recommendation: AuditRecommendation | null
  error:          string | null
}> {
  const auth = await requireAuth()
  if (!auth.ok) return { audit: null, findings: [], recommendation: null, error: auth.error }
  const db = createServiceRoleClient()

  try {
    const [auditRes, findingsRes, recRes] = await Promise.all([
      db.from('business_audits').select('*').eq('id', auditId).eq('business_id', auth.businessId).single(),
      db.from('business_audit_findings').select('*').eq('audit_id', auditId).order('sort_order', { ascending: true }),
      db.from('business_audit_recommendations').select('*').eq('audit_id', auditId).single(),
    ])

    if (auditRes.error || !auditRes.data) return { audit: null, findings: [], recommendation: null, error: 'Audit not found.' }

    return {
      audit:          auditRes.data as BusinessAudit,
      findings:       (findingsRes.data ?? []) as AuditFinding[],
      recommendation: recRes.data as AuditRecommendation | null,
      error:          null,
    }
  } catch (err) {
    captureApiError(err, { route: 'actions/audits', error_type: 'get_audit_error', business_id: auth.businessId })
    return { audit: null, findings: [], recommendation: null, error: 'Could not load audit.' }
  }
}

// ── Create audit ──────────────────────────────────────────────────

export async function createBusinessAudit(
  data: CreateBusinessAuditInput,
): Promise<{ id?: string; error?: string }> {
  const parsed = createBusinessAuditSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Invalid input.' }

  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const db = createServiceRoleClient()

  // Load business profile for defaults
  const { data: biz } = await db.from('businesses')
    .select('name, business_type, city, country')
    .eq('id', auth.businessId).single()
  const b = biz as DbRow | null

  try {
    const { data: row, error } = await db.from('business_audits').insert({
      business_id:   auth.businessId,
      audit_name:    parsed.data.audit_name,
      business_name: parsed.data.business_name ?? (b?.name as string | null) ?? null,
      website_url:   parsed.data.website_url || null,
      business_type: parsed.data.business_type ?? (b?.business_type as string | null) ?? null,
      city:          parsed.data.city ?? (b?.city as string | null) ?? null,
      country:       parsed.data.country ?? (b?.country as string | null) ?? null,
      source:        parsed.data.source,
      status:        'draft',
      created_by:    auth.userId,
      metadata:      {},
    }).select('id').single()

    if (error) throw error
    const id = (row as { id: string }).id

    capture('business_audit_created', {})

    // Fire-and-forget ops event
    void import('@/lib/ops/events').then(({ createOpsEvent }) =>
      createOpsEvent({ business_id: auth.businessId, source: 'audits', event_type: 'business_audit_created', severity: 'info', title: 'Deployment audit created', metadata: {} }, db)
    ).catch(() => undefined)

    return { id }
  } catch (err) {
    captureApiError(err, { route: 'actions/audits', error_type: 'create_audit_error', business_id: auth.businessId })
    return { error: 'Could not create audit.' }
  }
}

// ── Run audit ─────────────────────────────────────────────────────

export async function runBusinessAudit(auditId: string): Promise<{
  ok:    boolean
  error?: string
}> {
  const auth = await requireAuth()
  if (!auth.ok) return { ok: false, error: auth.error }
  const db = createServiceRoleClient()

  // Mark as running
  await db.from('business_audits').update({ status: 'running', updated_at: new Date().toISOString() })
    .eq('id', auditId).eq('business_id', auth.businessId)

  capture('business_audit_started', {})

  try {
    // Load all data needed for scoring
    const [
      bizRes, servicesRes, faqsRes, widgetRes,
      waRes, calRes, leadsRes, bookingsRes,
      setupRes, deliveryRes, sessionRes, auditRow,
    ] = await Promise.all([
      db.from('businesses').select('name, business_type, city, country, owner_notification_email, ai_paused').eq('id', auth.businessId).single(),
      db.from('services').select('id', { count: 'exact', head: true }).eq('business_id', auth.businessId).eq('status', 'active'),
      db.from('faqs').select('id', { count: 'exact', head: true }).eq('business_id', auth.businessId).eq('is_active', true),
      db.from('widget_configs').select('is_enabled').eq('business_id', auth.businessId).single(),
      db.from('whatsapp_connections').select('is_enabled').eq('business_id', auth.businessId).single(),
      db.from('calcom_connections').select('is_connected').eq('business_id', auth.businessId).single(),
      db.from('leads').select('id', { count: 'exact', head: true }).eq('business_id', auth.businessId),
      db.from('bookings').select('id', { count: 'exact', head: true }).eq('business_id', auth.businessId),
      db.from('client_setup_progress').select('*').eq('business_id', auth.businessId).single(),
      db.from('client_delivery_tasks').select('status').eq('business_id', auth.businessId),
      db.from('chat_sessions').select('id', { count: 'exact', head: true }).eq('business_id', auth.businessId).eq('handoff_status', 'human_requested'),
      db.from('business_audits').select('business_type').eq('id', auditId).single(),
    ])

    const b           = bizRes.data as DbRow | null
    const setupData   = setupRes.data as DbRow | null
    const deliveryTasks = (deliveryRes.data ?? []) as { status: string }[]

    const setupPercent = (() => {
      if (!setupData) return 0
      const keys = ['business_profile_completed','services_added','faqs_added','booking_rules_added','calcom_connected','whatsapp_connected','widget_installed','test_conversation_completed','owner_notification_tested','launch_approved']
      const done = keys.filter((k) => !!setupData[k]).length
      return Math.round((done / keys.length) * 100)
    })()

    const totalDelivery = deliveryTasks.length
    const doneTasks     = deliveryTasks.filter((t) => ['completed','skipped'].includes(t.status)).length
    const deliveryPct   = totalDelivery > 0 ? Math.round((doneTasks / totalDelivery) * 100) : 0

    const { calculateScores, generateFindings, estimateRevenueRisk } = await import('@/lib/audits/scoring')
    const { determineRecommendation, generateMarkdownReport } = await import('@/lib/audits/recommendations')

    const businessType = (auditRow.data as DbRow | null)?.business_type as string | null
    const input = {
      hasOwnerEmail:     !!(b?.owner_notification_email),
      businessType:      businessType,
      serviceCount:      servicesRes.count ?? 0,
      faqCount:          faqsRes.count ?? 0,
      widgetEnabled:     !!(widgetRes.data as DbRow | null)?.is_enabled,
      whatsappConnected: !!(waRes.data as DbRow | null)?.is_enabled,
      calcomConnected:   !!(calRes.data as DbRow | null)?.is_connected,
      leadCount:         leadsRes.count ?? 0,
      bookingCount:      bookingsRes.count ?? 0,
      setupPercent,
      deliveryPercent:   deliveryPct,
      hasHandoffSession: (sessionRes.count ?? 0) > 0,
      hasAiConfidence:   false,
    }

    const scores         = calculateScores(input)
    const findings       = generateFindings(input)
    const rec            = determineRecommendation(input, scores, businessType)
    const revenueRisk    = estimateRevenueRisk(input, businessType)
    const scoreLabel     = getScoreLabel(scores.overall)
    const report         = generateMarkdownReport({
      businessName: (b?.name as string | null) ?? 'Your Business',
      businessType,
      scores,
      findings: findings.slice(0, 10),
      recommendation: rec,
      revenueRisk,
    })

    const now = new Date().toISOString()

    // Update audit scores
    await db.from('business_audits').update({
      status:                        'completed',
      overall_score:                 scores.overall,
      response_score:                scores.response,
      booking_score:                 scores.booking,
      lead_capture_score:            scores.leadCapture,
      trust_score:                   scores.trust,
      automation_score:              scores.automation,
      recommended_plan:              rec.plan,
      estimated_revenue_risk:        revenueRisk,
      summary:                       `${scoreLabel} (${scores.overall}/100). ${findings.filter((f) => f.severity === 'critical').length} critical gaps found. Recommended: ${rec.displayName}.`,
      completed_at:                  now,
      updated_at:                    now,
      metadata:                      { report_length: report.length, demo: false },
    }).eq('id', auditId)

    // Delete old findings/rec for this audit (re-run case)
    await Promise.all([
      db.from('business_audit_findings').delete().eq('audit_id', auditId),
      db.from('business_audit_recommendations').delete().eq('audit_id', auditId),
    ])

    // Insert findings
    if (findings.length > 0) {
      await db.from('business_audit_findings').insert(
        findings.map((f, i) => ({
          business_id:    auth.businessId,
          audit_id:       auditId,
          category:       f.category,
          severity:       f.severity,
          title:          f.title,
          description:    f.description,
          recommendation: f.recommendation,
          related_plan:   f.relatedPlan ?? null,
          sort_order:     f.sortOrder ?? i,
        }))
      )
    }

    // Insert recommendation
    await db.from('business_audit_recommendations').insert({
      business_id:       auth.businessId,
      audit_id:          auditId,
      recommended_plan:  rec.plan,
      setup_fee:         rec.setupFee,
      monthly_fee:       rec.monthlyFee,
      reason:            rec.reason,
      included_features: rec.includedFeatures,
      next_steps:        rec.nextSteps,
    })

    // Store report in export log
    await db.from('audit_report_exports').insert({
      business_id:  auth.businessId,
      audit_id:     auditId,
      export_type:  'markdown',
      status:       'created',
      file_name:    `audit-${auditId.slice(0, 8)}.md`,
      safe_summary: `${scoreLabel} ${scores.overall}/100 — ${rec.displayName}`,
      created_by:   auth.userId,
    })

    // Ops event
    void import('@/lib/ops/events').then(({ createOpsEvent }) =>
      createOpsEvent({ business_id: auth.businessId, source: 'audits', event_type: 'business_audit_completed', severity: 'info', title: `Audit complete: ${scoreLabel} (${scores.overall}/100)`, metadata: { recommended_plan: rec.plan } }, db)
    ).catch(() => undefined)

    capture('business_audit_completed', {
      score_range:      scores.overall >= 80 ? '80-100' : scores.overall >= 60 ? '60-79' : scores.overall >= 40 ? '40-59' : '0-39',
      recommended_plan: rec.plan,
      finding_count:    findings.length,
      severity_count:   findings.filter((f) => f.severity === 'critical').length,
    })

    return { ok: true }
  } catch (err) {
    captureApiError(err, { route: 'actions/audits', error_type: 'run_audit_error', business_id: auth.businessId })
    await db.from('business_audits').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', auditId)
    capture('business_audit_failed', {})
    return { ok: false, error: 'Audit run failed.' }
  }
}

// ── Archive audit ─────────────────────────────────────────────────

export async function archiveBusinessAudit(auditId: string): Promise<{ success?: string; error?: string }> {
  const parsed = archiveBusinessAuditSchema.safeParse({ audit_id: auditId })
  if (!parsed.success) return { error: 'Invalid audit ID.' }

  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const db = createServiceRoleClient()

  try {
    await db.from('business_audits').update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', auditId).eq('business_id', auth.businessId)
    capture('business_audit_archived', {})
    return { success: 'Audit archived.' }
  } catch (err) {
    captureApiError(err, { route: 'actions/audits', error_type: 'archive_audit_error', business_id: auth.businessId })
    return { error: 'Could not archive audit.' }
  }
}

// ── Generate report text ──────────────────────────────────────────

export async function generateAuditReport(
  auditId:    string,
  exportType: 'markdown' | 'copy' | 'pdf_ready' = 'copy',
): Promise<{ text?: string; error?: string }> {
  const parsed = generateAuditReportSchema.safeParse({ audit_id: auditId, export_type: exportType })
  if (!parsed.success) return { error: 'Invalid input.' }

  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const db = createServiceRoleClient()

  try {
    const { audit, findings, recommendation } = await getBusinessAuditById(auditId)
    if (!audit) return { error: 'Audit not found.' }

    const { getScoreLabel: gsl } = await import('@/lib/validation/audits')
    const { generateMarkdownReport } = await import('@/lib/audits/recommendations')

    const recForReport = recommendation ? {
      plan:              recommendation.recommended_plan as 'starter'|'pro'|'scale',
      displayName:       recommendation.recommended_plan === 'pro' ? 'Booking OS' : recommendation.recommended_plan === 'scale' ? 'Helios AIOS' : 'Starter',
      setupFee:          recommendation.setup_fee ?? '',
      monthlyFee:        recommendation.monthly_fee ?? '',
      reason:            recommendation.reason ?? '',
      includedFeatures:  recommendation.included_features ?? [],
      nextSteps:         recommendation.next_steps ?? [],
    } : {
      plan: 'starter' as const, displayName: 'Starter',
      setupFee: '$997 setup', monthlyFee: '$149/mo',
      reason: '', includedFeatures: [], nextSteps: [],
    }

    const scores = {
      response: audit.response_score, booking: audit.booking_score,
      leadCapture: audit.lead_capture_score, trust: audit.trust_score,
      automation: audit.automation_score, overall: audit.overall_score,
    }

    const text = generateMarkdownReport({
      businessName:   audit.business_name ?? 'Your Business',
      businessType:   audit.business_type,
      scores,
      findings:       findings.slice(0, 10).map((f) => ({
        severity: f.severity, title: f.title,
        description: f.description ?? '', recommendation: f.recommendation ?? '',
      })),
      recommendation: recForReport,
      revenueRisk:    audit.estimated_revenue_risk ?? 'Revenue risk not calculated.',
    })

    // Log export
    await db.from('audit_report_exports').insert({
      business_id:  auth.businessId,
      audit_id:     auditId,
      export_type:  exportType,
      status:       'created',
      safe_summary: `${gsl(audit.overall_score)} — exported as ${exportType}`,
      created_by:   auth.userId,
    }).catch(() => undefined)

    capture('audit_report_exported', { export_type: exportType })

    return { text }
  } catch (err) {
    captureApiError(err, { route: 'actions/audits', error_type: 'generate_report_error', business_id: auth.businessId })
    return { error: 'Could not generate report.' }
  }
}
