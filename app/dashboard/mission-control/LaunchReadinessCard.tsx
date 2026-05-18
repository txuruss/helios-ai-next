'use client'

import Link from 'next/link'
import { useState, useTransition, useEffect } from 'react'
import { runDemoQaChecks } from '@/lib/actions/demo-qa'
import type { DemoQaResult, QaCheckStatus } from '@/lib/actions/demo-qa'
import { capture } from '@/lib/analytics/posthog'

type Readiness = 'not_started' | 'in_progress' | 'ready_for_demo' | 'production_ready'

const READINESS_CONFIG: Record<Readiness, { label: string; color: string; bg: string; emoji: string }> = {
  not_started:     { label: 'Not Started',      color: '#6a6a6e', bg: 'border-white/[0.07] bg-[#0f1012]',         emoji: '○'  },
  in_progress:     { label: 'In Progress',       color: '#ffae3c', bg: 'border-[#ffae3c]/25 bg-[#ffae3c]/[0.04]', emoji: '⋯'  },
  ready_for_demo:  { label: 'Ready for Demo',    color: '#3b9eff', bg: 'border-[#3b9eff]/25 bg-[#3b9eff]/[0.04]', emoji: '🎬' },
  production_ready:{ label: 'Production Ready',  color: '#22d093', bg: 'border-[#22d093]/25 bg-[#22d093]/[0.04]', emoji: '🚀' },
}

const STATUS_DOT: Record<QaCheckStatus, string> = {
  passed:  'bg-[#22d093]',
  warning: 'bg-[#ffae3c]',
  failed:  'bg-[#ff8a7a]',
  skipped: 'bg-[#6a6a6e]',
}

export default function LaunchReadinessCard() {
  const [results,   setResults]   = useState<DemoQaResult[]>([])
  const [readiness, setReadiness] = useState<Readiness>('not_started')
  const [summary,   setSummary]   = useState({ passed: 0, warned: 0, failed: 0, skipped: 0, total: 0 })
  const [expanded,  setExpanded]  = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [pending,   startCheck]   = useTransition()

  const runChecks = () => {
    setError(null)
    startCheck(async () => {
      const result = await runDemoQaChecks()
      if (result.error) { setError(result.error); return }
      setResults(result.results)
      setReadiness(result.readiness)
      setSummary(result.summary)
      capture('launch_readiness_viewed', { readiness: result.readiness, passed: result.summary.passed })
    })
  }

  // Auto-run on mount
  useEffect(() => { runChecks() }, [])

  const cfg = READINESS_CONFIG[readiness]

  return (
    <div className={`border rounded-2xl overflow-hidden transition-all ${cfg.bg}`}>
      {/* Header — div instead of button to avoid nested-button hydration error */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded((v) => !v) } }}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/[0.02] transition-colors text-left cursor-pointer"
      >
        <span className="text-[22px] shrink-0">{cfg.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-[13px] font-semibold text-white">Launch Readiness</p>
            <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full border"
              style={{ color: cfg.color, borderColor: `${cfg.color}40`, background: `${cfg.color}12` }}>
              {cfg.label}
            </span>
          </div>
          {summary.total > 0 && (
            <div className="flex items-center gap-3 text-[11px] text-[#6a6a6e]">
              <span className="text-[#22d093]">✓ {summary.passed} passed</span>
              {summary.warned  > 0 && <span className="text-[#ffae3c]">⚠ {summary.warned} warn</span>}
              {summary.failed  > 0 && <span className="text-[#ff8a7a]">✗ {summary.failed} failed</span>}
              {summary.skipped > 0 && <span>{summary.skipped} skipped</span>}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); runChecks() }}
            disabled={pending}
            className="h-7 px-3 rounded-lg text-[11px] border border-white/[0.10] text-[#9a9a9d] hover:bg-white/[0.06] transition-all disabled:opacity-40"
          >
            {pending ? '…' : '↻'}
          </button>
          <span className="text-[#6a6a6e] text-[12px]">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Readiness message */}
      {!expanded && readiness !== 'not_started' && (
        <div className="px-5 pb-4">
          {readiness === 'production_ready' && (
            <p className="text-[12px] text-[#22d093]">All critical checks passed. Ready to launch.</p>
          )}
          {readiness === 'ready_for_demo' && (
            <p className="text-[12px] text-[#3b9eff]">Core setup complete. Ready for client demo.</p>
          )}
          {readiness === 'in_progress' && summary.failed > 0 && (
            <p className="text-[12px] text-[#ffae3c]">{summary.failed} check{summary.failed !== 1 ? 's' : ''} need attention before demo.</p>
          )}
        </div>
      )}

      {error && <p className="px-5 pb-3 text-[11.5px] text-[#ff8a7a]">{error}</p>}

      {/* Expanded check results */}
      {expanded && results.length > 0 && (
        <div className="border-t border-white/[0.06]">
          <div className="divide-y divide-white/[0.04]">
            {results.map((r) => (
              <div key={r.check_key} className="flex items-center gap-3 px-5 py-2.5">
                <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[r.status]}`} />
                <p className="text-[12.5px] text-white flex-1">{r.label}</p>
                <p className="text-[11px] text-[#6a6a6e] truncate max-w-[200px]">{r.note}</p>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div className="px-5 py-4 border-t border-white/[0.06] flex gap-2 flex-wrap">
            <Link href="/dashboard/setup"
              className="h-8 px-3 rounded-lg text-[12px] border border-[#ff7a18]/30 bg-[#ff7a18]/[0.06] text-[#ffae3c] hover:bg-[#ff7a18]/12 transition-all">
              Setup Guide →
            </Link>
            <Link href="/demo"
              className="h-8 px-3 rounded-lg text-[12px] border border-white/[0.10] text-[#9a9a9d] hover:bg-white/[0.04] hover:text-white transition-all"
              target="_blank" rel="noopener noreferrer">
              View /demo →
            </Link>
            {readiness === 'ready_for_demo' || readiness === 'production_ready' ? (
              <span className="h-8 px-3 rounded-lg text-[12px] flex items-center border border-[#22d093]/20 bg-[#22d093]/[0.06] text-[#22d093]">
                {readiness === 'production_ready' ? '🚀 Production Ready' : '🎬 Ready for Demo'}
              </span>
            ) : null}
          </div>
        </div>
      )}

      {/* No checks run yet */}
      {expanded && results.length === 0 && !pending && (
        <div className="px-5 py-6 text-center border-t border-white/[0.06]">
          <p className="text-[12.5px] text-[#6a6a6e] mb-3">Click refresh to run QA checks</p>
          <button onClick={runChecks}
            className="h-9 px-4 rounded-[10px] text-[13px] bg-gradient-to-b from-[#ff8a2a] to-[#ee6a0c] text-[#1a0c00] font-medium hover:opacity-90">
            Run Checks
          </button>
        </div>
      )}
    </div>
  )
}
