'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { updateSetupItem, toggleAiPaused, approveLaunch } from '@/lib/actions/setup'
import { computeSetupPercent } from '@/lib/validation/setup'
import type { SetupProgress } from '@/lib/actions/setup'
import { SETUP_ITEM_KEYS, SETUP_ITEM_LABELS } from '@/lib/validation/setup'
import type { SetupItemKey } from '@/lib/validation/setup'
import { capture } from '@/lib/analytics/posthog'

interface Props {
  initialProgress:   SetupProgress | null
  initialAiPaused:   boolean
}

export default function SetupChecklistClient({ initialProgress, initialAiPaused }: Props) {
  const [progress,  setProgress]  = useState(initialProgress)
  const [aiPaused,  setAiPaused]  = useState(initialAiPaused)
  const [pauseReason, setPauseReason] = useState('')
  const [error,     setError]     = useState<string | null>(null)
  const [msg,       setMsg]       = useState<string | null>(null)
  const [saving,    startSave]    = useTransition()

  const percent          = computeSetupPercent(progress as Record<string, unknown> | null)
  const completedCount   = SETUP_ITEM_KEYS.filter((k) => progress?.[k]).length
  const isLaunched       = progress?.launch_approved ?? false

  const handleToggle = (key: SetupItemKey, current: boolean) => {
    setError(null)
    startSave(async () => {
      const result = await updateSetupItem(key, !current)
      if (result.error) { setError(result.error); return }
      setProgress((prev) => prev ? { ...prev, [key]: !current, updated_at: new Date().toISOString() } : prev)
    })
  }

  const handleToggleAi = () => {
    setError(null)
    startSave(async () => {
      const result = await toggleAiPaused(!aiPaused, pauseReason || undefined)
      if (result.error) { setError(result.error); return }
      setAiPaused((v) => !v)
      setMsg(result.success ?? null)
      setTimeout(() => setMsg(null), 3000)
    })
  }

  const handleLaunch = () => {
    startSave(async () => {
      const result = await approveLaunch()
      if (result.error) { setError(result.error); return }
      setProgress((prev) => prev ? { ...prev, launch_approved: true } : prev)
      capture('launch_approved', {})
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-[12px] text-[#ff8a7a]">{error}</p>}
      {msg   && <p className="text-[12px] text-[#22d093]">{msg}</p>}

      {/* Checklist */}
      <div className="border border-white/[0.07] rounded-2xl overflow-hidden bg-[#0f1012]">
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <p className="text-[13px] font-semibold text-white">Setup Checklist</p>
          <span className="text-[11.5px] text-[#6a6a6e]">{completedCount} of {SETUP_ITEM_KEYS.length} complete</span>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {SETUP_ITEM_KEYS.map((key) => {
            const meta    = SETUP_ITEM_LABELS[key]
            const done    = progress?.[key] ?? false
            const isLaunch = key === 'launch_approved'
            return (
              <div key={key} className={`flex items-start gap-4 px-5 py-4 transition-colors ${done ? 'opacity-70' : 'hover:bg-white/[0.015]'}`}>
                <button
                  onClick={() => isLaunch ? undefined : handleToggle(key, done)}
                  disabled={saving || isLaunch}
                  className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                    done ? 'border-[#22d093] bg-[#22d093]' : 'border-white/[0.20] hover:border-white/40'
                  } disabled:opacity-40`}
                >
                  {done && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="m4 12 5 5 11-12"/></svg>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px]">{meta.icon}</span>
                    <p className={`text-[14px] font-medium ${done ? 'text-[#6a6a6e] line-through' : 'text-white'}`}>{meta.label}</p>
                    {isLaunch && done && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#22d093]/15 text-[#22d093]">Live</span>}
                  </div>
                  <p className="text-[12.5px] text-[#6a6a6e] mt-0.5 leading-relaxed">{meta.desc}</p>
                </div>
                {!done && !isLaunch && (
                  <Link href={meta.href}
                    className="shrink-0 h-8 px-3 rounded-lg text-[12px] border border-white/[0.10] text-[#9a9a9d]
                               hover:bg-white/[0.06] hover:text-white transition-all">
                    Go →
                  </Link>
                )}
                {isLaunch && !done && completedCount >= 8 && (
                  <button onClick={handleLaunch} disabled={saving}
                    className="shrink-0 h-8 px-3 rounded-lg text-[12px] font-medium
                               bg-gradient-to-b from-[#22d093] to-[#19a572] text-[#001a0f]
                               hover:opacity-90 transition-opacity disabled:opacity-40">
                    {saving ? '…' : 'Approve'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Progress bar */}
      {percent < 100 && (
        <div className="flex items-center gap-3 px-1">
          <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${percent}%`, background: 'linear-gradient(90deg, #ff8a2a, #ffae3c)' }} />
          </div>
          <span className="text-[11.5px] text-[#6a6a6e] shrink-0">{percent}%</span>
        </div>
      )}

      {/* AI Pause Control */}
      <div className={`border rounded-2xl p-5 ${
        aiPaused ? 'border-[#ffae3c]/30 bg-[#ffae3c]/[0.04]' : 'border-white/[0.07] bg-[#0f1012]'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[14px] font-semibold text-white">AI Pause Mode</p>
            <p className="text-[12px] text-[#6a6a6e] mt-0.5">
              {aiPaused
                ? 'AI replies are paused. Customers will see a safe fallback message.'
                : 'AI is active and replying to customers automatically.'}
            </p>
          </div>
          <div className={`w-10 h-5 rounded-full relative transition-colors ${aiPaused ? 'bg-[#ffae3c]' : 'bg-[#22d093]'}`}>
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${aiPaused ? 'translate-x-0.5' : 'translate-x-5'}`} />
          </div>
        </div>
        {!aiPaused && (
          <input
            value={pauseReason}
            onChange={(e) => setPauseReason(e.target.value)}
            placeholder="Reason for pausing (optional)"
            maxLength={256}
            className="w-full h-9 rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 text-[12.5px]
                       text-white placeholder-[#6a6a6e] outline-none focus:border-[#ffae3c]/40 mb-3"
          />
        )}
        <button onClick={handleToggleAi} disabled={saving}
          className={`h-9 px-4 rounded-lg text-[13px] font-medium transition-all disabled:opacity-40 ${
            aiPaused
              ? 'bg-[#22d093]/15 border border-[#22d093]/30 text-[#22d093] hover:bg-[#22d093]/25'
              : 'bg-[#ffae3c]/15 border border-[#ffae3c]/30 text-[#ffae3c] hover:bg-[#ffae3c]/25'
          }`}>
          {saving ? '…' : aiPaused ? '▶ Resume AI' : '⏸ Pause AI'}
        </button>
        {aiPaused && (
          <p className="text-[11px] text-[#6a6a6e] mt-2">
            When paused, customers see: &ldquo;The team has paused automated replies. Someone will follow up soon.&rdquo;
          </p>
        )}
      </div>
    </div>
  )
}
