'use server'

import { revalidatePath } from 'next/cache'
import { widgetSettingsSchema } from '@/lib/validation/schemas'
import { getAuthContext, logAudit } from './_shared'
import type { ActionState } from '@/types'

export async function upsertWidgetSettings(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user, businessId } = await getAuthContext()
  if (!user || !businessId) return { error: 'Not authorised.' }

  const parsed = widgetSettingsSchema.safeParse({
    primary_color:    formData.get('primary_color'),
    bot_name:         formData.get('bot_name'),
    welcome_message:  formData.get('welcome_message'),
    placeholder_text: formData.get('placeholder_text'),
    position:         formData.get('position'),
    is_enabled:       formData.get('is_enabled') === 'on',
  })

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Invalid input.' }
  }

  const { error } = await supabase
    .from('widget_settings')
    .upsert(
      { ...parsed.data, business_id: businessId },
      { onConflict: 'business_id' },
    )

  if (error) {
    console.error('[upsertWidgetSettings]', error.message)
    return { error: 'Could not save widget settings. Please try again.' }
  }

  await logAudit(supabase, {
    business_id: businessId,
    user_id:     user.id,
    action:      'widget_settings.update',
    resource:    'widget_settings',
    new_values:  parsed.data as Record<string, unknown>,
  })

  revalidatePath('/dashboard/widget')
  return { success: 'Widget settings saved.' }
}
