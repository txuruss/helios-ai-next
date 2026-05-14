'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getAuthContext, logAudit } from './_shared'
import type { ActionState } from '@/types'

export async function updateProfile(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user, businessId } = await getAuthContext()
  if (!user) return { error: 'Not authenticated.' }

  const parsed = z
    .object({ full_name: z.string().min(1).max(80).trim() })
    .safeParse({ full_name: formData.get('full_name') })

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Invalid name.' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ full_name: parsed.data.full_name })
    .eq('id', user.id)

  if (error) {
    console.error('[updateProfile]', error.message)
    return { error: 'Could not update profile. Please try again.' }
  }

  if (businessId) {
    await logAudit(supabase, {
      business_id: businessId,
      user_id:     user.id,
      action:      'profile.update',
      resource:    'profiles',
      resource_id: user.id,
      new_values:  parsed.data,
    })
  }

  revalidatePath('/dashboard/settings')
  return { success: 'Profile updated.' }
}

export async function updatePassword(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = z
    .object({
      password:        z.string().min(8, 'Password must be at least 8 characters.'),
      confirm_password: z.string(),
    })
    .refine((d) => d.password === d.confirm_password, {
      message: 'Passwords do not match.',
      path:    ['confirm_password'],
    })
    .safeParse({
      password:         formData.get('password'),
      confirm_password: formData.get('confirm_password'),
    })

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Invalid password.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })

  if (error) {
    console.error('[updatePassword]', error.message)
    if (error.message.toLowerCase().includes('same password')) {
      return { error: 'New password must be different from your current password.' }
    }
    return { error: 'Could not update password. Please try again.' }
  }

  return { success: 'Password updated.' }
}
