'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { runAuditAiAnalysis } from '@/lib/actions/admin-audits'
import type { AuditAiResult } from '@/lib/data/admin-audit-ai'

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  not_run:   { label: 'Not run',   color: '#6a6a6e' },
  running:   { label: 'Running',   color: '#3b9eff' },
  completed: { label: 'Completed', color: '#22d093' },
  failed:    { label: 'Failed',    color: '#ff5247' },
}
const PRIORITY_COLOR: Record<string, string> = {
  low: '#6a6a6e', medium: '#3b9eff', high: '#ffae3c', urgent: '#ff5247',
}

export default function AuditAiCell({
  auditId, result, aiConfigured, onView,
}: {
  auditId: string
  result: AuditAiResult | undefined
  aiConfigured: boolean
  onView: () => void
}) {
  const router = useRouter()
  const [pending, start] = useTransition()

  function run() {
    start(async () => {
      const r = await runAuditAiAnalysis(auditId)
      if (!r.ok) alert(r.error ?? 'AI analysis failed.')
      router.refresh()
    })
  }

  const statusKey = pending ? 'running' : (result?.status ?? 'not_run')
  const cfg = STATUS_CFG[statusKey]

  return (
    <div className="flex flex-col gap-1 min-w-[120px]">
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-[2px] rounded-full border w-fit whitespace-nowrap"
        style={{ color: cfg.color, borderColor: `${cfg.color}33`, background: `${cfg.color}12` }}>
        {cfg.label}
      </span>

      {result?.status === 'completed' && (
        <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-[#9a9a9d]">
          {result.fit_score !== null && <span className="tabular-nums">Fit {result.fit_score}</span>}
          {result.lead_priority && (
            <span className="capitalize" style={{ color: PRIORITY_COLOR[result.lead_priority] ?? '#9a9a9d' }}>{result.lead_priority}</span>
          )}
          {result.recommended_offer && <span className="text-[#a07cff]">{result.recommended_offer}</span>}
        </div>
      )}

      <div className="flex items-center gap-2.5 text-[11px]">
        {aiConfigured ? (
          <button type="button" disabled={pending} onClick={run}
            className="inline-flex items-center gap-1 text-[#ffae3c] hover:text-white transition-colors disabled:opacity-50 focus:outline-none focus:underline">
            <Sparkles size={11} /> {pending ? 'Running…' : (result ? 'Re-run' : 'Run AI Audit')}
          </button>
        ) : (
          <span className="text-[#6a6a6e]" title="Set RELEVANCE_AI_API_KEY and RELEVANCE_AI_AGENT_ID">Not connected</span>
        )}
        {result && (
          <button type="button" onClick={onView}
            className="text-[#9a9a9d] hover:text-white transition-colors focus:outline-none focus:underline">View</button>
        )}
      </div>
    </div>
  )
}
