'use client'

import { useState, useTransition, useEffect } from 'react'
import { getOpsExportHistory } from '@/lib/actions/ops'
import { capture } from '@/lib/analytics/posthog'

const FORMAT_BADGE: Record<string, string> = {
  csv:  'bg-[#22d093]/10 text-[#22d093]',
  json: 'bg-[#3b9eff]/10 text-[#3b9eff]',
}

function relTime(ts: string): string {
  const d = Date.now() - new Date(ts).getTime()
  const m = Math.floor(d / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
}

const PAGE_SIZE = 10

export default function SlaRoutingExportPanel() {
  const [rows,    setRows]    = useState<Record<string, unknown>[]>([])
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [search,  setSearch]  = useState('')
  const [error,   setError]   = useState<string | null>(null)
  const [pending, startLoad]  = useTransition()

  const load = (pg = page, q = search) => {
    startLoad(async () => {
      const result = await getOpsExportHistory({ page: pg, pageSize: PAGE_SIZE, search: q || undefined })
      if (result.error) { setError(result.error); return }
      setRows(result.rows)
      setTotal(result.total_count)
      setError(null)
    })
  }

  useEffect(() => {
    capture('sla_routing_export_history_viewed', {})
    load(1, '')
  }, [])

  const handleSearch = (q: string) => { setSearch(q); setPage(1); load(1, q) }
  const handlePage   = (p: number) => { setPage(p); load(p, search) }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const handleRerun = (row: Record<string, unknown>) => {
    capture('ops_export_rerun', { export_type: row.export_type, format: row.format })
    void fetch('/api/ops/export', {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify({ export_type: row.export_type, format: row.format, limit: 500 }),
    }).then(async (res) => {
      if (!res.ok) return
      const format = row.format as string
      if (format === 'csv') {
        const blob = await res.blob()
        const url  = URL.createObjectURL(blob)
        const a    = document.createElement('a')
        a.href     = url
        a.download = `${row.export_type as string}-${Date.now()}.csv`
        document.body.appendChild(a); a.click(); document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } else {
        const data = await res.json() as { rows?: unknown[] }
        const blob = new Blob([JSON.stringify(data.rows ?? [], null, 2)], { type: 'application/json' })
        const url  = URL.createObjectURL(blob)
        const a    = document.createElement('a')
        a.href     = url
        a.download = `${row.export_type as string}-${Date.now()}.json`
        document.body.appendChild(a); a.click(); document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
      load(page, search)
    })
  }

  return (
    <div className="flex flex-col gap-3 border-t border-white/[0.06] pt-4 mt-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-[12px] font-semibold text-[#6a6a6e] uppercase tracking-[0.12em]">
          Export History
          {total > 0 && <span className="ml-2 text-[#9a9a9d] normal-case tracking-normal font-normal">({total})</span>}
        </p>
        <button onClick={() => load(page, search)} disabled={pending}
          className="h-7 px-3 rounded-lg text-[11.5px] border border-white/[0.10] text-[#9a9a9d] hover:bg-white/[0.06] transition-all disabled:opacity-40">
          {pending ? '…' : '↻'}
        </button>
      </div>

      <input value={search} onChange={(e) => handleSearch(e.target.value)}
        placeholder="Search export type…"
        className="h-8 w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 text-[12.5px] text-white placeholder-[#6a6a6e] outline-none focus:border-[#ff7a18]/40 transition-colors" />

      {error && <p className="text-[12px] text-[#ff8a7a]">{error}</p>}

      {rows.length === 0 && !pending ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center rounded-2xl border border-white/[0.07] bg-[#0f1012]">
          <span className="text-[20px]">📋</span>
          <p className="text-[12.5px] text-white font-medium">No exports yet</p>
          <p className="text-[11.5px] text-[#6a6a6e]">Exports will appear here after you download data from the Ops tabs.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.07] bg-[#0f1012] overflow-hidden">
          <div className="divide-y divide-white/[0.04]">
            {rows.map((row) => (
              <div key={row.id as string} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[12px] text-white capitalize">{(row.export_type as string).replace(/_/g,' ')}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase ${FORMAT_BADGE[row.format as string] ?? ''}`}>
                      {row.format as string}
                    </span>
                    {typeof row.source_table === 'string' && row.source_table && (
                      <span className="text-[10px] text-[#6a6a6e]">{row.source_table}</span>
                    )}
                  </div>
                  <p className="text-[10.5px] text-[#6a6a6e] mt-0.5">
                    {(row.row_count as number | null) ?? 0} rows · {relTime(row.created_at as string)}
                  </p>
                </div>
                <button onClick={() => handleRerun(row)}
                  className="h-7 px-2.5 rounded-lg text-[11px] border border-white/[0.10] text-[#9a9a9d] hover:bg-white/[0.06] transition-all shrink-0">
                  Re-run
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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
