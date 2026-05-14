'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getAuthContext, logAudit } from './_shared'
import type { ActionState } from '@/types'

const LEAD_STATUSES = ['new', 'qualified', 'contacted', 'proposal', 'won', 'lost'] as const

export async function updateLeadStatus(
  leadId: string,
  status: (typeof LEAD_STATUSES)[number],
): Promise<ActionState> {
  const { supabase, user, businessId } = await getAuthContext()
  if (!user || !businessId) return { error: 'Not authorised.' }

  if (!LEAD_STATUSES.includes(status)) return { error: 'Invalid status.' }

  // Fetch old status for audit
  const { data: existing } = await supabase
    .from('leads')
    .select('status')
    .eq('id', leadId)
    .eq('business_id', businessId)
    .single()

  if (!existing) return { error: 'Lead not found.' }

  const { error } = await supabase
    .from('leads')
    .update({ status })
    .eq('id', leadId)
    .eq('business_id', businessId)

  if (error) {
    console.error('[updateLeadStatus]', error.message)
    return { error: 'Could not update lead status.' }
  }

  await logAudit(supabase, {
    business_id: businessId,
    user_id:     user.id,
    action:      'lead.status_changed',
    resource:    'leads',
    resource_id: leadId,
    old_values:  { status: existing.status },
    new_values:  { status },
  })

  revalidatePath('/dashboard/leads')
  return { success: 'Status updated.' }
}

export async function updateLeadNotes(
  leadId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user, businessId } = await getAuthContext()
  if (!user || !businessId) return { error: 'Not authorised.' }

  const notes = z.string().max(2000).safeParse(formData.get('notes'))
  if (!notes.success) return { error: 'Notes too long.' }

  const { error } = await supabase
    .from('leads')
    .update({ notes: notes.data })
    .eq('id', leadId)
    .eq('business_id', businessId)

  if (error) {
    console.error('[updateLeadNotes]', error.message)
    return { error: 'Could not save notes.' }
  }

  revalidatePath('/dashboard/leads')
  return { success: 'Notes saved.' }
}
