'use server'

import { revalidatePath } from 'next/cache'
import { faqSchema } from '@/lib/validation/schemas'
import { getAuthContext, logAudit } from './_shared'
import type { ActionState } from '@/types'

export async function createFaq(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user, businessId } = await getAuthContext()
  if (!user || !businessId) return { error: 'Not authorised.' }

  const parsed = faqSchema.safeParse({
    question:  formData.get('question'),
    answer:    formData.get('answer'),
    is_active: formData.get('is_active') !== 'false',
  })

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Invalid input.' }
  }

  const { data, error } = await supabase
    .from('faqs')
    .insert({ ...parsed.data, business_id: businessId })
    .select('id')
    .single()

  if (error) {
    console.error('[createFaq]', error.message)
    return { error: 'Could not create FAQ. Please try again.' }
  }

  await logAudit(supabase, {
    business_id: businessId,
    user_id:     user.id,
    action:      'faq.create',
    resource:    'faqs',
    resource_id: data.id,
    new_values:  parsed.data as Record<string, unknown>,
  })

  revalidatePath('/dashboard/business')
  return { success: 'FAQ added.' }
}

export async function updateFaq(
  faqId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user, businessId } = await getAuthContext()
  if (!user || !businessId) return { error: 'Not authorised.' }

  const parsed = faqSchema.safeParse({
    question:  formData.get('question'),
    answer:    formData.get('answer'),
    is_active: formData.get('is_active') !== 'false',
  })

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Invalid input.' }
  }

  const { error } = await supabase
    .from('faqs')
    .update(parsed.data)
    .eq('id', faqId)
    .eq('business_id', businessId)

  if (error) {
    console.error('[updateFaq]', error.message)
    return { error: 'Could not update FAQ. Please try again.' }
  }

  await logAudit(supabase, {
    business_id: businessId,
    user_id:     user.id,
    action:      'faq.update',
    resource:    'faqs',
    resource_id: faqId,
    new_values:  parsed.data as Record<string, unknown>,
  })

  revalidatePath('/dashboard/business')
  return { success: 'FAQ updated.' }
}

export async function deleteFaq(faqId: string): Promise<ActionState> {
  const { supabase, user, businessId } = await getAuthContext()
  if (!user || !businessId) return { error: 'Not authorised.' }

  const { error } = await supabase
    .from('faqs')
    .delete()
    .eq('id', faqId)
    .eq('business_id', businessId)

  if (error) {
    console.error('[deleteFaq]', error.message)
    return { error: 'Could not delete FAQ.' }
  }

  await logAudit(supabase, {
    business_id: businessId,
    user_id:     user.id,
    action:      'faq.delete',
    resource:    'faqs',
    resource_id: faqId,
  })

  revalidatePath('/dashboard/business')
  return { success: 'FAQ deleted.' }
}
