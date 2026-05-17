'use client'

import { useState, useTransition, useEffect } from 'react'
import { getNotificationPreviewHistory } from '@/lib/actions/ops'
import type { NotificationPreviewRow } from '@/lib/actions/ops'
import { capture } from '@/lib/analytics/posthog'

function relTime(ts: string): string {
  const d = Date.now() - new Date(ts).getTime()
  const m = Math.floor(d / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
}

function maskEmail(s: string): string {
  return s.replace(/[\w.+-]+@[\w-]+\.[a-z]{2,}/gi, (m) => {
    const [local, domain] = m.split('@')
    return `${local.slice(0, 2)}***@${domain}`
  })
}

const PAGE_SIZE = 15

export default function NotificationPreviewHistoryPanel() {
  const [rows,    setRows]    = useState<NotificationPreviewRow[]>([])
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [search,  setSearch]  = useState('')
  const [filter,  setFilter]  = useState<'all'|'rule_preview'|'dry_run'>('all')
  const [error,   setError]   = useState<string | null>(null)
  const [pending, startLoad]  = useTransition()
  const [exporting, startExport] = useTransition()
  const [exportMsg, setExportMsg] = useState<string | null>(null)

  const load = (pg = page, q = search, f = filter) => {
    startLoad(async () => {
      const result = await getNotificationPreviewHistory({
        page:         pg,
        pageSize:     PAGE_SIZE,
        search:       q || undefined,
        preview_type: f === 'all' ? undefined : f,
      })
      if (result.error) { setError(result.error); return }
      setRows(result.rows)
      setTotal(result.total_count)
      setError(null)
    })
  }

  useEffect(() => {
    capture('ops_notification_preview_history_viewed', {})
    load(1, '', 'all')
  }, [])

  const handleSearch = (q: string) => {
    setSearch(q); setPage(1); load(1, q, filter)
  }

  const handleFilter = (f: 'all'|'rule_preview'|'dry_run') => {
    setFilter(f); setPage(1); load(1, search, f)
  }

  const handlePage = (p: number) => {
    setPage(p); load(p, search, filter)
    capture('ops_notification_preview_history_viewed', { page: p, pageSize: PAGE_SIZE })
  }

  const handleExport = (format: 'csv' | 'json') => {
    setExportMsg(null)
    startExport(async () => {
      try {
        const res = await fetch('/api/ops/notification-previews/export', {
          method:      'POST',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          body:        JSON.stringify({
            format,
            preview_type: filter === 'all' ? undefined : filter,
            search:       search || undefined,
            limit:        500,
          }),
        })
        if (format === 'csv') {
          const blob = await res.blob()
          const url  = URL.createObjectURL(blob)
          const a    = document.createElement('a')
          a.href     = url
          a.download = `preview-history-${Date.now()}.csv`
          document.body.appendChild(a); a.click(); document.body.removeChild(a)
          URL.revokeObjectURL(url)
          setExportMsg('CSV exported.')
        } else {
          const data = await res.json() as { rows?: unknown[]; count?: number; error?: string }
          if (!res.ok) { setError(data.error ?? 'Export failed.'); return }
          const blob = new Blob([JSON.stringify(data.rows ?? [], null, 2)], { type: 'application/json' })
          const url  = URL.createObjectURL(blob)
          const a    = document.createElement('a')
          a.href     = url
          a.download = `preview-history-${Date.now()}.json`
          document.body.appendChild(a); a.click(); document.body.removeChild(a)
          URL.revokeObjectURL(url)
          setExportMsg(`JSON exported (${data.count ?? 0} rows).`)
        }
        capture('ops_notification_preview_exported', { export_format: format })
      } catch {
        setError('Export failed.')
      }
    })
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="flex flex-col gap-3 border-t border-white/[0.06] pt-4 mt-2">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-[12px] font-semibold text-[#6a6a6e] uppercase tracking-[0.12em]">
          Preview History
          {total > 0 && <span className="ml-2 text-[#9a9a9d] normal-case tracking-normal font-normal">({total})</span>}
        </p>
        <div className="flex items-center gap-2">
          <button onClick={() => handleExport('csv')} disabled={exporting}
            className="h-7 px-2.5 rounded-lg text-[11px] border border-white/[0.10] text-[#9a9a9d] hover:bg-white/[0.06] transition-all disabled:opacity-40">
            {exporting ? '…' : '⬇ CSV'}
          </button>
          <button onClick={() => handleExport('json')} disabled={exporting}
            className="h-7 px-2.5 rounded-lg text-[11px] border border-white/[0.10] text-[#9a9a9d] hover:bg-white/[0.06] transition-all disabled:opacity-40">
            {exporting ? '…' : '⬇ JSON'}
          </button>
          <button onClick={() => load(page, search, filter)} disabled={pending}
            className="h-7 px-3 rounded-lg text-[11.5px] border border-white/[0.10] text-[#9a9a9d] hover:bg-white/[0.06] transition-all disabled:opacity-40">
            {pending ? '…' : '↻'}
          </button>
        </div>
      </div>

      {/* Search + filter */}
      <div className="flex gap-2 flex-wrap">
        <input
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by rule name…"
          className="flex-1 min-w-[160px] h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 text-[12.5px] text-white placeholder-[#6a6a6e] outline-none focus:border-[#ff7a18]/40 transition-colors"
        />
        <select
          value={filter}
          onChange={(e) => handleFilter(e.target.value as 'all'|'rule_preview'|'dry_run')}
          className="h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] px-2 text-[12.5px] text-[#9a9a9d] outline-none"
        >
          <option value="all">All types</option>
          <option value="rule_preview">Preview only</option>
          <option value="dry_run">Dry run only</option>
        </select>
      </div>

      {error    && <p className="text-[12px] text-[#ff8a7a]">{error}</p>}
      {exportMsg && <p className="text-[12px] text-[#22d093]">{exportMsg}</p>}

      {rows.length === 0 && !pending ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center rounded-2xl border border-white/[0.07] bg-[#0f1012]">
          <span className="text-[20px]">📧</span>
          <p className="text-[12.5px] text-white font-medium">No preview history</p>
          <p className="text-[11.5px] text-[#6a6a6e]">Previews appear here after clicking Preview or Dry Run on a rule.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.07] bg-[#0f1012] overflow-hidden">
          <div className="divide-y divide-white/[0.04]">
            {rows.map((row) => (
              <div key={row.id} className="flex items-start gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                      row.preview_type === 'dry_run'
                        ? 'bg-[#3b9eff]/10 text-[#3b9eff]'
                        : 'bg-[#ff7a18]/10 text-[#ffae3c]'
                    }`}>
                      {row.preview_type === 'dry_run' ? 'Dry Run' : 'Preview'}
                    </span>
                    {row.rendered_with_template && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#22d093]/10 text-[#22d093]">template</span>
                    )}
                    {row.source_rule_name && (
                      <span className="text-[11.5px] text-white font-medium truncate max-w-[180px]">{row.source_rule_name}</span>
                    )}
                  </div>
                  {row.subject_preview && (
                    <p className="text-[11px] text-[#6a6a6e] mt-0.5 truncate">{row.subject_preview.slice(0, 80)}</p>
                  )}
                  {row.recipient_preview && (
                    <p className="text-[10.5px] text-[#6a6a6e] mt-0.5 truncate">→ {maskEmail(row.recipient_preview)}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10.5px] text-[#6a6a6e] font-mono">{relTime(row.created_at)}</p>
                  {row.exported_at && (
                    <p className="text-[10px] text-[#6a6a6e] mt-0.5">exported {row.export_format}</p>
                  )}
                </div>
              </div>
            ))}
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
