'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
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

export async function createBusiness(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

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

  const { data: biz, error: bizErr } = await supabase
    .from('businesses')
    .insert({
      ...parsed.data,
      slug:  makeSlug(parsed.data.name),
      hours: parseHours(formData),
    })
    .select('id')
    .single()

  if (bizErr || !biz) {
    console.error('[createBusiness]', bizErr?.message)
    return { error: 'Could not create business. Please try again.' }
  }

  // Add user as owner
  const { error: memErr } = await supabase
    .from('business_members')
    .insert({ business_id: biz.id, user_id: user.id, role: 'owner' })

  if (memErr) {
    console.error('[createBusiness] member insert', memErr.message)
    // Rollback business
    await supabase.from('businesses').delete().eq('id', biz.id)
    return { error: 'Could not set up business membership. Please try again.' }
  }

  // Seed agent_settings + widget_settings defaults
  await Promise.all([
    supabase.from('agent_settings').insert({
      business_id:  biz.id,
      agent_name:   'Helios AI Assistant',
      language:     'en',
      collect_name:  true,
      collect_email: true,
      collect_phone: false,
    }),
    supabase.from('widget_settings').insert({
      business_id:      biz.id,
      primary_color:    '#ff7a18',
      bot_name:         parsed.data.name + ' AI',
      welcome_message:  'Hi! How can I help you today?',
      placeholder_text: 'Type a message…',
      position:         'bottom-right',
      is_enabled:       true,
    }),
  ])

  await logAudit(supabase, {
    business_id: biz.id,
    user_id:     user.id,
    action:      'business.create',
    resource:    'businesses',
    resource_id: biz.id,
    new_values:  { name: parsed.data.name },
  })

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
