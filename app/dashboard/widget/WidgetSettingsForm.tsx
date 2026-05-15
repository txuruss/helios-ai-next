'use client'

import { useActionState, useState, useTransition } from 'react'
import Link from 'next/link'
import { upsertWidgetSettings, regenerateWidgetId } from '@/lib/actions/widget'
import WidgetPreview from './WidgetPreview'
import EmbedCodeBox from './EmbedCodeBox'
import type { WidgetSettings } from '@/types'

interface Props {
  settings:    WidgetSettings | null
  appUrl:      string
  currentPlan: string
}

const fieldCls =
  'h-[46px] rounded-[10px] border border-white/10 bg-white/[0.025] px-3.5 text-[14px] text-white ' +
  'placeholder:text-[#6a6a6e] outline-none transition-all focus:border-[#ff7a18]/50 disabled:opacity-50'
const labelCls = 'text-[12px] font-medium uppercase tracking-[0.1em] text-[#6a6a6e] mb-1.5 block'

export default function WidgetSettingsForm({ settings, appUrl, currentPlan }: Props) {
  // Pro and Scale plans can hide the "Powered by Helios AI" badge.
  // Starter is always required — server enforces this; UI just shows why.
  const canHidePoweredBy = currentPlan === 'pro' || currentPlan === 'scale'
  const [state, formAction, pending] = useActionState(upsertWidgetSettings, {})

  const [previewColor, setPreviewColor] = useState(settings?.primary_color ?? '#ff7a18')
  const [botName,      setBotName]      = useState(settings?.bot_name       ?? 'Helios AI')
  const [welcomeMsg,   setWelcomeMsg]   = useState(settings?.welcome_message ?? 'Hi! How can I help you today?')
  const [widgetId,     setWidgetId]     = useState(settings?.widget_id ?? null)

  const [regenPending, startRegen] = useTransition()
  const [regenMsg,     setRegenMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const handleRegen = () => {
    if (!confirm('Regenerate Widget ID? The current embed code will stop working — you will need to update it on all websites.')) return
    startRegen(async () => {
      const result = await regenerateWidgetId()
      if (result.widget_id) {
        setWidgetId(result.widget_id)
        setRegenMsg({ ok: true, text: 'Widget ID regenerated. Update your embed code on all websites.' })
      } else {
        setRegenMsg({ ok: false, text: result.error ?? 'Could not regenerate widget ID.' })
      }
    })
  }

  const currentWidgetId = widgetId ?? 'SAVE_SETTINGS_TO_GENERATE'

  return (
    <>
      {/* Status messages */}
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
      {regenMsg && (
        <div className={`mb-5 px-4 py-3 rounded-xl text-[13.5px] ${
          regenMsg.ok
            ? 'bg-[#22d093]/10 border border-[#22d093]/30 text-[#22d093]'
            : 'bg-[#ff6a5a]/10 border border-[#ff6a5a]/30 text-[#ff8a7a]'
        }`}>
          {regenMsg.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings form */}
        <form action={formAction} className="border border-white/10 rounded-2xl p-6 flex flex-col gap-5">
          <h3 className="text-[16px] font-semibold">Branding Settings</h3>

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
            <label className={labelCls}>Logo URL <span className="normal-case text-[#6a6a6e]">(optional)</span></label>
            <input name="logo_url" type="url" defaultValue={settings?.logo_url ?? ''}
              placeholder="https://yourdomain.com/logo.png"
              className={fieldCls + ' w-full'} disabled={pending} />
          </div>

          <div className="flex flex-col gap-2">
            <label className={labelCls}>Position</label>
            <select name="position" defaultValue={settings?.position ?? 'bottom-right'}
              className={fieldCls + ' w-full appearance-none'} disabled={pending}>
              <option value="bottom-right">Bottom Right</option>
              <option value="bottom-left">Bottom Left</option>
            </select>
          </div>

          {/* Powered by Helios AI branding — plan-gated */}
          <div className="pt-3 border-t border-white/[0.06] flex flex-col gap-2">
            <label className={`flex items-center gap-2.5 text-[13.5px] ${canHidePoweredBy ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'}`}>
              <input
                type="checkbox"
                name="show_powered_by"
                defaultChecked={
                  !canHidePoweredBy
                    ? true                                    // Starter: always checked
                    : (settings?.show_powered_by ?? true)     // Pro/Scale: stored value
                }
                disabled={pending || !canHidePoweredBy}
                className="w-4 h-4 rounded accent-[#ff7a18]"
              />
              Show &ldquo;Powered by Helios AI&rdquo;
            </label>
            {!canHidePoweredBy && (
              <p className="text-[12px] text-[#6a6a6e] ml-[26px]">
                <Link href="/dashboard/settings/billing"
                  className="text-[#ffae3c] hover:text-[#ff7a18] transition-colors underline underline-offset-2">
                  Upgrade to Pro
                </Link>
                {' '}to hide the Helios AI badge from your widget.
              </p>
            )}
          </div>

          {/* Widget enabled + save */}
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

        {/* Right column */}
        <div className="flex flex-col gap-5">
          <WidgetPreview
            primaryColor={previewColor}
            botName={botName}
            welcomeMsg={welcomeMsg}
          />

          {widgetId ? (
            <EmbedCodeBox widgetId={currentWidgetId} appUrl={appUrl} />
          ) : (
            <div className="border border-white/10 rounded-2xl p-6">
              <h3 className="text-[16px] font-semibold mb-2">Embed Code</h3>
              <p className="text-[13.5px] text-[#9a9a9d]">Save your settings to generate the embed code.</p>
            </div>
          )}

          {/* Regenerate widget ID */}
          {widgetId && (
            <div className="border border-white/[0.06] rounded-2xl p-5">
              <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#6a6a6e] mb-2">Widget ID</div>
              <p className="font-mono text-[12px] text-[#9a9a9d] mb-3 break-all">{currentWidgetId}</p>
              <p className="text-[12px] text-[#6a6a6e] mb-3">
                Regenerating the widget ID will break all existing embed codes. Update every website where you have the widget installed.
              </p>
              <button
                type="button"
                onClick={handleRegen}
                disabled={regenPending}
                className="h-8 px-4 rounded-[9px] text-[12px] border border-[#ff6a5a]/25 text-[#ff8a7a] hover:bg-[#ff6a5a]/08 hover:border-[#ff6a5a]/40 transition-all disabled:opacity-40">
                {regenPending ? 'Regenerating…' : 'Regenerate Widget ID'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
