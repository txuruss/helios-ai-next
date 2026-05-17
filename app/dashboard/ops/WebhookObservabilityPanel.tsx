'use client'

import { useState, useTransition, useEffect } from 'react'
import { getWebhookDeliveryLogsAction } from '@/lib/actions/ops'
import type { WebhookDeliveryLog } from '@/lib/actions/ops'
import { capture } from '@/lib/analytics/posthog'

const PROVIDER_ICON: Record<string, string> = {
  stripe:    '💳', calcom:   '📅', whatsapp:  '✆',
  relevance: '⚡', ops:      '⚙', unknown:   '?',
}

const VERIFICATION_CONFIG: Record<string, { text: string; bg: string }> = {
  verified:    { text: 'text-[#22d093]', bg: 'bg-[#22d093]/10' },
  failed:      { text: 'text-[#ff8a7a]', bg: 'bg-[#ff8a7a]/10' },
  skipped:     { text: 'text-[#6a6a6e]', bg: 'bg-white/[0.05]' },
  unavailable: { text: 'text-[#6a6a6e]', bg: 'bg-white/[0.05]' },
}

const PROCESSING_CONFIG: Record<string, { text: string }> = {
  processed:  { text: 'text-[#22d093]' },
  received:   { text: 'text-[#9a9a9d]' },
  processing: { text: 'text-[#3b9eff]' },
  failed:     { text: 'text-[#ff8a7a]' },
  ignored:    { text: 'text-[#6a6a6e]' },
  duplicate:  { text: 'text-[#6a6a6e]' },
}

function relTime(ts: string): string {
  const d = Date.now() - new Date(ts).getTime()
  const m = Math.floor(d / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
}

function fmtDuration(ms: number | null): string {
  if (!ms) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

const PAGE_SIZE = 20

export default function WebhookObservabilityPanel() {
  const [logs,    setLogs]    = useState<WebhookDeliveryLog[]>([])
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [search,  setSearch]  = useState('')
  const [provider, setProvider] = useState('')
  const [verif,   setVerif]   = useState('')
  const [procStatus, setProcStatus] = useState('')
  const [error,   setError]   = useState<string | null>(null)
  const [pending, startLoad]  = useTransition()

  const load = (pg = page, q = search, prov = provider, v = verif, ps = procStatus) => {
    startLoad(async () => {
      const result = await getWebhookDeliveryLogsAction({
        page:                pg,
        pageSize:            PAGE_SIZE,
        search:              q || undefined,
        provider:            prov || undefined,
        verification_status: v || undefined,
        processing_status:   ps || undefined,
      })
      if (result.error) { setError(result.error); return }
      setLogs(result.rows)
      setTotal(result.total_count)
      setError(null)
    })
  }

  useEffect(() => {
    capture('webhook_observability_viewed', {})
    load(1, '', '', '', '')
  }, [])

  const handleSearch   = (q: string)  => { setSearch(q);    setPage(1); load(1, q, provider, verif, procStatus) }
  const handleProvider = (p: string)  => { setProvider(p);  setPage(1); load(1, search, p, verif, procStatus) }
  const handleVerif    = (v: string)  => { setVerif(v);     setPage(1); load(1, search, provider, v, procStatus) }
  const handleProc     = (ps: string) => { setProcStatus(ps); setPage(1); load(1, search, provider, verif, ps) }
  const handlePage     = (p: number)  => { setPage(p); load(p, search, provider, verif, procStatus) }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="flex flex-col gap-3 border-t border-white/[0.06] pt-4 mt-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-[12px] font-semibold text-[#6a6a6e] uppercase tracking-[0.12em]">
          Webhook Observability
          {total > 0 && <span className="ml-2 text-[#9a9a9d] normal-case tracking-normal font-normal">({total} received)</span>}
        </p>
        <button onClick={() => load(page, search, provider, verif, procStatus)} disabled={pending}
          className="h-7 px-3 rounded-lg text-[11.5px] border border-white/[0.10] text-[#9a9a9d] hover:bg-white/[0.06] transition-all disabled:opacity-40">
          {pending ? '…' : '↻'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <input value={search} onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search provider, event, summary…"
          className="flex-1 min-w-[140px] h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 text-[12.5px] text-white placeholder-[#6a6a6e] outline-none focus:border-[#ff7a18]/40 transition-colors" />
        <select value={provider} onChange={(e) => handleProvider(e.target.value)}
          className="h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] px-2 text-[12.5px] text-[#9a9a9d] outline-none">
          <option value="">All providers</option>
          <option value="stripe">Stripe</option>
          <option value="calcom">Cal.com</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="relevance">Relevance</option>
        </select>
        <select value={verif} onChange={(e) => handleVerif(e.target.value)}
          className="h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] px-2 text-[12.5px] text-[#9a9a9d] outline-none">
          <option value="">All verification</option>
          <option value="verified">Verified</option>
          <option value="failed">Failed</option>
          <option value="skipped">Skipped</option>
        </select>
        <select value={procStatus} onChange={(e) => handleProc(e.target.value)}
          className="h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] px-2 text-[12.5px] text-[#9a9a9d] outline-none">
          <option value="">All statuses</option>
          <option value="processed">Processed</option>
          <option value="failed">Failed</option>
          <option value="ignored">Ignored</option>
          <option value="received">Received</option>
        </select>
      </div>

      {error && <p className="text-[12px] text-[#ff8a7a]">{error}</p>}

      {logs.length === 0 && !pending ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center rounded-2xl border border-white/[0.07] bg-[#0f1012]">
          <span className="text-[20px]">🔗</span>
          <p className="text-[12.5px] text-white font-medium">No webhook logs yet</p>
          <p className="text-[11.5px] text-[#6a6a6e]">
            Logs appear after webhooks are received from Stripe, Cal.com, WhatsApp, or Relevance.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.07] bg-[#0f1012] overflow-hidden">
          <div className="divide-y divide-white/[0.04]">
            {logs.map((log) => {
              const verifCfg = VERIFICATION_CONFIG[log.verification_status ?? ''] ?? VERIFICATION_CONFIG.skipped
              const procCfg  = PROCESSING_CONFIG[log.processing_status] ?? PROCESSING_CONFIG.received
              return (
                <div key={log.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-[16px] shrink-0">{PROVIDER_ICON[log.provider] ?? '?'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[12px] text-white capitalize">{log.provider}</p>
                      {log.event_type && (
                        <span className="text-[10px] text-[#6a6a6e] font-mono">{log.event_type}</span>
                      )}
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize ${verifCfg.bg} ${verifCfg.text}`}>
                        {log.verification_status ?? 'unknown'}
                      </span>
                      <span className={`text-[10px] capitalize ${procCfg.text}`}>
                        {log.processing_status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[10.5px] text-[#6a6a6e] flex-wrap">
                      <span>{fmtDuration(log.duration_ms)}</span>
                      {log.status_code && <span>HTTP {log.status_code}</span>}
                      {log.safe_summary && <span className="truncate max-w-[200px]">{log.safe_summary}</span>}
                    </div>
                    {log.error_summary && (
                      <p className="text-[10px] text-[#ff8a7a] mt-0.5 truncate">{log.error_summary}</p>
                    )}
                  </div>
                  <span className="text-[10.5px] text-[#6a6a6e] font-mono shrink-0">{relTime(log.received_at)}</span>
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
