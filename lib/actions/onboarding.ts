'use server'

import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { captureApiError } from '@/lib/logging/api'
import { capture } from '@/lib/analytics/posthog'
import {
  saveOnboardingDraftSchema,
  submitOnboardingIntakeSchema,
  updateOnboardingStatusSchema,
  type SaveOnboardingDraftInput,
  type OnboardingStatus,
} from '@/lib/validation/onboarding'

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

export interface OnboardingIntake {
  id:                       string
  business_id:              string
  owner_name:               string | null
  owner_email:              string | null
  owner_phone:              string | null
  business_name:            string | null
  business_type:            string | null
  city:                     string | null
  country:                  string | null
  website_url:              string | null
  instagram_url:            string | null
  facebook_url:             string | null
  whatsapp_number:          string | null
  services_notes:           string | null
  faq_notes:                string | null
  booking_rules_notes:      string | null
  brand_notes:              string | null
  ai_persona_notes:         string | null
  notification_preferences: string | null
  launch_notes:             string | null
  status:                   OnboardingStatus
  submitted_at:             string | null
  reviewed_at:              string | null
  created_at:               string
  updated_at:               string
}

// ── Get intake ────────────────────────────────────────────────────

export async function getOnboardingIntake(): Promise<{
  intake: OnboardingIntake | null
  error:  string | null
}> {
  const auth = await requireAuth()
  if (!auth.ok) return { intake: null, error: auth.error }
  const db = createServiceRoleClient()

  try {
    const { data, error } = await db
      .from('client_onboarding_intake')
      .select('*')
      .eq('business_id', auth.businessId)
      .single()

    if (error && error.code === 'PGRST116') {
      // No row yet — return null without error
      return { intake: null, error: null }
    }
    if (error) throw error
    return { intake: data as OnboardingIntake | null, error: null }
  } catch (err) {
    captureApiError(err, { route: 'actions/onboarding', error_type: 'get_intake_error', business_id: auth.businessId })
    return { intake: null, error: 'Could not load onboarding intake.' }
  }
}

// ── Save draft ────────────────────────────────────────────────────

export async function saveOnboardingDraft(
  data: SaveOnboardingDraftInput,
): Promise<{ success?: string; error?: string }> {
  const parsed = saveOnboardingDraftSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Invalid input.' }

  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const db = createServiceRoleClient()

  // Sanitise empty strings to null for URL/email fields
  const clean: Record<string, unknown> = { ...parsed.data }
  for (const key of ['owner_email','website_url','instagram_url','facebook_url'] as const) {
    if (clean[key] === '') clean[key] = null
  }

  try {
    await db.from('client_onboarding_intake').upsert({
      business_id: auth.businessId,
      ...clean,
      updated_at:  new Date().toISOString(),
    }, { onConflict: 'business_id' })

    capture('onboarding_draft_saved', {})

    // Safe ops event
    void import('@/lib/ops/events').then(({ createOpsEvent }) =>
      createOpsEvent({
        business_id: auth.businessId,
        source:      'onboarding',
        event_type:  'onboarding_draft_saved',
        severity:    'info',
        title:       'Onboarding draft saved',
        metadata:    {},
      }, db)
    ).catch(() => undefined)

    return { success: 'Draft saved.' }
  } catch (err) {
    captureApiError(err, { route: 'actions/onboarding', error_type: 'save_draft_error', business_id: auth.businessId })
    return { error: 'Could not save draft.' }
  }
}

// ── Submit intake ─────────────────────────────────────────────────

export async function submitOnboardingIntake(
  data: SaveOnboardingDraftInput,
): Promise<{ success?: string; error?: string }> {
  const parsed = submitOnboardingIntakeSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Business name and owner name are required to submit.' }

  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const db = createServiceRoleClient()

  const clean: Record<string, unknown> = { ...parsed.data }
  for (const key of ['owner_email','website_url','instagram_url','facebook_url'] as const) {
    if (clean[key] === '') clean[key] = null
  }

  try {
    await db.from('client_onboarding_intake').upsert({
      business_id:  auth.businessId,
      ...clean,
      status:       'submitted',
      submitted_at: new Date().toISOString(),
      updated_at:   new Date().toISOString(),
    }, { onConflict: 'business_id' })

    // Fetch intake id for delivery tasks
    const { data: intakeRow } = await db.from('client_onboarding_intake')
      .select('id').eq('business_id', auth.businessId).single()
    const intakeId = (intakeRow as { id?: string } | null)?.id ?? null

    // Create default delivery tasks (idempotent — skip if already exist)
    void import('@/lib/actions/delivery').then(({ createDefaultDeliveryTasks }) =>
      createDefaultDeliveryTasks(intakeId ?? undefined)
    ).catch(() => undefined)

    // Ops event
    void import('@/lib/ops/events').then(({ createOpsEvent }) =>
      createOpsEvent({
        business_id: auth.businessId,
        source:      'onboarding',
        event_type:  'onboarding_submitted',
        severity:    'info',
        title:       'Onboarding intake submitted',
        metadata:    {},
      }, db)
    ).catch(() => undefined)

    capture('onboarding_submitted', {})

    return { success: 'Onboarding intake submitted. Your delivery pipeline has been created.' }
  } catch (err) {
    captureApiError(err, { route: 'actions/onboarding', error_type: 'submit_intake_error', business_id: auth.businessId })
    return { error: 'Could not submit intake.' }
  }
}

// ── Update status ─────────────────────────────────────────────────

export async function updateOnboardingStatus(
  status: OnboardingStatus,
): Promise<{ success?: string; error?: string }> {
  const parsed = updateOnboardingStatusSchema.safeParse({ status })
  if (!parsed.success) return { error: 'Invalid status.' }

  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const db = createServiceRoleClient()

  try {
    await db.from('client_onboarding_intake').update({
      status,
      reviewed_at: ['approved','needs_changes','in_review'].includes(status) ? new Date().toISOString() : null,
      updated_at:  new Date().toISOString(),
    }).eq('business_id', auth.businessId)

    capture('onboarding_status_updated', { status })

    return { success: `Status updated to ${status}.` }
  } catch (err) {
    captureApiError(err, { route: 'actions/onboarding', error_type: 'update_status_error', business_id: auth.businessId })
    return { error: 'Could not update status.' }
  }
}
