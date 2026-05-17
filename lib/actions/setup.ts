'use server'

import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { captureApiError } from '@/lib/logging/api'
import { capture } from '@/lib/analytics/posthog'
import type { SetupItemKey } from '@/lib/validation/setup'

type DbRow = Record<string, unknown>

// ── Auth helper ───────────────────────────────────────────────────

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

// ── Setup progress types ──────────────────────────────────────────

export interface SetupProgress {
  id:                           string
  business_id:                  string
  business_profile_completed:   boolean
  services_added:               boolean
  faqs_added:                   boolean
  booking_rules_added:          boolean
  calcom_connected:             boolean
  whatsapp_connected:           boolean
  widget_installed:             boolean
  test_conversation_completed:  boolean
  owner_notification_tested:    boolean
  launch_approved:              boolean
  demo_mode_active:             boolean
  demo_loaded_at:               string | null
  created_at:                   string
  updated_at:                   string
}

// ── Get setup progress ────────────────────────────────────────────

export async function getSetupProgress(): Promise<{
  progress: SetupProgress | null
  error:    string | null
}> {
  const auth = await requireAuth()
  if (!auth.ok) return { progress: null, error: auth.error }
  const db = createServiceRoleClient()

  try {
    const { data, error } = await db
      .from('client_setup_progress')
      .select('*')
      .eq('business_id', auth.businessId)
      .single()

    if (error && error.code === 'PGRST116') {
      // Row doesn't exist yet — create it
      const { data: created } = await db.from('client_setup_progress').insert({
        business_id: auth.businessId,
      }).select().single()
      return { progress: created as SetupProgress | null, error: null }
    }

    if (error) throw error
    return { progress: data as SetupProgress | null, error: null }
  } catch (err) {
    captureApiError(err, { route: 'actions/setup', error_type: 'get_setup_error', business_id: auth.businessId })
    return { progress: null, error: 'Could not load setup progress.' }
  }
}

// ── Update single setup item ──────────────────────────────────────

export async function updateSetupItem(
  key:   SetupItemKey,
  value: boolean,
): Promise<{ success?: string; error?: string }> {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const db = createServiceRoleClient()

  try {
    // Upsert — creates row if it doesn't exist
    await db.from('client_setup_progress').upsert({
      business_id:  auth.businessId,
      [key]:        value,
      updated_at:   new Date().toISOString(),
    }, { onConflict: 'business_id' })

    capture('setup_item_completed', { item_key: key, value, status: value ? 'checked' : 'unchecked' })

    return { success: `Setup item ${key} updated.` }
  } catch (err) {
    captureApiError(err, { route: 'actions/setup', error_type: 'update_setup_item_error', business_id: auth.businessId })
    return { error: 'Could not save setup progress.' }
  }
}

// ── Toggle AI paused ──────────────────────────────────────────────

export async function toggleAiPaused(
  paused: boolean,
  reason?: string,
): Promise<{ success?: string; error?: string }> {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const db = createServiceRoleClient()

  try {
    await db.from('businesses').update({
      ai_paused:        paused,
      ai_paused_at:     paused ? new Date().toISOString() : null,
      ai_paused_reason: paused ? (reason ?? null) : null,
      ai_paused_by:     paused ? auth.userId : null,
    }).eq('id', auth.businessId)

    capture(paused ? 'ai_pause_enabled' : 'ai_pause_disabled', {
      has_reason: !!reason,
    })

    return { success: paused ? 'AI paused.' : 'AI resumed.' }
  } catch (err) {
    captureApiError(err, { route: 'actions/setup', error_type: 'toggle_ai_paused_error', business_id: auth.businessId })
    return { error: 'Could not update AI pause state.' }
  }
}

export async function getAiPaused(): Promise<{ paused: boolean; reason: string | null; error: string | null }> {
  const auth = await requireAuth()
  if (!auth.ok) return { paused: false, reason: null, error: auth.error }
  const db = createServiceRoleClient()

  try {
    const { data } = await db.from('businesses').select('ai_paused, ai_paused_reason').eq('id', auth.businessId).single()
    const d = data as { ai_paused?: boolean; ai_paused_reason?: string | null } | null
    return { paused: d?.ai_paused ?? false, reason: d?.ai_paused_reason ?? null, error: null }
  } catch {
    return { paused: false, reason: null, error: 'Could not load AI status.' }
  }
}

// ── Launch approval ───────────────────────────────────────────────

export async function approveLaunch(): Promise<{ success?: string; error?: string }> {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }

  const result = await updateSetupItem('launch_approved', true)
  if (result.success) {
    capture('launch_approved', { business_id: auth.businessId })
  }
  return result
}
