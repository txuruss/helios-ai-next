import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/dashboard/PageHeader'
import ChatTestClient from './ChatTestClient'
import Link from 'next/link'

export default async function ChatTestPage() {
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

  if (!membership) {
    return (
      <>
        <PageHeader eyebrow="AI Chat" title="Chat Test" />
        <div className="border border-white/10 rounded-2xl p-12 text-center">
          <div className="text-4xl mb-3">💬</div>
          <h3 className="text-[18px] font-semibold mb-2">Set up your business first</h3>
          <p className="text-[14px] text-[#9a9a9d] mb-5">
            Create your business profile to enable the AI chat assistant.
          </p>
          <Link href="/dashboard/business" className="btn-primary btn-sm">
            Set Up Business Profile
          </Link>
        </div>
      </>
    )
  }

  const [bizRes, agentRes, widgetRes] = await Promise.all([
    supabase.from('businesses').select('name').eq('id', membership.business_id).single(),
    supabase.from('agent_settings').select('agent_name').eq('business_id', membership.business_id).single(),
    supabase.from('widget_settings').select('primary_color, bot_name').eq('business_id', membership.business_id).single(),
  ])

  const businessName = bizRes.data?.name ?? 'Your Business'
  const botName      = agentRes.data?.agent_name ?? widgetRes.data?.bot_name ?? 'Helios AI'
  const primaryColor = widgetRes.data?.primary_color ?? '#ff7a18'

  // Env var check — show warning but still render so user can test setup
  const apiKeyMissing = !process.env.ANTHROPIC_API_KEY

  return (
    <>
      <PageHeader
        eyebrow="AI Chat"
        title="Chat Test Panel"
        description="Test your AI assistant live. Conversations are saved to chat sessions and leads are captured automatically."
      />

      {apiKeyMissing && (
        <div className="mb-6 flex items-center gap-3 px-5 py-4 rounded-xl
                        bg-[#ffae3c]/10 border border-[#ffae3c]/30 text-[13.5px] text-[#ffae3c]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="shrink-0">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span>
            <strong>ANTHROPIC_API_KEY</strong> is not set in your <code className="font-mono text-[12px]">.env.local</code>.
            Add your key and restart the dev server to enable the AI.
          </span>
        </div>
      )}

      <ChatTestClient
        businessId={membership.business_id}
        businessName={businessName}
        botName={botName}
        primaryColor={primaryColor}
      />
    </>
  )
}
