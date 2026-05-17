'use client'

import { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { getSetupProgress, updateSetupItem, approveLaunch } from '@/lib/actions/setup'
import type { SetupProgress } from '@/lib/actions/setup'
import { SETUP_ITEM_KEYS, SETUP_ITEM_LABELS, computeSetupPercent } from '@/lib/validation/setup'
import type { SetupItemKey } from '@/lib/validation/setup'
import { capture } from '@/lib/analytics/posthog'

export default function SetupProgressCard() {
  const [progress, setProgress]  = useState<SetupProgress | null>(null)
  const [error,    setError]     = useState<string | null>(null)
  const [pending,  startLoad]    = useTransition()
  const [saving,   startSave]    = useTransition()
  const [expanded, setExpanded]  = useState(false)

  useEffect(() => {
    capture('setup_checklist_viewed', {})
    startLoad(async () => {
      const result = await getSetupProgress()
      if (result.error) setError(result.error)
      else setProgress(result.progress)
    })
  }, [])

  const percent = computeSetupPercent(progress as Record<string, unknown> | null)
  const isLaunched = progress?.launch_approved ?? false
  const completedCount = SETUP_ITEM_KEYS.filter((k) => progress?.[k]).length
  const nextAction = SETUP_ITEM_KEYS.find((k) => !progress?.[k])

  const handleToggle = (key: SetupItemKey, current: boolean) => {
    startSave(async () => {
      const result = await updateSetupItem(key, !current)
      if (result.error) setError(result.error)
      else {
        setProgress((prev) => prev ? { ...prev, [key]: !current, updated_at: new Date().toISOString() } : prev)
      }
    })
  }

  const handleLaunch = () => {
    startSave(async () => {
      const result = await approveLaunch()
      if (result.error) setError(result.error)
      else setProgress((prev) => prev ? { ...prev, launch_approved: true } : prev)
    })
  }

  if (pending && !progress) {
    return (
      <div className="border border-white/[0.07] rounded-2xl p-5 bg-[#0f1012] animate-pulse">
        <div className="h-4 bg-white/[0.06] rounded w-1/2 mb-3" />
        <div className="h-2 bg-white/[0.04] rounded w-full" />
      </div>
    )
  }

  return (
    <div className={`border rounded-2xl overflow-hidden transition-all duration-300 ${
      isLaunched
        ? 'border-[#22d093]/30 bg-gradient-to-b from-[#22d093]/[0.05] to-[#0f1012]'
        : 'border-white/[0.07] bg-[#0f1012]'
    }`}>
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-[13px] font-semibold text-white">Setup Progress</p>
            {isLaunched && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#22d093]/15 text-[#22d093] font-medium">Live</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${percent}%`,
                  background: percent === 100 ? '#22d093' : 'linear-gradient(90deg, #ff8a2a, #ffae3c)',
                }}
              />
            </div>
            <span className="text-[11.5px] font-mono text-[#9a9a9d] shrink-0">{percent}%</span>
          </div>
        </div>
        <span className="text-[#6a6a6e] text-[12px] shrink-0">{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Next action hint */}
      {!expanded && nextAction && !isLaunched && (
        <div className="px-5 pb-4">
          <p className="text-[11.5px] text-[#6a6a6e]">
            Next: <Link href={SETUP_ITEM_LABELS[nextAction].href} className="text-[#ffae3c] hover:underline">
              {SETUP_ITEM_LABELS[nextAction].label}
            </Link>
          </p>
        </div>
      )}

      {error && <p className="px-5 pb-3 text-[11.5px] text-[#ff8a7a]">{error}</p>}

      {/* Checklist */}
      {expanded && (
        <div className="border-t border-white/[0.06]">
          <div className="divide-y divide-white/[0.04]">
            {SETUP_ITEM_KEYS.map((key) => {
              const meta    = SETUP_ITEM_LABELS[key]
              const done    = progress?.[key] ?? false
              const isLaunch = key === 'launch_approved'
              return (
                <div key={key} className="flex items-center gap-3 px-5 py-3">
                  <button
                    onClick={() => isLaunch ? undefined : handleToggle(key, done)}
                    disabled={saving || (isLaunch && !done)}
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                      done
                        ? 'border-[#22d093] bg-[#22d093]'
                        : 'border-white/[0.20] hover:border-white/40'
                    } disabled:opacity-40`}
                  >
                    {done && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="m4 12 5 5 11-12"/></svg>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px]">{meta.icon}</span>
                      <p className={`text-[13px] font-medium ${done ? 'text-[#9a9a9d] line-through' : 'text-white'}`}>
                        {meta.label}
                      </p>
                    </div>
                    <p className="text-[11px] text-[#6a6a6e] mt-0.5">{meta.desc}</p>
                  </div>
                  {!done && (
                    <Link
                      href={meta.href}
                      className="text-[11px] text-[#ffae3c] hover:underline shrink-0"
                    >
                      Go →
                    </Link>
                  )}
                </div>
              )
            })}
          </div>

          {/* Launch button */}
          {completedCount >= 8 && !isLaunched && (
            <div className="px-5 py-4 border-t border-white/[0.06]">
              <button
                onClick={handleLaunch}
                disabled={saving}
                className="w-full h-10 rounded-xl text-[13.5px] font-medium
                           bg-gradient-to-b from-[#22d093] to-[#19a572] text-[#001a0f]
                           hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {saving ? 'Saving…' : '🚀 Approve Launch'}
              </button>
              <p className="text-[10.5px] text-[#6a6a6e] text-center mt-2">
                Marks your system as live and ready for real customers.
              </p>
            </div>
          )}

          <div className="px-5 py-3 border-t border-white/[0.06]">
            <Link href="/dashboard/setup" className="text-[11.5px] text-[#6a6a6e] hover:text-white transition-colors">
              View full setup guide →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
