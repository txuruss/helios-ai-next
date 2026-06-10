'use client'

import { History, Eye, RotateCcw, Loader2 } from 'lucide-react'
import type { ResearchRunSummary } from '@/lib/data/admin-research'

const STATUS_TONE: Record<string, string> = {
  pending:   '#6a6a6e',
  running:   '#3b9eff',
  completed: '#22d093',
  failed:    '#ff5247',
}

interface Props {
  runs:         ResearchRunSummary[]
  loading:      boolean
  error:        string | null
  loadingRunId: string | null
  activeRunId:  string | null
  onViewResults: (id: string) => void
  onRerun:       (run: ResearchRunSummary) => void
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[#6a6a6e]">{label}</div>
      <div className="text-[11.5px] text-[#cfd3dc] truncate">{value}</div>
    </div>
  )
}

export default function ResearchRunHistory({
  runs, loading, error, loadingRunId, activeRunId, onViewResults, onRerun,
}: Props) {
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 overflow-hidden">
      <header className="flex items-center gap-2 px-5 py-3.5 border-b border-white/[0.04]">
        <History size={13} className="text-[#6a6a6e]" />
        <h2 className="text-[13.5px] font-semibold text-white">Research History</h2>
        {loading && <Loader2 size={12} className="animate-spin text-[#6a6a6e] ml-1" />}
      </header>

      {error ? (
        <div className="px-5 py-5 text-[12.5px] text-[#ff8a7a]">{error}</div>
      ) : runs.length === 0 ? (
        <div className="px-5 py-8 text-center text-[12.5px] text-[#9a9a9d]">
          No research runs yet. Run a search above to start building history.
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-white/[0.04]">
          {runs.map((r) => {
            const tone = STATUS_TONE[r.status] ?? '#6a6a6e'
            const isActive = activeRunId === r.id
            const isLoading = loadingRunId === r.id
            return (
              <div key={r.id}
                className={`px-5 py-3.5 transition-colors ${isActive ? 'bg-[#ff7a18]/[0.04]' : 'hover:bg-white/[0.015]'}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-white font-medium truncate">{r.title ?? '(untitled run)'}</p>
                    <p className="text-[11px] text-[#6a6a6e] mt-0.5">{new Date(r.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="inline-flex items-center text-[10px] font-semibold px-2 py-[2px] rounded-full border whitespace-nowrap capitalize"
                      style={{ color: tone, borderColor: `${tone}33`, background: `${tone}12` }}>
                      {r.status}
                    </span>
                    <button type="button" onClick={() => onViewResults(r.id)} disabled={isLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-medium
                                 bg-white/[0.04] border border-white/[0.1] text-[#cfd3dc]
                                 hover:bg-[#ff7a18]/[0.14] hover:border-[#ff7a18]/40 hover:text-[#ffae3c] transition-all
                                 disabled:opacity-50 disabled:cursor-not-allowed">
                      {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />} View Results
                    </button>
                    <button type="button" onClick={() => onRerun(r)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-medium
                                 bg-white/[0.04] border border-white/[0.1] text-[#cfd3dc]
                                 hover:bg-white/[0.08] hover:text-white transition-all">
                      <RotateCcw size={12} /> Re-run
                    </button>
                  </div>
                </div>

                {/* Run facts */}
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-2.5">
                  <Meta label="Location"     value={r.location ?? '—'} />
                  <Meta label="Niches"       value={r.niches.length > 0 ? r.niches.join(', ') : '—'} />
                  <Meta label="Lead Target"  value={r.lead_target !== null ? String(r.lead_target) : '—'} />
                  <Meta label="Radius"       value={r.radius_km !== null ? `${r.radius_km} km` : '—'} />
                  <Meta label="Leads Found"  value={r.leads_found !== null ? String(r.leads_found) : '—'} />
                  <Meta label="Leads Saved"  value={String(r.lead_count)} />
                  <Meta label="Run By"       value={r.created_by_name ?? r.created_by_email ?? 'Unknown'} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
