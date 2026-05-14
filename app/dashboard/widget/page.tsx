import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/dashboard/PageHeader'
import CopyButton from './CopyButton'

export default async function WidgetPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('business_members').select('business_id').eq('user_id', user?.id ?? '').limit(1).single()

  const { data: settings } = membership
    ? await supabase.from('widget_settings').select('*').eq('business_id', membership.business_id).single()
    : { data: null }

  const embedCode = `<script
  src="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://helios.ai'}/widget.js"
  data-business="${membership?.business_id ?? 'YOUR_BUSINESS_ID'}"
  data-theme="dark">
</script>`

  return (
    <>
      <PageHeader
        eyebrow="AI Widget"
        title="Widget"
        description="Configure your AI chat widget branding and get the embed code for your website."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Branding controls */}
        <div className="border border-white/10 rounded-2xl p-6 flex flex-col gap-5">
          <h3 className="text-[16px] font-semibold">Branding Controls</h3>

          <div className="flex flex-col gap-2">
            <label className="text-[12px] font-medium uppercase tracking-[0.1em] text-[#6a6a6e]">Bot Name</label>
            <input type="text" defaultValue={settings?.bot_name ?? 'Helios AI Assistant'}
              className="h-[46px] rounded-[10px] border border-white/10 bg-white/[0.025] px-3.5 text-[14px] text-white
                         placeholder:text-[#6a6a6e] outline-none focus:border-[#ff7a18]/50 transition-all" />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[12px] font-medium uppercase tracking-[0.1em] text-[#6a6a6e]">Welcome Message</label>
            <textarea rows={2} defaultValue={settings?.welcome_message ?? 'Hi! How can I help you today?'}
              className="rounded-[10px] border border-white/10 bg-white/[0.025] px-3.5 py-3 text-[14px] text-white
                         placeholder:text-[#6a6a6e] outline-none resize-none focus:border-[#ff7a18]/50 transition-all" />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[12px] font-medium uppercase tracking-[0.1em] text-[#6a6a6e]">Primary Color</label>
            <div className="flex items-center gap-3">
              <input type="color" defaultValue={settings?.primary_color ?? '#ff7a18'}
                className="w-12 h-10 rounded-lg border border-white/10 bg-transparent cursor-pointer p-1" />
              <input type="text" defaultValue={settings?.primary_color ?? '#ff7a18'}
                className="flex-1 h-[46px] rounded-[10px] border border-white/10 bg-white/[0.025] px-3.5 text-[14px] text-white
                           font-mono outline-none focus:border-[#ff7a18]/50 transition-all" />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
            <div className="flex items-center gap-2 text-[13.5px]">
              <input type="checkbox" defaultChecked={settings?.is_enabled ?? true}
                className="w-4 h-4 rounded accent-[#ff7a18]" />
              <span>Widget enabled</span>
            </div>
            <button className="btn-primary btn-sm">Save Settings</button>
          </div>
        </div>

        {/* Preview + Embed */}
        <div className="flex flex-col gap-5">
          {/* Preview */}
          <div className="border border-white/10 rounded-2xl p-6">
            <h3 className="text-[16px] font-semibold mb-4">Live Preview</h3>
            <div className="relative bg-gradient-to-br from-[#141518] to-[#0a0b0d] rounded-xl border border-white/[0.06]
                            h-64 flex items-end justify-end p-4">
              <div className="text-[12px] text-[#6a6a6e] absolute inset-0 flex items-center justify-center">
                Phase 2: Live widget preview renders here
              </div>
              <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl
                              shadow-[0_0_30px_rgba(255,122,24,0.4)]"
                   style={{ background: settings?.primary_color ?? '#ff7a18' }}>
                💬
              </div>
            </div>
          </div>

          {/* Embed code */}
          <div className="border border-white/10 rounded-2xl p-6">
            <h3 className="text-[16px] font-semibold mb-3">Embed Code</h3>
            <p className="text-[13.5px] text-[#9a9a9d] mb-4">
              Paste this snippet before the closing <code className="font-mono text-[#5be3c5]">&lt;/body&gt;</code> tag on your website.
            </p>
            <pre className="font-mono text-[12px] text-[#5be3c5] bg-[#070708] border border-white/[0.06]
                            rounded-xl p-4 overflow-x-auto whitespace-pre-wrap break-all">
              {embedCode}
            </pre>
            <CopyButton code={embedCode} />
          </div>
        </div>
      </div>
    </>
  )
}
