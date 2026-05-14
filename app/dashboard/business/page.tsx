import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/dashboard/PageHeader'
import BusinessForm from './BusinessForm'
import FaqsSection from './FaqsSection'
import type { FAQ } from '@/types'

export default async function BusinessPage() {
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

  const [bizResult, faqResult] = await Promise.all([
    membership
      ? supabase.from('businesses').select('*').eq('id', membership.business_id).single()
      : Promise.resolve({ data: null }),
    membership
      ? supabase.from('faqs').select('*').eq('business_id', membership.business_id).order('sort_order').order('created_at')
      : Promise.resolve({ data: [] as FAQ[] }),
  ])

  const business = bizResult.data
  const faqs = (faqResult.data ?? []) as FAQ[]

  return (
    <>
      <PageHeader
        eyebrow="Business"
        title="Business Profile"
        description="Configure your business details, operating hours, and notification settings."
      />
      <div className="flex flex-col gap-8">
        <BusinessForm business={business} />
        {membership && <FaqsSection initialFaqs={faqs} />}
      </div>
    </>
  )
}
