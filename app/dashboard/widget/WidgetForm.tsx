'use client'

import { useActionState, useState } from 'react'
import { upsertWidgetSettings } from '@/lib/actions/widget'
import type { WidgetSettings } from '@/types'

interface Props {
  settings: WidgetSettings | null
  businessId: string | null
  appUrl: string
}

const fieldCls =
  'h-[46px] rounded-[10px] border border-white/10 bg-white/[0.025] px-3.5 text-[14px] text-white ' +
  'placeholder:text-[#6a6a6e] outline-none transition-all focus:border-[#ff7a18]/50 disabled:opacity-50'
const labelCls = 'text-[12px] font-medium uppercase tracking-[0.1em] text-[#6a6a6e] mb-1.5 block'

export default function WidgetForm({ settings, businessId, appUrl }: Props) {
  const [state, formAction, pending] = useActionState(upsertWidgetSettings, {})

  const [previewColor, setPreviewColor] = useState(settings?.primary_color ?? '#ff7a18')
  const [botName, setBotName] = useState(settings?.bot_name ?? 'Helios AI')
  const [welcomeMsg, setWelcomeMsg] = useState(settings?.welcome_message ?? 'Hi! How can I help you today?')

  const embedCode = `<script\n  src="${appUrl}/widget.js"\n  data-business="${businessId ?? 'YOUR_BUSINESS_ID'}"\n  data-theme="dark">\n</script>`

  return (
    <>
      {state.error && (
        <div className="mb-5 px-4 py-3 rounded-xl bg-[#ff6a5a]/10 border border-[#ff6a5a]/30 text-[13.5px] text-[#ff8a7a]">
          {state.error}
        </div>
      )}
      {state.success && (
        <div className="mb-5 px-4 py-3 rounded-xl bg-[#22d093]/10 border border-[#22d093]/30 text-[13.5px] text-[#22d093]">
          {state.success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Controls */}
        <form action={formAction} className="border border-white/10 rounded-2xl p-6 flex flex-col gap-5">
          <h3 className="text-[16px] font-semibold">Branding Controls</h3>

          <div className="flex flex-col gap-2">
            <label className={labelCls}>Bot Name</label>
            <input name="bot_name" type="text" value={botName} onChange={(e) => setBotName(e.target.value)}
              className={fieldCls + ' w-full'} disabled={pending} />
          </div>

          <div className="flex flex-col gap-2">
            <label className={labelCls}>Welcome Message</label>
            <textarea name="welcome_message" rows={2} value={welcomeMsg} onChange={(e) => setWelcomeMsg(e.target.value)}
              className="rounded-[10px] border border-white/10 bg-white/[0.025] px-3.5 py-3 text-[14px] text-white placeholder:text-[#6a6a6e] outline-none resize-none transition-all focus:border-[#ff7a18]/50 disabled:opacity-50"
              disabled={pending} />
          </div>

          <div className="flex flex-col gap-2">
            <label className={labelCls}>Placeholder Text</label>
            <input name="placeholder_text" type="text" defaultValue={settings?.placeholder_text ?? 'Type a message…'}
              className={fieldCls + ' w-full'} disabled={pending} />
          </div>

          <div className="flex flex-col gap-2">
            <label className={labelCls}>Primary Color</label>
            <div className="flex items-center gap-3">
              <input type="color" value={previewColor} onChange={(e) => setPreviewColor(e.target.value)}
                className="w-12 h-10 rounded-lg border border-white/10 bg-transparent cursor-pointer p-1" />
              <input name="primary_color" type="text" value={previewColor} onChange={(e) => setPreviewColor(e.target.value)}
                className={fieldCls + ' flex-1 font-mono'} disabled={pending} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className={labelCls}>Position</label>
            <select name="position" defaultValue={settings?.position ?? 'bottom-right'}
              className={fieldCls + ' w-full appearance-none'} disabled={pending}>
              <option value="bottom-right">Bottom Right</option>
              <option value="bottom-left">Bottom Left</option>
            </select>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
            <label className="flex items-center gap-2 text-[13.5px] cursor-pointer">
              <input type="checkbox" name="is_enabled" defaultChecked={settings?.is_enabled ?? true}
                className="w-4 h-4 rounded accent-[#ff7a18]" disabled={pending} />
              Widget enabled
            </label>
            <button type="submit" disabled={pending} className="btn-primary btn-sm disabled:opacity-60">
              {pending
                ? <><span className="w-4 h-4 rounded-full border-2 border-[#1a0c00]/30 border-t-[#1a0c00] animate-spin" /> Saving…</>
                : 'Save Settings'}
            </button>
          </div>
        </form>

        {/* Preview + Embed */}
        <div className="flex flex-col gap-5">
          <div className="border border-white/10 rounded-2xl p-6">
            <h3 className="text-[16px] font-semibold mb-4">Live Preview</h3>
            <div className="relative bg-gradient-to-br from-[#141518] to-[#0a0b0d] rounded-xl border border-white/[0.06] h-64 overflow-hidden">
              {/* Mock chat messages */}
              <div className="absolute inset-0 flex flex-col justify-end p-4 gap-2">
                <div className="flex items-end gap-2">
                  <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px]"
                    style={{ background: previewColor }}>✦</div>
                  <div className="bg-white/[0.06] border border-white/[0.08] rounded-2xl rounded-bl-md px-3 py-2 max-w-[70%]">
                    <p className="text-[12px] font-medium text-white mb-0.5">{botName}</p>
                    <p className="text-[12px] text-[#9a9a9d]">{welcomeMsg}</p>
                  </div>
                </div>
              </div>
              {/* FAB */}
              <div className="absolute bottom-4 right-4 w-12 h-12 rounded-full flex items-center justify-center text-lg shadow-[0_0_20px_rgba(255,122,24,0.35)]"
                style={{ background: previewColor }}>
                💬
              </div>
            </div>
          </div>

          <div className="border border-white/10 rounded-2xl p-6">
            <h3 className="text-[16px] font-semibold mb-3">Embed Code</h3>
            <p className="text-[13.5px] text-[#9a9a9d] mb-4">
              Paste before the closing <code className="font-mono text-[#5be3c5]">&lt;/body&gt;</code> tag on your website.
            </p>
            <pre className="font-mono text-[12px] text-[#5be3c5] bg-[#070708] border border-white/[0.06] rounded-xl p-4 overflow-x-auto whitespace-pre-wrap break-all">
              {embedCode}
            </pre>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(embedCode)}
              className="btn-ghost btn-sm mt-3">
              Copy Code
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
