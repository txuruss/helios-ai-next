'use client'

import { useState, useTransition, useEffect } from 'react'
import { getDemoQaChecks, updateDemoQaCheck } from '@/lib/actions/setup'
import type { DemoQaCheck } from '@/lib/actions/setup'
import { DEMO_QA_CHECKS } from '@/lib/validation/setup'
import { capture } from '@/lib/analytics/posthog'

type QaStatus = 'pending' | 'passed' | 'failed' | 'skipped'

const STATUS_CONFIG: Record<QaStatus, { label: string; bg: string; text: string }> = {
  pending: { label: 'Pending', bg: 'bg-white/[0.04]',     text: 'text-[#6a6a6e]' },
  passed:  { label: 'Passed',  bg: 'bg-[#22d093]/[0.10]', text: 'text-[#22d093]' },
  failed:  { label: 'Failed',  bg: 'bg-[#ff8a7a]/[0.10]', text: 'text-[#ff8a7a]' },
  skipped: { label: 'Skipped', bg: 'bg-white/[0.04]',     text: 'text-[#6a6a6e]' },
}

export default function DemoQaChecklist() {
  const [checks,  setChecks]  = useState<DemoQaCheck[]>([])
  const [error,   setError]   = useState<string | null>(null)
  const [loading, startLoad]  = useTransition()
  const [saving,  startSave]  = useTransition()

  const load = () => {
    startLoad(async () => {
      const result = await getDemoQaChecks()
      if (result.error) { setError(result.error); return }
      setChecks(result.checks)
    })
  }

  useEffect(() => { load() }, [])

  // Build display list: merge DB state with definitions
  const displayChecks = DEMO_QA_CHECKS.map((def) => {
    const saved = checks.find((c) => c.check_key === def.key)
    return {
      key:    def.key,
      label:  def.label,
      status: (saved?.check_status ?? 'pending') as QaStatus,
      notes:  saved?.notes ?? null,
    }
  })

  const passedCount = displayChecks.filter((c) => c.status === 'passed').length
  const percent     = Math.round((passedCount / displayChecks.length) * 100)
  const allPassed   = passedCount === displayChecks.length

  const handleCycle = (checkKey: string, checkLabel: string, current: QaStatus) => {
    const next: QaStatus = current === 'pending' ? 'passed' : current === 'passed' ? 'failed' : current === 'failed' ? 'skipped' : 'pending'
    startSave(async () => {
      const result = await updateDemoQaCheck(checkKey, next, checkLabel)
      if (result.error) { setError(result.error); return }
      setChecks((prev) => {
        const exists = prev.find((c) => c.check_key === checkKey)
        if (exists) return prev.map((c) => c.check_key === checkKey ? { ...c, check_status: next } : c)
        return [...prev, {
          id: checkKey, business_id: '', check_key: checkKey, check_label: checkLabel,
          check_status: next, notes: null, checked_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }]
      })
      if (allPassed || next === 'passed') capture('demo_qa_check_updated', { check_key: checkKey, status: next })
    })
  }

  return (
    <div className="flex flex-col gap-4 border-t border-white/[0.06] pt-6 mt-4">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-semibold text-[#6a6a6e] uppercase tracking-[0.12em]">Demo QA Checklist</p>
        <div className="flex items-center gap-3">
          <span className="text-[11.5px] text-[#6a6a6e]">{passedCount}/{displayChecks.length} passed</span>
          {allPassed && <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-[#22d093]/15 text-[#22d093]">✓ All passed</span>}
          <button onClick={load} disabled={loading}
            className="text-[11px] text-[#6a6a6e] hover:text-white transition-colors disabled:opacity-40">↻</button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${percent}%`, background: allPassed ? '#22d093' : 'linear-gradient(90deg,#ff8a2a,#ffae3c)' }} />
        </div>
        <span className="text-[11px] font-mono text-[#6a6a6e] shrink-0">{percent}%</span>
      </div>

      {error && <p className="text-[11.5px] text-[#ff8a7a]">{error}</p>}

      <p className="text-[11.5px] text-[#6a6a6e]">
        Click each item to cycle: Pending → Passed → Failed → Skipped
      </p>

      <div className="border border-white/[0.07] rounded-2xl overflow-hidden bg-[#0f1012]">
        <div className="divide-y divide-white/[0.04]">
          {displayChecks.map((c) => {
            const cfg = STATUS_CONFIG[c.status]
            return (
              <div key={c.key} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.015] transition-colors">
                <button
                  onClick={() => handleCycle(c.key, c.label, c.status)}
                  disabled={saving}
                  className={`shrink-0 h-7 px-2.5 rounded-lg text-[11px] font-medium transition-all disabled:opacity-40 ${cfg.bg} ${cfg.text} border border-white/[0.08]`}
                >
                  {cfg.label}
                </button>
                <p className={`text-[13px] flex-1 ${c.status === 'passed' ? 'text-[#6a6a6e] line-through' : 'text-white'}`}>
                  {c.label}
                </p>
                {c.status === 'passed' && (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22d093" strokeWidth="2.5" strokeLinecap="round" className="shrink-0">
                    <path d="m4 12 5 5 11-12"/>
                  </svg>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
