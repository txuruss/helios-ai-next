'use server'

import { revalidatePath } from 'next/cache'
import { agentSettingsSchema } from '@/lib/validation/schemas'
import { getAuthContext, logAudit } from './_shared'
import type { ActionState } from '@/types'

export async function upsertAgentSettings(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user, businessId } = await getAuthContext()
  if (!user || !businessId) return { error: 'Not authorised.' }

  const parsed = agentSettingsSchema.safeParse({
    agent_name:     formData.get('agent_name'),
    persona_prompt: formData.get('persona_prompt') || undefined,
    collect_name:   formData.get('collect_name')  === 'on',
    collect_email:  formData.get('collect_email') === 'on',
    collect_phone:  formData.get('collect_phone') === 'on',
  })

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Invalid input.' }
  }

  const { error } = await supabase
    .from('agent_settings')
    .upsert(
      { ...parsed.data, business_id: businessId },
      { onConflict: 'business_id' },
    )

  if (error) {
    console.error('[upsertAgentSettings]', error.message)
    return { error: 'Could not save agent settings. Please try again.' }
  }

  await logAudit(supabase, {
    business_id: businessId,
    user_id:     user.id,
    action:      'agent_settings.update',
    resource:    'agent_settings',
    new_values:  parsed.data as Record<string, unknown>,
  })

  revalidatePath('/dashboard/agents')
  return { success: 'Agent settings saved.' }
}
