import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import PageHeader from '@/components/dashboard/PageHeader'
import WidgetSettingsForm from './WidgetSettingsForm'
import { randomBytes } from 'crypto'
import type { WidgetSettings } from '@/types'

export default async function WidgetPage() {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()

  const membership = user
    ? await authClient
        .from('business_members')
        .select('business_id')
        .eq('user_id', user.id)
        .limit(1)
        .single()
        .then((r) => r.data)
    : null

  let settings: WidgetSettings | null = null

  if (membership?.business_id) {
    const { data } = await authClient
      .from('widget_settings')
      .select('*')
      .eq('business_id', membership.business_id)
      .single()

    settings = data as WidgetSettings | null

    // Auto-generate a widget_id if missing (safe server-side only)
    if (settings && !settings.widget_id && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const newWidgetId = `wgt_${randomBytes(10).toString('hex')}`
      const db = createServiceRoleClient()
      await db
        .from('widget_settings')
        .update({ widget_id: newWidgetId })
        .eq('business_id', membership.business_id)
      settings = { ...settings, widget_id: newWidgetId }
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="AI Widget"
        title="Widget"
        description="Configure your chat widget, get your embed code, and install it on your website."
      />

      {!membership && (
        <div className="px-5 py-4 rounded-2xl border border-[#ffae3c]/30 bg-[#ffae3c]/[0.05] text-[13.5px] text-[#ffae3c]">
          Set up your business profile first to enable the widget.
        </div>
      )}

      {membership && (
        <WidgetSettingsForm
          settings={settings}
          appUrl={process.env.NEXT_PUBLIC_APP_URL ?? 'https://helios.ai'}
        />
      )}
    </>
  )
}
