'use server'

import { randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { widgetSettingsUpdateSchema } from '@/lib/validation/widget'
import { getAuthContext, logAudit } from './_shared'
import { getBusinessPlan } from '@/lib/billing/limits'
import { getPlanLimits } from '@/lib/billing/plans'
import type { ActionState } from '@/types'

function generateWidgetId(): string {
  return `wgt_${randomBytes(10).toString('hex')}`
}

export async function upsertWidgetSettings(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user, businessId } = await getAuthContext()
  if (!user || !businessId) return { error: 'Not authorised.' }

  const parsed = widgetSettingsUpdateSchema.safeParse({
    primary_color:    formData.get('primary_color'),
    bot_name:         formData.get('bot_name'),
    welcome_message:  formData.get('welcome_message'),
    placeholder_text: formData.get('placeholder_text'),
    position:         formData.get('position'),
    is_enabled:       formData.get('is_enabled')       === 'on',
    show_powered_by:  formData.get('show_powered_by')  === 'on',
    logo_url:         formData.get('logo_url') || undefined,
  })

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Invalid input.' }
  }

  // Use service role so we can read and write widget_id reliably
  const db = createServiceRoleClient()

  // Check if a widget_id already exists for this business
  const { data: existing } = await db
    .from('widget_settings')
    .select('widget_id')
    .eq('business_id', businessId)
    .single()

  const widgetId: string = (existing as { widget_id: string | null } | null)?.widget_id ?? generateWidgetId()

  // Plan gate: Starter plan must always show "Powered by Helios AI".
  // Override any client-submitted value server-side before writing to DB.
  const plan       = await getBusinessPlan(db, businessId)
  const planLimits = getPlanLimits(plan)
  const showPoweredBy =
    planLimits.show_powered_by === 'required'
      ? true                          // Starter: always true, no exceptions
      : parsed.data.show_powered_by   // Pro/Scale: honour the user's choice

  const { error } = await db
    .from('widget_settings')
    .upsert(
      {
        ...parsed.data,
        show_powered_by: showPoweredBy,
        logo_url:        parsed.data.logo_url || null,
        business_id:     businessId,
        widget_id:       widgetId,
      },
      { onConflict: 'business_id' },
    )

  if (error) {
    console.error('[upsertWidgetSettings]', error.message, error.code)
    return { error: 'Could not save widget settings. Please try again.' }
  }

  await logAudit(db, {
    business_id: businessId,
    user_id:     user.id,
    action:      'widget_settings.update',
    resource:    'widget_settings',
    new_values:  { ...parsed.data, widget_id: widgetId },
  })

  revalidatePath('/dashboard/widget')
  return { success: 'Widget settings saved.' }
}

export async function regenerateWidgetId(): Promise<ActionState & { widget_id?: string }> {
  const { user, businessId } = await getAuthContext()
  if (!user || !businessId) return { error: 'Not authorised.' }

  const db = createServiceRoleClient()
  const newWidgetId = generateWidgetId()

  const { error } = await db
    .from('widget_settings')
    .update({ widget_id: newWidgetId })
    .eq('business_id', businessId)

  if (error) {
    console.error('[regenerateWidgetId]', error.message)
    return { error: 'Could not regenerate widget ID.' }
  }

  await logAudit(db, {
    business_id: businessId,
    user_id:     user.id,
    action:      'widget_settings.widget_id_regenerated',
    resource:    'widget_settings',
    new_values:  { widget_id: newWidgetId },
  })

  revalidatePath('/dashboard/widget')
  return { success: 'Widget ID regenerated.', widget_id: newWidgetId }
}
