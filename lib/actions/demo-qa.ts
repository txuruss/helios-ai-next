'use server'

import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { captureApiError } from '@/lib/logging/api'
import { capture } from '@/lib/analytics/posthog'

type DbRow = Record<string, unknown>

export type QaCheckStatus = 'passed' | 'warning' | 'failed' | 'skipped'

export interface DemoQaResult {
  check_key:   string
  label:       string
  status:      QaCheckStatus
  note:        string
}

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

// ── Run demo QA checks ────────────────────────────────────────────
// Returns status labels only — never env values, tokens, or raw data.

export async function runDemoQaChecks(): Promise<{
  results:   DemoQaResult[]
  summary:   { passed: number; warned: number; failed: number; skipped: number; total: number }
  readiness: 'not_started' | 'in_progress' | 'ready_for_demo' | 'production_ready'
  error?:    string
}> {
  const EMPTY = { results: [], summary: { passed: 0, warned: 0, failed: 0, skipped: 0, total: 0 }, readiness: 'not_started' as const }

  const auth = await requireAuth()
  if (!auth.ok) return { ...EMPTY, error: auth.error }

  const db = createServiceRoleClient()
  const results: DemoQaResult[] = []

  const check = (key: string, label: string, status: QaCheckStatus, note: string) => {
    results.push({ check_key: key, label, status, note })
  }

  try {
    // 1. Business profile
    const { data: biz } = await db.from('businesses')
      .select('id, name, owner_notification_email, business_type')
      .eq('id', auth.businessId).single()
    const bizRow = biz as DbRow | null
    check('business_profile', 'Business Profile',
      bizRow?.name ? 'passed' : 'failed',
      bizRow?.name ? `Profile found: ${(bizRow.name as string).slice(0, 30)}` : 'No business name set')
    check('owner_email', 'Owner Email',
      bizRow?.owner_notification_email ? 'passed' : 'warning',
      bizRow?.owner_notification_email ? 'Owner email configured' : 'Owner notification email not set')

    // 2. Services
    const { count: serviceCount } = await db.from('services')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', auth.businessId).eq('status', 'active')
    check('services', 'Services',
      (serviceCount ?? 0) > 0 ? 'passed' : 'warning',
      `${serviceCount ?? 0} active service${serviceCount !== 1 ? 's' : ''}`)

    // 3. FAQs
    const { count: faqCount } = await db.from('faqs')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', auth.businessId).eq('is_active', true)
    check('faqs', 'FAQs',
      (faqCount ?? 0) > 0 ? 'passed' : 'warning',
      `${faqCount ?? 0} active FAQ${faqCount !== 1 ? 's' : ''}`)

    // 4. Widget config
    const { data: widget } = await db.from('widget_configs')
      .select('id, is_enabled').eq('business_id', auth.businessId).single()
    const w = widget as DbRow | null
    check('widget', 'Widget Configuration',
      w?.is_enabled ? 'passed' : w ? 'warning' : 'failed',
      w?.is_enabled ? 'Widget enabled' : w ? 'Widget exists but disabled' : 'No widget configured')

    // 5. Cal.com connection
    const { data: calcom } = await db.from('calcom_connections')
      .select('id, is_connected').eq('business_id', auth.businessId).single()
    const cal = calcom as DbRow | null
    const calConfigured = !!process.env.CALCOM_API_KEY
    check('calcom', 'Cal.com Connection',
      cal?.is_connected ? 'passed' : calConfigured ? 'warning' : 'skipped',
      cal?.is_connected ? 'Cal.com connected' : calConfigured ? 'CALCOM_API_KEY set but not connected' : 'Cal.com not configured (optional)')

    // 6. WhatsApp connection
    const { data: wa } = await db.from('whatsapp_connections')
      .select('id, is_enabled').eq('business_id', auth.businessId).single()
    const waRow = wa as DbRow | null
    const metaConfigured = !!process.env.META_ACCESS_TOKEN
    check('whatsapp', 'WhatsApp Connection',
      waRow?.is_enabled ? 'passed' : metaConfigured ? 'warning' : 'skipped',
      waRow?.is_enabled ? 'WhatsApp enabled' : metaConfigured ? 'Meta token set but WhatsApp not connected' : 'WhatsApp not configured (optional)')

    // 7. Resend / owner notifications
    check('resend', 'Email Notifications',
      process.env.RESEND_API_KEY ? 'passed' : 'warning',
      process.env.RESEND_API_KEY ? 'RESEND_API_KEY configured' : 'RESEND_API_KEY missing — owner emails will be skipped')

    // 8. Anthropic AI
    check('anthropic', 'AI Engine',
      process.env.ANTHROPIC_API_KEY ? 'passed' : 'failed',
      process.env.ANTHROPIC_API_KEY ? 'ANTHROPIC_API_KEY configured' : 'ANTHROPIC_API_KEY missing — AI replies will fail')

    // 9. Recent test conversation
    const { count: convCount } = await db.from('chat_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', auth.businessId)
    check('test_chat', 'Test Conversation',
      (convCount ?? 0) > 0 ? 'passed' : 'warning',
      (convCount ?? 0) > 0 ? `${convCount} conversation${convCount !== 1 ? 's' : ''} recorded` : 'No test conversations yet')

    // 10. Recent lead
    const { count: leadCount } = await db.from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', auth.businessId)
    check('leads', 'Lead Capture',
      (leadCount ?? 0) > 0 ? 'passed' : 'warning',
      (leadCount ?? 0) > 0 ? `${leadCount} lead${leadCount !== 1 ? 's' : ''} captured` : 'No leads captured yet')

    // 11. Supabase service role
    check('supabase', 'Supabase Config',
      process.env.SUPABASE_SERVICE_ROLE_KEY ? 'passed' : 'failed',
      process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Service role configured' : 'SUPABASE_SERVICE_ROLE_KEY missing')

    // 12. App URL
    check('app_url', 'App URL',
      process.env.NEXT_PUBLIC_APP_URL ? 'passed' : 'warning',
      process.env.NEXT_PUBLIC_APP_URL ? `URL: ${process.env.NEXT_PUBLIC_APP_URL}` : 'NEXT_PUBLIC_APP_URL not set — portal links may be incorrect')

    // Summary
    const passed  = results.filter((r) => r.status === 'passed').length
    const warned  = results.filter((r) => r.status === 'warning').length
    const failed  = results.filter((r) => r.status === 'failed').length
    const skipped = results.filter((r) => r.status === 'skipped').length
    const total   = results.length

    // Readiness determination
    const criticalFailed = results
      .filter((r) => ['anthropic', 'supabase', 'business_profile'].includes(r.check_key))
      .some((r) => r.status === 'failed')

    const demoReady = !criticalFailed && passed >= Math.floor(total * 0.6)
    const prodReady = !criticalFailed && failed === 0 && passed >= Math.floor(total * 0.85)

    const readiness =
      prodReady      ? 'production_ready'  :
      demoReady      ? 'ready_for_demo'    :
      passed > 0     ? 'in_progress'       :
                       'not_started'

    capture('production_check_run', {
      passed, failed, warned, readiness,
    })

    return { results, summary: { passed, warned, failed, skipped, total }, readiness }
  } catch (err) {
    captureApiError(err, { route: 'actions/demo-qa', error_type: 'qa_check_error', business_id: auth.businessId })
    return { ...EMPTY, error: 'Could not complete QA checks.' }
  }
}
