'use client'

import { useState, useTransition, useEffect } from 'react'
import { getNotificationDeliveryLogsAction, retryNotificationDeliveryAction } from '@/lib/actions/ops'
import type { NotificationDeliveryLog } from '@/lib/actions/ops'
import { capture } from '@/lib/analytics/posthog'

const STATUS_CONFIG: Record<string, { text: string; bg: string }> = {
  sent:      { text: 'text-[#22d093]', bg: 'bg-[#22d093]/10' },
  failed:    { text: 'text-[#ff8a7a]', bg: 'bg-[#ff8a7a]/10' },
  retrying:  { text: 'text-[#ffae3c]', bg: 'bg-[#ffae3c]/10' },
  scheduled: { text: 'text-[#3b9eff]', bg: 'bg-[#3b9eff]/10' },
  pending:   { text: 'text-[#9a9a9d]', bg: 'bg-white/[0.06]' },
  cancelled: { text: 'text-[#6a6a6e]', bg: 'bg-white/[0.04]' },
  skipped:   { text: 'text-[#6a6a6e]', bg: 'bg-white/[0.04]' },
}

function relTime(ts: string | null): string {
  if (!ts) return '—'
  const d = Date.now() - new Date(ts).getTime()
  const m = Math.floor(d / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
}

function relFuture(ts: string | null): string {
  if (!ts) return '—'
  const diff = new Date(ts).getTime() - Date.now()
  if (diff <= 0) return 'now'
  const m = Math.floor(diff / 60000)
  if (m < 60) return `in ${m}m`
  return `in ${Math.floor(m / 60)}h`
}

const PAGE_SIZE = 15

export default function NotificationDeliveryLogsPanel() {
  const [logs,    setLogs]    = useState<NotificationDeliveryLog[]>([])
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [search,  setSearch]  = useState('')
  const [status,  setStatus]  = useState('')
  const [error,   setError]   = useState<string | null>(null)
  const [retryMsg, setRetryMsg] = useState<Record<string, string>>({})
  const [pending, startLoad]  = useTransition()
  const [retrying, startRetry] = useTransition()

  const load = (pg = page, q = search, st = status) => {
    startLoad(async () => {
      const result = await getNotificationDeliveryLogsAction({
        page:            pg,
        pageSize:        PAGE_SIZE,
        search:          q || undefined,
        delivery_status: st || undefined,
      })
      if (result.error) { setError(result.error); return }
      setLogs(result.rows)
      setTotal(result.total_count)
      setError(null)
    })
  }

  useEffect(() => {
    capture('notification_delivery_logged', {})
    load(1, '', '')
  }, [])

  const handleSearch = (q: string) => { setSearch(q); setPage(1); load(1, q, status) }
  const handleStatus = (st: string) => { setStatus(st); setPage(1); load(1, search, st) }
  const handlePage   = (p: number)  => { setPage(p); load(p, search, status) }

  const handleRetry = (logId: string) => {
    setRetryMsg((prev) => ({ ...prev, [logId]: '' }))
    startRetry(async () => {
      const result = await retryNotificationDeliveryAction(logId)
      if (result.error) {
        setRetryMsg((prev) => ({ ...prev, [logId]: `Error: ${result.error}` }))
        capture('notification_delivery_retry_failed', {})
        return
      }
      setRetryMsg((prev) => ({ ...prev, [logId]: '✓ Queued for retry' }))
      capture('notification_delivery_retry_clicked', {})
      setTimeout(() => load(page, search, status), 1000)
    })
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="flex flex-col gap-3 border-t border-white/[0.06] pt-4 mt-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-[12px] font-semibold text-[#6a6a6e] uppercase tracking-[0.12em]">
          Notification Delivery Logs
          {total > 0 && <span className="ml-2 text-[#9a9a9d] normal-case tracking-normal font-normal">({total})</span>}
        </p>
        <button onClick={() => load(page, search, status)} disabled={pending}
          className="h-7 px-3 rounded-lg text-[11.5px] border border-white/[0.10] text-[#9a9a9d] hover:bg-white/[0.06] transition-all disabled:opacity-40">
          {pending ? '…' : '↻'}
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <input
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by status, provider…"
          className="flex-1 min-w-[160px] h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 text-[12.5px] text-white placeholder-[#6a6a6e] outline-none focus:border-[#ff7a18]/40 transition-colors"
        />
        <select value={status} onChange={(e) => handleStatus(e.target.value)}
          className="h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] px-2 text-[12.5px] text-[#9a9a9d] outline-none">
          <option value="">All statuses</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
          <option value="retrying">Retrying</option>
          <option value="scheduled">Scheduled</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      {error && <p className="text-[12px] text-[#ff8a7a]">{error}</p>}

      {logs.length === 0 && !pending ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center rounded-2xl border border-white/[0.07] bg-[#0f1012]">
          <span className="text-[20px]">📬</span>
          <p className="text-[12.5px] text-white font-medium">No delivery logs yet</p>
          <p className="text-[11.5px] text-[#6a6a6e]">Logs appear after notification rules trigger or Test Email is clicked.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.07] bg-[#0f1012] overflow-hidden">
          <div className="divide-y divide-white/[0.04]">
            {logs.map((log) => {
              const cfg = STATUS_CONFIG[log.delivery_status] ?? STATUS_CONFIG.pending
              return (
                <div key={log.id} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize shrink-0 ${cfg.bg} ${cfg.text}`}>
                      {log.delivery_status}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[12px] text-white">{log.delivery_channel}</p>
                        <span className="text-[10px] text-[#6a6a6e]">{log.provider}</span>
                        {log.recipient_masked && (
                          <span className="text-[10.5px] text-[#9a9a9d] font-mono">{log.recipient_masked}</span>
                        )}
                        {log.recipient_type && (
                          <span className="text-[10px] text-[#6a6a6e] capitalize">{log.recipient_type.replace(/_/g,' ')}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-[10.5px] text-[#6a6a6e] flex-wrap">
                        {log.attempt_count > 0 && <span>{log.attempt_count} attempt{log.attempt_count !== 1 ? 's' : ''}</span>}
                        {log.sent_at         && <span className="text-[#22d093]">sent {relTime(log.sent_at)}</span>}
                        {log.failed_at       && <span className="text-[#ff8a7a]">failed {relTime(log.failed_at)}</span>}
                        {log.next_retry_at   && log.delivery_status === 'retrying' && (
                          <span className="text-[#ffae3c]">retry {relFuture(log.next_retry_at)}</span>
                        )}
                        {log.scheduled_for && log.delivery_status === 'scheduled' && (
                          <span className="text-[#3b9eff]">scheduled {relFuture(log.scheduled_for)}</span>
                        )}
                      </div>
                      {log.error_summary && (
                        <p className="text-[10px] text-[#ff8a7a] mt-0.5 truncate">{log.error_summary}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[10.5px] text-[#6a6a6e]">{relTime(log.created_at)}</span>
                      {['failed', 'retrying'].includes(log.delivery_status) && (
                        <button onClick={() => handleRetry(log.id)} disabled={retrying}
                          className="h-6 px-2 rounded text-[10px] border border-[#ffae3c]/30 text-[#ffae3c] hover:bg-[#ffae3c]/10 transition-all disabled:opacity-40">
                          Retry
                        </button>
                      )}
                    </div>
                  </div>
                  {retryMsg[log.id] && (
                    <p className={`text-[10.5px] mt-1 ml-14 ${retryMsg[log.id].startsWith('✓') ? 'text-[#22d093]' : 'text-[#ff8a7a]'}`}>
                      {retryMsg[log.id]}
                    </p>
                  )}
                </div>
              )
            })}
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
