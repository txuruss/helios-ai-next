'use client'

import { useState, useTransition, useEffect } from 'react'
import { getOpsCronRuns } from '@/lib/actions/ops'
import type { OpsCronRun } from '@/lib/actions/ops'
import { capture } from '@/lib/analytics/posthog'

const STATUS_CONFIG: Record<string, { text: string; bg: string }> = {
  completed: { text: 'text-[#22d093]', bg: 'bg-[#22d093]/10' },
  failed:    { text: 'text-[#ff8a7a]', bg: 'bg-[#ff8a7a]/10' },
  started:   { text: 'text-[#3b9eff]', bg: 'bg-[#3b9eff]/10' },
  skipped:   { text: 'text-[#6a6a6e]', bg: 'bg-white/[0.06]' },
}

function fmtDuration(ms: number | null): string {
  if (!ms) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function relTime(ts: string): string {
  const d = Date.now() - new Date(ts).getTime()
  const m = Math.floor(d / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
}

const PAGE_SIZE = 15

export default function OpsCronHistoryPanel() {
  const [runs,    setRuns]    = useState<OpsCronRun[]>([])
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [search,  setSearch]  = useState('')
  const [status,  setStatus]  = useState('')
  const [error,   setError]   = useState<string | null>(null)
  const [pending, startLoad]  = useTransition()

  const load = (pg = page, q = search, st = status) => {
    startLoad(async () => {
      const result = await getOpsCronRuns({
        page:     pg,
        pageSize: PAGE_SIZE,
        search:   q || undefined,
        status:   st || undefined,
      })
      if (result.error) { setError(result.error); return }
      setRuns(result.rows)
      setTotal(result.total_count)
      setError(null)
    })
  }

  useEffect(() => {
    capture('ops_cron_history_viewed', {})
    load(1, '', '')
  }, [])

  const handleSearch = (q: string) => {
    setSearch(q); setPage(1); load(1, q, status)
  }

  const handleStatus = (st: string) => {
    setStatus(st); setPage(1); load(1, search, st)
  }

  const handlePage = (p: number) => {
    setPage(p); load(p, search, status)
    capture('ops_cron_history_page_changed', { page: p, pageSize: PAGE_SIZE })
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="flex flex-col gap-3 border-t border-white/[0.06] pt-4 mt-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-[12px] font-semibold text-[#6a6a6e] uppercase tracking-[0.12em]">
          SLA Cron History
          {total > 0 && <span className="ml-2 text-[#9a9a9d] normal-case tracking-normal font-normal">({total} runs)</span>}
        </p>
        <button onClick={() => load(page, search, status)} disabled={pending}
          className="h-7 px-3 rounded-lg text-[11.5px] border border-white/[0.10] text-[#9a9a9d] hover:bg-white/[0.06] transition-all disabled:opacity-40">
          {pending ? '…' : '↻'}
        </button>
      </div>

      {/* Search + Status filter */}
      <div className="flex gap-2 flex-wrap">
        <input
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by job name, status…"
          className="flex-1 min-w-[160px] h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 text-[12.5px] text-white placeholder-[#6a6a6e] outline-none focus:border-[#ff7a18]/40 transition-colors"
        />
        <select
          value={status}
          onChange={(e) => handleStatus(e.target.value)}
          className="h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] px-2 text-[12.5px] text-[#9a9a9d] outline-none"
        >
          <option value="">All statuses</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="started">Started</option>
        </select>
      </div>

      {error && <p className="text-[12px] text-[#ff8a7a]">{error}</p>}

      {runs.length === 0 && !pending ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center rounded-2xl border border-white/[0.07] bg-[#0f1012]">
          <span className="text-[20px]">⏱</span>
          <p className="text-[12.5px] text-white font-medium">No cron runs yet</p>
          <p className="text-[11.5px] text-[#6a6a6e]">Runs appear after the cron endpoint is triggered.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.07] bg-[#0f1012] overflow-hidden">
          <div className="divide-y divide-white/[0.04]">
            {runs.map((run) => {
              const cfg = STATUS_CONFIG[run.status] ?? STATUS_CONFIG.started
              return (
                <div key={run.id} className="flex items-center gap-3 px-4 py-3">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize shrink-0 ${cfg.bg} ${cfg.text}`}>
                    {run.status}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[12px] text-white">{run.job_name}</p>
                      {run.trigger_source && (
                        <span className="text-[10px] text-[#6a6a6e] capitalize">{run.trigger_source.replace(/_/g,' ')}</span>
                      )}
                      {(run.verification_method ?? run.cron_secret_type) && (
                        <span className="text-[10px] text-[#6a6a6e]">{run.verification_method ?? run.cron_secret_type}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[10.5px] text-[#6a6a6e] flex-wrap">
                      <span>✓ {run.checked_count}</span>
                      {run.breached_count > 0  && <span className="text-[#ff8a7a]">↑ {run.breached_count} breached</span>}
                      {run.escalated_count > 0 && <span className="text-[#c084fc]">⬆ {run.escalated_count} escalated</span>}
                      {(run.failed_count ?? 0) > 0 && <span className="text-[#ff8a7a]">✗ {run.failed_count} failed</span>}
                      {run.businesses_checked > 0 && <span>{run.businesses_checked} biz</span>}
                      <span>{fmtDuration(run.duration_ms)}</span>
                    </div>
                    {run.error_message && (
                      <p className="text-[10px] text-[#ff8a7a] mt-0.5 truncate">{run.error_message}</p>
                    )}
                  </div>
                  <span className="text-[10.5px] text-[#6a6a6e] font-mono shrink-0">{relTime(run.started_at)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button onClick={() => handlePage(page - 1)} disabled={page <= 1 || pending}
            className="h-7 px-3 rounded-lg text-[11.5px] border border-white/[0.10] text-[#9a9a9d] hover:bg-white/[0.06] transition-all disabled:opacity-40">
            ← Prev
          </button>
          <span className="text-[11px] text-[#6a6a6e]">Page {page} of {totalPages}</span>
          <button onClick={() => handlePage(page + 1)} disabled={page >= totalPages || pending}
            className="h-7 px-3 rounded-lg text-[11.5px] border border-white/[0.10] text-[#9a9a9d] hover:bg-white/[0.06] transition-all disabled:opacity-40">
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
