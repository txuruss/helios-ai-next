'use client'

import { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { getDemoModeState, loadDemoData, resetDemoData } from '@/lib/actions/demo'
import { DEMO_BUSINESS } from '@/lib/demo/demo-data'
import { capture } from '@/lib/analytics/posthog'

function relTime(ts: string): string {
  const d = Date.now() - new Date(ts).getTime()
  const m = Math.floor(d / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}

export default function DemoModeCard() {
  const [active,    setActive]    = useState(false)
  const [loadedAt,  setLoadedAt]  = useState<string | null>(null)
  const [confirm,   setConfirm]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [msg,       setMsg]       = useState<string | null>(null)
  const [pending,   startLoad]    = useTransition()
  const [resetting, startReset]   = useTransition()

  useEffect(() => {
    startLoad(async () => {
      const result = await getDemoModeState()
      setActive(result.active)
      setLoadedAt(result.loadedAt)
    })
  }, [])

  const handleLoad = () => {
    if (!confirm) { setConfirm(true); return }
    setError(null); setMsg(null)
    startLoad(async () => {
      const result = await loadDemoData(true)
      if (result.error) { setError(result.error); return }
      setActive(true)
      setLoadedAt(new Date().toISOString())
      setConfirm(false)
      setMsg(`Demo data loaded for ${DEMO_BUSINESS.name}.`)
      capture('demo_mode_loaded', { demo_business: DEMO_BUSINESS.name })
    })
  }

  const handleReset = () => {
    setError(null); setMsg(null)
    startReset(async () => {
      const result = await resetDemoData()
      if (result.error) { setError(result.error); return }
      setActive(false)
      setLoadedAt(null)
      setMsg('Demo data removed.')
      capture('demo_mode_reset', {})
    })
  }

  return (
    <div className={`border rounded-2xl p-5 transition-all ${
      active
        ? 'border-[#3b9eff]/30 bg-gradient-to-b from-[#3b9eff]/[0.05] to-[#0f1012]'
        : 'border-white/[0.07] bg-[#0f1012]'
    }`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <p className="text-[13px] font-semibold text-white">Demo Mode</p>
            {active && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#3b9eff]/15 text-[#3b9eff] font-medium">Active</span>
            )}
          </div>
          <p className="text-[12px] text-[#6a6a6e] leading-relaxed">
            Load sample data for <strong className="text-[#9a9a9d]">{DEMO_BUSINESS.name}</strong> to preview the dashboard
            without real customers or bookings.
          </p>
        </div>
        <span className="text-[22px] shrink-0">🎭</span>
      </div>

      {/* Status */}
      {active && loadedAt && (
        <div className="mb-3 px-3 py-2 rounded-xl border border-[#3b9eff]/20 bg-[#3b9eff]/[0.06]">
          <p className="text-[11.5px] text-[#3b9eff]">Demo data loaded {relTime(loadedAt)}</p>
          <p className="text-[10.5px] text-[#6a6a6e] mt-0.5">
            Sample services, FAQs, leads, and conversations are active.
          </p>
        </div>
      )}

      {/* Warning */}
      <div className="mb-3 px-3 py-2 rounded-xl border border-[#ffae3c]/20 bg-[#ffae3c]/[0.04]">
        <p className="text-[11.5px] text-[#ffae3c]">
          ⚠ Demo Mode uses sample data. No emails, WhatsApp messages, bookings, or payments are sent.
        </p>
      </div>

      {error && <p className="text-[11.5px] text-[#ff8a7a] mb-2">{error}</p>}
      {msg   && <p className="text-[11.5px] text-[#22d093] mb-2">{msg}</p>}

      {/* Confirm prompt */}
      {confirm && !active && (
        <div className="mb-3 px-3 py-2.5 rounded-xl border border-white/[0.10] bg-white/[0.025] text-[12px] text-[#9a9a9d]">
          This will add sample services, FAQs, and leads tagged with [Demo]. Click Load Demo again to confirm.
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        {!active && (
          <button
            onClick={handleLoad}
            disabled={pending}
            className="h-9 px-4 rounded-[10px] text-[13px] border border-[#3b9eff]/30 bg-[#3b9eff]/[0.08] text-[#3b9eff]
                       hover:bg-[#3b9eff]/15 transition-all disabled:opacity-40"
          >
            {pending ? 'Loading…' : confirm ? 'Confirm: Load Demo →' : 'Load Demo Business'}
          </button>
        )}
        {active && (
          <button
            onClick={handleReset}
            disabled={resetting}
            className="h-9 px-4 rounded-[10px] text-[13px] border border-[#ff8a7a]/30 bg-[#ff8a7a]/[0.08] text-[#ff8a7a]
                       hover:bg-[#ff8a7a]/15 transition-all disabled:opacity-40"
          >
            {resetting ? 'Resetting…' : '✕ Reset Demo Data'}
          </button>
        )}
        {confirm && (
          <button
            onClick={() => setConfirm(false)}
            className="h-9 px-3 rounded-[10px] text-[13px] border border-white/[0.10] text-[#9a9a9d] hover:bg-white/[0.04] transition-all"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Demo links */}
      <div className="flex gap-3 mt-3 pt-3 border-t border-white/[0.06] flex-wrap">
        <Link href="/demo" target="_blank"
          className="text-[11.5px] text-[#9a9a9d] hover:text-white transition-colors"
          onClick={() => capture('demo_page_viewed', { source: 'dashboard' })}>
          View /demo →
        </Link>
        <Link href="/demo/widget" target="_blank"
          className="text-[11.5px] text-[#9a9a9d] hover:text-white transition-colors"
          onClick={() => capture('demo_widget_opened', { source: 'dashboard' })}>
          Widget Sandbox →
        </Link>
        <Link href="/dashboard/setup"
          className="text-[11.5px] text-[#9a9a9d] hover:text-white transition-colors"
          onClick={() => capture('demo_recording_checklist_viewed', {})}>
          QA Checklist →
        </Link>
      </div>
    </div>
  )
}
