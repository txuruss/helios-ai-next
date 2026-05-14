'use server'

import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function getAuthContext() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { supabase, user: null, businessId: null }

  const { data: membership } = await supabase
    .from('business_members')
    .select('business_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  return {
    supabase,
    user,
    businessId: (membership?.business_id as string) ?? null,
  }
}

export async function logAudit(
  supabase: SupabaseClient,
  params: {
    business_id: string | null
    user_id: string
    action: string
    resource: string
    resource_id?: string
    old_values?: Record<string, unknown>
    new_values?: Record<string, unknown>
  },
) {
  try {
    await supabase.from('audit_logs').insert(params)
  } catch {
    // audit failure must not block the main operation
  }
}
