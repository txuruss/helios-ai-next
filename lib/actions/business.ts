'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { businessSchema } from '@/lib/validation/schemas'
import { getAuthContext, logAudit } from './_shared'
import type { ActionState } from '@/types'

function makeSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 48) +
    '-' +
    Date.now().toString(36)
  )
}

function parseHours(formData: FormData) {
  const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
  const hours: Record<string, { open: string; close: string; closed: boolean }> = {}
  for (const day of DAYS) {
    hours[day] = {
      open:   (formData.get(`${day}_open`)  as string) || '09:00',
      close:  (formData.get(`${day}_close`) as string) || '17:00',
      closed: formData.get(`${day}_closed`) === 'on',
    }
  }
  return hours
}

// ── Create first business + seed defaults ─────────────────────────
//
// WHY service role is used here:
// The anon client has RLS enabled. After INSERT into `businesses`, the
// subsequent `.select('id')` is blocked by the RLS SELECT policy
// ("is_business_member(id)") because the user has not yet been added
// to business_members. Supabase RLS silently returns zero rows for
// blocked SELECTs, so `biz` is null even though the INSERT succeeded.
// Using the service role client bypasses RLS for this privileged
// onboarding sequence only. The user is still verified via getUser()
// before any DB writes happen.

export async function createBusiness(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // 1. Verify session with the regular SSR client (reads cookies)
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) {
    console.error('[createBusiness] No authenticated user')
    return { error: 'Your session has expired. Please sign in again.' }
  }

  // 2. Guard on service role key before touching the DB
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[createBusiness] SUPABASE_SERVICE_ROLE_KEY not configured')
    return { error: 'Server configuration error. Contact support.' }
  }

  // 3. Validate form input
  const parsed = businessSchema.safeParse({
    name:                      formData.get('name'),
    description:               formData.get('description') || undefined,
    website_url:               formData.get('website_url') || undefined,
    phone:                     formData.get('phone') || undefined,
    city:                      formData.get('city') || undefined,
    country:                   formData.get('country') || 'Jamaica',
    business_type:             formData.get('business_type') || undefined,
    owner_notification_email:  formData.get('owner_notification_email') || undefined,
  })

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Invalid input.' }
  }

  // 4. All DB writes use the service role client so RLS never blocks the
  //    INSERT+SELECT sequence or the seeding inserts.
  const db = createServiceRoleClient()

  // 5. Ensure profile row exists (guard against signup trigger not firing)
  const { error: profileErr } = await db
    .from('profiles')
    .upsert(
      { id: user.id, email: user.email ?? '', full_name: user.user_metadata?.full_name ?? null },
      { onConflict: 'id' },
    )

  if (profileErr) {
    console.error('[createBusiness] profile upsert error:', profileErr.message, profileErr.code)
  }

  // 6. Insert business
  const { data: biz, error: bizErr } = await db
    .from('businesses')
    .insert({
      ...parsed.data,
      slug:  makeSlug(parsed.data.name),
      hours: parseHours(formData),
    })
    .select('id')
    .single()

  if (bizErr || !biz) {
    console.error('[createBusiness] businesses insert error:', bizErr?.message, bizErr?.code, bizErr?.details)
    return { error: 'Could not create your business profile. Please try again.' }
  }

  // 7. Add user as owner in business_members
  const { error: memErr } = await db
    .from('business_members')
    .insert({ business_id: biz.id, user_id: user.id, role: 'owner' })

  if (memErr) {
    console.error('[createBusiness] business_members insert error:', memErr.message, memErr.code)
    // Roll back the business row so the next attempt starts clean
    await db.from('businesses').delete().eq('id', biz.id)
    return { error: 'Could not set up your business account. Please try again.' }
  }

  // 8. Seed default agent_settings and widget_settings
  const [agentRes, widgetRes] = await Promise.all([
    db.from('agent_settings').insert({
      business_id:   biz.id,
      agent_name:    'Helios AI Assistant',
      language:      'en',
      collect_name:  true,
      collect_email: true,
      collect_phone: false,
    }),
    db.from('widget_settings').insert({
      business_id:      biz.id,
      primary_color:    '#ff7a18',
      bot_name:         parsed.data.name + ' AI',
      welcome_message:  'Hi! How can I help you today?',
      placeholder_text: 'Type a message…',
      position:         'bottom-right',
      is_enabled:       true,
    }),
  ])

  if (agentRes.error) {
    console.error('[createBusiness] agent_settings insert error:', agentRes.error.message, agentRes.error.code)
  }
  if (widgetRes.error) {
    console.error('[createBusiness] widget_settings insert error:', widgetRes.error.message, widgetRes.error.code)
  }

  // 9. Audit log (non-fatal — service role can always write audit_logs)
  await logAudit(db, {
    business_id: biz.id,
    user_id:     user.id,
    action:      'business.create',
    resource:    'businesses',
    resource_id: biz.id,
    new_values:  { name: parsed.data.name },
  })

  // 10. Invalidate all cached server-component data so the dashboard sees the
  //     new business_members row immediately instead of serving stale null.
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/business')
  revalidatePath('/dashboard/setup')

  redirect('/dashboard')
}

// ── Update existing business ──────────────────────────────────────

export async function updateBusiness(
  businessId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user, businessId: authBizId } = await getAuthContext()
  if (!user || authBizId !== businessId) return { error: 'Not authorised.' }

  const parsed = businessSchema.safeParse({
    name:                      formData.get('name'),
    description:               formData.get('description') || undefined,
    website_url:               formData.get('website_url') || undefined,
    phone:                     formData.get('phone') || undefined,
    city:                      formData.get('city') || undefined,
    country:                   formData.get('country') || 'Jamaica',
    business_type:             formData.get('business_type') || undefined,
    owner_notification_email:  formData.get('owner_notification_email') || undefined,
  })

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Invalid input.' }
  }

  const { error } = await supabase
    .from('businesses')
    .update({ ...parsed.data, hours: parseHours(formData) })
    .eq('id', businessId)

  if (error) {
    console.error('[updateBusiness]', error.message)
    return { error: 'Could not save changes. Please try again.' }
  }

  await logAudit(supabase, {
    business_id: businessId,
    user_id:     user.id,
    action:      'business.update',
    resource:    'businesses',
    resource_id: businessId,
    new_values:  parsed.data as Record<string, unknown>,
  })

  revalidatePath('/dashboard/business')
  return { success: 'Business profile saved.' }
}
