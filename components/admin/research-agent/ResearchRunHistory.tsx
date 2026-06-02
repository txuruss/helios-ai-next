'use client'

import { History } from 'lucide-react'
import type { ResearchRunSummary } from '@/lib/data/admin-research'

const STATUS_TONE: Record<string, string> = {
  pending:   '#6a6a6e',
  running:   '#3b9eff',
  completed: '#22d093',
  failed:    '#ff5247',
}

export default function ResearchRunHistory({ runs }: { runs: ResearchRunSummary[] }) {
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 overflow-hidden">
      <header className="flex items-center gap-2 px-5 py-3.5 border-b border-white/[0.04]">
        <History size={13} className="text-[#6a6a6e]" />
        <h2 className="text-[13.5px] font-semibold text-white">Research History</h2>
      </header>

      {runs.length === 0 ? (
        <div className="px-5 py-5 text-[12.5px] text-[#9a9a9d]">
          No research runs yet. Run a search above to start building history.
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-white/[0.04]">
          {runs.map((r) => {
            const tone = STATUS_TONE[r.status] ?? '#6a6a6e'
            return (
              <div key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-[12.5px] text-white truncate">{r.title ?? '(untitled run)'}</p>
                  <p className="text-[11px] text-[#6a6a6e] truncate">
                    {new Date(r.created_at).toLocaleString()}
                    {r.radius_km ? ` · ${r.radius_km}km` : ''}
                    {r.lead_target ? ` · target ${r.lead_target}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-[#9a9a9d] tabular-nums">{r.lead_count} saved</span>
                  <span className="inline-flex items-center text-[10px] font-semibold px-2 py-[2px] rounded-full border whitespace-nowrap capitalize"
                    style={{ color: tone, borderColor: `${tone}33`, background: `${tone}12` }}>
                    {r.status}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
