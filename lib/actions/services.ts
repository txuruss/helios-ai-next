'use server'

import { revalidatePath } from 'next/cache'
import { serviceSchema } from '@/lib/validation/schemas'
import { getAuthContext, logAudit } from './_shared'
import type { ActionState } from '@/types'

export async function createService(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user, businessId } = await getAuthContext()
  if (!user || !businessId) return { error: 'Not authorised.' }

  const parsed = serviceSchema.safeParse({
    name:         formData.get('name'),
    description:  formData.get('description') || undefined,
    price_cents:  formData.get('price_cents')  || undefined,
    duration_min: formData.get('duration_min') || undefined,
    is_active:    formData.get('is_active') !== 'false',
  })

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Invalid input.' }
  }

  const { data, error } = await supabase
    .from('services')
    .insert({ ...parsed.data, business_id: businessId })
    .select('id')
    .single()

  if (error) {
    console.error('[createService]', error.message)
    return { error: 'Could not create service. Please try again.' }
  }

  await logAudit(supabase, {
    business_id: businessId,
    user_id:     user.id,
    action:      'service.create',
    resource:    'services',
    resource_id: data.id,
    new_values:  parsed.data as Record<string, unknown>,
  })

  revalidatePath('/dashboard/services')
  return { success: 'Service created.' }
}

export async function updateService(
  serviceId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user, businessId } = await getAuthContext()
  if (!user || !businessId) return { error: 'Not authorised.' }

  const parsed = serviceSchema.safeParse({
    name:         formData.get('name'),
    description:  formData.get('description') || undefined,
    price_cents:  formData.get('price_cents')  || undefined,
    duration_min: formData.get('duration_min') || undefined,
    is_active:    formData.get('is_active') !== 'false',
  })

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Invalid input.' }
  }

  const { error } = await supabase
    .from('services')
    .update(parsed.data)
    .eq('id', serviceId)
    .eq('business_id', businessId)

  if (error) {
    console.error('[updateService]', error.message)
    return { error: 'Could not update service. Please try again.' }
  }

  await logAudit(supabase, {
    business_id: businessId,
    user_id:     user.id,
    action:      'service.update',
    resource:    'services',
    resource_id: serviceId,
    new_values:  parsed.data as Record<string, unknown>,
  })

  revalidatePath('/dashboard/services')
  return { success: 'Service updated.' }
}

export async function deleteService(serviceId: string): Promise<ActionState> {
  const { supabase, user, businessId } = await getAuthContext()
  if (!user || !businessId) return { error: 'Not authorised.' }

  const { error } = await supabase
    .from('services')
    .delete()
    .eq('id', serviceId)
    .eq('business_id', businessId)

  if (error) {
    console.error('[deleteService]', error.message)
    return { error: 'Could not delete service.' }
  }

  await logAudit(supabase, {
    business_id: businessId,
    user_id:     user.id,
    action:      'service.delete',
    resource:    'services',
    resource_id: serviceId,
  })

  revalidatePath('/dashboard/services')
  return { success: 'Service deleted.' }
}
