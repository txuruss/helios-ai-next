'use server'

import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { captureApiError } from '@/lib/logging/api'
import { capture } from '@/lib/analytics/posthog'
import {
  applyNicheTemplateSchema,
  previewNicheTemplateSchema,
  type ApplyMode,
} from '@/lib/validation/templates'
import {
  NICHE_TEMPLATES,
  getNicheTemplate,
  getNicheTemplateKeys,
  type NicheTemplate,
} from '@/lib/templates/niche-templates'

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

export interface TemplateApplicationLog {
  id:                      string
  template_key:            string
  apply_mode:              string
  services_created:        number
  faqs_created:            number
  business_fields_updated: boolean
  status:                  string
  safe_summary:            string | null
  created_at:              string
}

export interface TemplatePreview {
  template:          NicheTemplate
  willCreateServices: string[]
  willCreateFaqs:    string[]
  willUpdateBusiness: boolean
  existingServices:  number
  existingFaqs:      number
  mode:              ApplyMode
}

// ── Get all templates ─────────────────────────────────────────────

export async function getNicheTemplates(): Promise<{
  templates: NicheTemplate[]
  error:     string | null
}> {
  // Templates are client-safe constants — no DB call needed
  try {
    const templates = getNicheTemplateKeys().map((key) => NICHE_TEMPLATES[key])
    return { templates, error: null }
  } catch (err) {
    captureApiError(err, { route: 'actions/templates', error_type: 'get_templates_error' })
    return { templates: [], error: 'Could not load templates.' }
  }
}

// ── Get single template ───────────────────────────────────────────

export async function getNicheTemplateByKey(key: string): Promise<{
  template: NicheTemplate | null
  error:    string | null
}> {
  const template = getNicheTemplate(key)
  return { template, error: template ? null : 'Template not found.' }
}

// ── Preview template application ──────────────────────────────────

export async function previewNicheTemplateApplication(
  templateKey: string,
  mode:        ApplyMode = 'append',
): Promise<{ preview: TemplatePreview | null; error: string | null }> {
  const parsed = previewNicheTemplateSchema.safeParse({ template_key: templateKey })
  if (!parsed.success) return { preview: null, error: 'Invalid template key.' }

  const auth = await requireAuth()
  if (!auth.ok) return { preview: null, error: auth.error }

  const template = getNicheTemplate(parsed.data.template_key)
  if (!template) return { preview: null, error: 'Template not found.' }

  const db = createServiceRoleClient()

  try {
    const [servicesRes, faqsRes, bizRes] = await Promise.all([
      db.from('services').select('name').eq('business_id', auth.businessId).eq('status', 'active'),
      db.from('faqs').select('question').eq('business_id', auth.businessId).eq('is_active', true),
      db.from('businesses').select('business_type, name').eq('id', auth.businessId).single(),
    ])

    const existingServiceNames = new Set(((servicesRes.data ?? []) as DbRow[]).map((s) => (s.name as string).toLowerCase()))
    const existingFaqQuestions  = new Set(((faqsRes.data ?? []) as DbRow[]).map((f) => (f.question as string).toLowerCase()))
    const biz = bizRes.data as DbRow | null

    const willCreateServices = template.services
      .map((s) => s.name)
      .filter((n) => mode === 'append' ? !existingServiceNames.has(n.toLowerCase()) : true)

    const willCreateFaqs = template.faqs
      .map((f) => f.question)
      .filter((q) => mode === 'append' ? !existingFaqQuestions.has(q.toLowerCase()) : true)

    const willUpdateBusiness = mode === 'fill_missing' && !biz?.business_type

    capture('niche_template_previewed', { template_key: templateKey, apply_mode: mode })

    return {
      preview: {
        template,
        willCreateServices,
        willCreateFaqs,
        willUpdateBusiness,
        existingServices: existingServiceNames.size,
        existingFaqs:     existingFaqQuestions.size,
        mode,
      },
      error: null,
    }
  } catch (err) {
    captureApiError(err, { route: 'actions/templates', error_type: 'preview_error', business_id: auth.businessId })
    return { preview: null, error: 'Could not preview template.' }
  }
}

// ── Apply niche template ──────────────────────────────────────────

export async function applyNicheTemplate(
  templateKey: string,
  mode:        ApplyMode = 'append',
): Promise<{
  ok:              boolean
  servicesCreated: number
  faqsCreated:     number
  error?:          string
}> {
  const parsed = applyNicheTemplateSchema.safeParse({ template_key: templateKey, apply_mode: mode })
  if (!parsed.success) return { ok: false, servicesCreated: 0, faqsCreated: 0, error: 'Invalid input.' }

  const auth = await requireAuth()
  if (!auth.ok) return { ok: false, servicesCreated: 0, faqsCreated: 0, error: auth.error }

  const template = getNicheTemplate(parsed.data.template_key)
  if (!template) return { ok: false, servicesCreated: 0, faqsCreated: 0, error: 'Template not found.' }

  const db = createServiceRoleClient()
  let servicesCreated = 0
  let faqsCreated     = 0

  try {
    // Load existing data
    const [servicesRes, faqsRes] = await Promise.all([
      db.from('services').select('name').eq('business_id', auth.businessId),
      db.from('faqs').select('question').eq('business_id', auth.businessId),
    ])

    const existingNames     = new Set(((servicesRes.data ?? []) as DbRow[]).map((s) => (s.name as string).toLowerCase()))
    const existingQuestions = new Set(((faqsRes.data ?? []) as DbRow[]).map((f) => (f.question as string).toLowerCase()))

    // Services
    const servicesToCreate = template.services.filter((s) => {
      if (mode === 'replace_demo_only') return false // demo mode services handled separately
      return !existingNames.has(s.name.toLowerCase())
    })

    if (servicesToCreate.length > 0) {
      const { data: inserted } = await db.from('services').insert(
        servicesToCreate.map((s) => ({
          business_id:  auth.businessId,
          name:         s.name,
          price_min:    null,
          price_max:    null,
          duration_min: null,
          status:       'active',
          metadata:     { template: templateKey },
        }))
      ).select('id')
      servicesCreated = (inserted ?? []).length
    }

    // FAQs
    const faqsToCreate = template.faqs.filter((f) => {
      if (mode === 'replace_demo_only') return false
      return !existingQuestions.has(f.question.toLowerCase())
    })

    if (faqsToCreate.length > 0) {
      const { data: insertedFaqs } = await db.from('faqs').insert(
        faqsToCreate.map((f) => ({
          business_id: auth.businessId,
          question:    f.question,
          answer:      f.answer,
          is_active:   true,
          metadata:    { template: templateKey },
        }))
      ).select('id')
      faqsCreated = (insertedFaqs ?? []).length
    }

    // Fill missing business fields
    if (mode === 'fill_missing') {
      const { data: biz } = await db.from('businesses').select('business_type').eq('id', auth.businessId).single()
      const b = biz as DbRow | null
      if (!b?.business_type) {
        await db.from('businesses').update({ business_type: template.businessType }).eq('id', auth.businessId)
      }
    }

    // Log application
    await db.from('business_template_applications').insert({
      business_id:             auth.businessId,
      template_key:            templateKey,
      applied_by:              auth.userId,
      apply_mode:              mode,
      services_created:        servicesCreated,
      faqs_created:            faqsCreated,
      business_fields_updated: mode === 'fill_missing',
      status:                  'completed',
      safe_summary:            `Applied ${template.name} template (${mode}): ${servicesCreated} services, ${faqsCreated} FAQs`,
      metadata:                { template_key: templateKey, apply_mode: mode },
    })

    // Ops event
    void import('@/lib/ops/events').then(({ createOpsEvent }) =>
      createOpsEvent({
        business_id: auth.businessId,
        source:      'templates',
        event_type:  'niche_template_applied',
        severity:    'info',
        title:       `${template.name} template applied`,
        metadata:    { template_key: templateKey, mode },
      }, db)
    ).catch(() => undefined)

    capture('niche_template_applied', {
      template_key:    templateKey,
      apply_mode:      mode,
      service_count:   servicesCreated,
      faq_count:       faqsCreated,
      recommended_plan: template.recommendedPlan,
    })

    return { ok: true, servicesCreated, faqsCreated }
  } catch (err) {
    captureApiError(err, { route: 'actions/templates', error_type: 'apply_error', business_id: auth.businessId })
    capture('niche_template_apply_failed', { template_key: templateKey })
    return { ok: false, servicesCreated: 0, faqsCreated: 0, error: 'Could not apply template.' }
  }
}

// ── Get application history ───────────────────────────────────────

export async function getTemplateApplicationHistory(): Promise<{
  history: TemplateApplicationLog[]
  error:   string | null
}> {
  const auth = await requireAuth()
  if (!auth.ok) return { history: [], error: auth.error }
  const db = createServiceRoleClient()

  try {
    const { data, error } = await db
      .from('business_template_applications')
      .select('id, template_key, apply_mode, services_created, faqs_created, business_fields_updated, status, safe_summary, created_at')
      .eq('business_id', auth.businessId)
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) throw error
    return { history: (data ?? []) as TemplateApplicationLog[], error: null }
  } catch (err) {
    captureApiError(err, { route: 'actions/templates', error_type: 'history_error', business_id: auth.businessId })
    return { history: [], error: 'Could not load history.' }
  }
}

// ── Get last applied template ─────────────────────────────────────

export async function getLastAppliedTemplate(): Promise<{
  templateKey: string | null
  error:       string | null
}> {
  const auth = await requireAuth()
  if (!auth.ok) return { templateKey: null, error: auth.error }
  const db = createServiceRoleClient()

  try {
    const { data } = await db
      .from('business_template_applications')
      .select('template_key')
      .eq('business_id', auth.businessId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    return { templateKey: (data as DbRow | null)?.template_key as string | null ?? null, error: null }
  } catch {
    return { templateKey: null, error: null }
  }
}
