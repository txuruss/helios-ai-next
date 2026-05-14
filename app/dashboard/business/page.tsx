import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/dashboard/PageHeader'
import BusinessForm from './BusinessForm'

export default async function BusinessPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('business_members')
    .select('business_id')
    .eq('user_id', user?.id ?? '')
    .limit(1)
    .single()

  const { data: business } = membership
    ? await supabase.from('businesses').select('*').eq('id', membership.business_id).single()
    : { data: null }

  return (
    <>
      <PageHeader
        eyebrow="Business"
        title="Business Profile"
        description="Configure your business details, operating hours, and notification settings."
      />
      <BusinessForm business={business} />
    </>
  )
}
