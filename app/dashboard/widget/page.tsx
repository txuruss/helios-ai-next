import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/dashboard/PageHeader'
import WidgetForm from './WidgetForm'
import type { WidgetSettings } from '@/types'

export default async function WidgetPage() {
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

  const { data: settings } = membership
    ? await supabase
        .from('widget_settings')
        .select('*')
        .eq('business_id', membership.business_id)
        .single()
    : { data: null }

  return (
    <>
      <PageHeader
        eyebrow="AI Widget"
        title="Widget"
        description="Configure your AI chat widget branding and get the embed code for your website."
      />
      <WidgetForm
        settings={settings as WidgetSettings | null}
        businessId={membership?.business_id ?? null}
        appUrl={process.env.NEXT_PUBLIC_APP_URL ?? 'https://helios.ai'}
      />
    </>
  )
}
