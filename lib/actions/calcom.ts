'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { getEventTypes } from '@/lib/calcom/client'
import {
  serviceEventMappingSchema,
  deleteServiceEventMappingSchema,
} from '@/lib/validation/calcom'
import { getAuthContext, logAudit } from './_shared'
import type { ActionState } from '@/types'

// ── Sync Cal.com event types ──────────────────────────────────────

export async function syncCalcomEventTypes(): Promise<ActionState & { count?: number }> {
  const { user, businessId } = await getAuthContext()
  if (!user || !businessId) return { error: 'Not authorised.' }

  if (!process.env.CALCOM_API_KEY) {
    return { error: 'CALCOM_API_KEY is not configured. Add it to .env.local and restart.' }
  }

  const result = await getEventTypes()
  if (!result.ok) {
    console.error('[syncCalcomEventTypes] Cal.com error:', result.error)
    return { error: 'Unable to sync Cal.com event types. Check your API key.' }
  }

  const db = createServiceRoleClient()

  // Upsert each event type
  let synced = 0
  for (const et of result.data) {
    const { error } = await db.from('calcom_event_types').upsert(
      {
        business_id:  businessId,
        calcom_id:    et.calcom_id,
        title:        et.title,
        slug:         et.slug,
        duration_min: et.duration_min,
        is_active:    et.is_active,
        raw_data:     et.raw_data,
      },
      { onConflict: 'calcom_id' },
    )
    if (error) {
      console.error('[syncCalcomEventTypes] upsert error:', error.message, error.code)
    } else {
      synced++
    }
  }

  // Update connection last_synced_at
  await db
    .from('calcom_connections')
    .upsert(
      { business_id: businessId, is_connected: true, last_synced_at: new Date().toISOString() },
      { onConflict: 'business_id' },
    )

  await logAudit(db, {
    business_id: businessId,
    user_id:     user.id,
    action:      'calcom.event_types.synced',
    resource:    'calcom_event_types',
    new_values:  { synced_count: synced },
  })

  revalidatePath('/dashboard/calcom')
  return { success: `Synced ${synced} event type${synced !== 1 ? 's' : ''} from Cal.com.`, count: synced }
}

// ── Create service → event type mapping ──────────────────────────

export async function createServiceEventMapping(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user, businessId } = await getAuthContext()
  if (!user || !businessId) return { error: 'Not authorised.' }

  const parsed = serviceEventMappingSchema.safeParse({
    service_id:           formData.get('service_id'),
    calcom_event_type_id: formData.get('calcom_event_type_id'),
  })
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Invalid input.' }
  }

  const db = createServiceRoleClient()

  // Verify both belong to this business
  const [svcCheck, etCheck] = await Promise.all([
    db.from('services').select('id').eq('id', parsed.data.service_id).eq('business_id', businessId).single(),
    db.from('calcom_event_types').select('id').eq('id', parsed.data.calcom_event_type_id).eq('business_id', businessId).single(),
  ])
  if (!svcCheck.data) return { error: 'Service not found.' }
  if (!etCheck.data) return { error: 'Cal.com event type not found.' }

  const { error } = await db.from('service_event_mappings').upsert(
    { ...parsed.data, business_id: businessId },
    { onConflict: 'service_id' },
  )
  if (error) {
    console.error('[createServiceEventMapping]', error.message, error.code)
    return { error: 'Could not save mapping. Please try again.' }
  }

  await logAudit(db, {
    business_id: businessId,
    user_id:     user.id,
    action:      'calcom.mapping.created',
    resource:    'service_event_mappings',
    new_values:  parsed.data as Record<string, unknown>,
  })

  revalidatePath('/dashboard/calcom')
  return { success: 'Service mapped to Cal.com event type.' }
}

// ── Delete service mapping ────────────────────────────────────────

export async function deleteServiceEventMapping(mappingId: string): Promise<ActionState> {
  const parsed = deleteServiceEventMappingSchema.safeParse({ mapping_id: mappingId })
  if (!parsed.success) return { error: 'Invalid mapping ID.' }

  const { user, businessId } = await getAuthContext()
  if (!user || !businessId) return { error: 'Not authorised.' }

  const db = createServiceRoleClient()

  const { error } = await db
    .from('service_event_mappings')
    .delete()
    .eq('id', mappingId)
    .eq('business_id', businessId)

  if (error) {
    console.error('[deleteServiceEventMapping]', error.message)
    return { error: 'Could not delete mapping.' }
  }

  await logAudit(db, {
    business_id: businessId,
    user_id:     user.id,
    action:      'calcom.mapping.deleted',
    resource:    'service_event_mappings',
    resource_id: mappingId,
  })

  revalidatePath('/dashboard/calcom')
  return { success: 'Mapping removed.' }
}
