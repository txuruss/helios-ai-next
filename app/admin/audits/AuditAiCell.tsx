'use client'

// Display-only AI status for the audit row's "Score / AI" column.
// The Run AI Audit / View AI Result actions now live in the row action
// menu (AuditActionsCell); this cell only renders status so the AI state
// is always visible without horizontal scroll.

import type { AuditAiResult } from '@/lib/data/admin-audit-ai'

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  not_run:   { label: 'AI · Not run', color: '#6a6a6e' },
  running:   { label: 'AI · Running', color: '#3b9eff' },
  completed: { label: 'AI · Done',    color: '#22d093' },
  failed:    { label: 'AI · Failed',  color: '#ff5247' },
}
const PRIORITY_COLOR: Record<string, string> = {
  low: '#6a6a6e', medium: '#3b9eff', high: '#ffae3c', urgent: '#ff5247',
}

export default function AuditAiCell({
  result, aiConfigured, running = false,
}: {
  result:       AuditAiResult | undefined
  aiConfigured: boolean
  running?:     boolean
}) {
  const statusKey = running ? 'running' : (result?.status ?? 'not_run')
  const cfg = STATUS_CFG[statusKey]

  return (
    <div className="flex flex-col gap-1 min-w-[92px]">
      <span
        className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-[2px] rounded-full border w-fit whitespace-nowrap"
        style={{ color: cfg.color, borderColor: `${cfg.color}33`, background: `${cfg.color}12` }}
      >
        {cfg.label}
      </span>

      {result?.status === 'completed' && (
        <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-[#9a9a9d]">
          {result.fit_score !== null && <span className="tabular-nums">Fit {result.fit_score}</span>}
          {result.lead_priority && (
            <span className="capitalize" style={{ color: PRIORITY_COLOR[result.lead_priority] ?? '#9a9a9d' }}>
              {result.lead_priority}
            </span>
          )}
          {result.recommended_offer && <span className="text-[#a07cff]">{result.recommended_offer}</span>}
        </div>
      )}

      {!aiConfigured && !result && (
        <span className="text-[10px] text-[#6a6a6e]" title="Set RELEVANCE_AI_API_KEY and RELEVANCE_AI_AGENT_ID">
          Not connected
        </span>
      )}
    </div>
  )
}
