import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/dashboard/PageHeader'
import ServicesClient from './ServicesClient'
import type { Service } from '@/types'


export default async function ServicesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = user
    ? await supabase
        .from('business_members')
        .select('business_id')
        .eq('user_id', user.id)
        .limit(1)
        .single()
    : { data: null }

  const { data: services } = membership
    ? await supabase
        .from('services')
        .select('*')
        .eq('business_id', membership.business_id)
        .order('sort_order')
        .order('created_at')
    : { data: [] as Service[] }

  return (
    <>
      <PageHeader
        eyebrow="Services"
        title="Services"
        description="Define the services your AI assistant can book and answer questions about."
      />
      <ServicesClient initialServices={(services ?? []) as Service[]} />
    </>
  )
}
