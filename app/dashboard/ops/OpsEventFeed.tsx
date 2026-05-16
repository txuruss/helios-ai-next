'use client'

import { useState, useTransition, useEffect, useCallback } from 'react'
import {
  updateOpsEventStatus, bulkUpdateOpsEvents, bulkAssignOpsItems,
  assignOpsItem, snoozeOpsItem, unsnoozeOpsItem, retryOpsEventAutomation, getOpsEvents,
} from '@/lib/actions/ops'
import type { OpsEvent, BusinessMember, PaginatedOpsResult } from '@/lib/actions/ops'
import { capture } from '@/lib/analytics/posthog'
import SearchPaginationBar from './SearchPaginationBar'
import SlaCountdown         from './SlaCountdown'
import SnoozeControl        from './SnoozeControl'

const PAGE_SIZE = 25

interface Props {
  initialData:  PaginatedOpsResult<OpsEvent>
  members:      BusinessMember[]
  businessId:   string | null
  onRefresh:    () => void
}

const SEVERITY_DOT: Record<string, string> = {
  info:'bg-[#22d093]', warning:'bg-[#ffae3c]', error:'bg-[#ff8a7a]', critical:'bg-[#ff4444] animate-pulse',
}
const SOURCE_ICON: Record<string, string> = {
  chat:'💬', whatsapp:'✆', calcom:'📅', stripe:'💳', relevance:'🤖', system:'⚙', widget:'🌐',
}

const AUTO_STATUS_COLOR: Record<string, string> = {
  retrying: 'text-[#ffae3c]', failed: 'text-[#ff8a7a]', completed: 'text-[#22d093]',
}

function relTime(ts: string) {
  const d = Date.now() - new Date(ts).getTime()
  const m = Math.floor(d / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
}

export default function OpsEventFeed({ initialData, members, onRefresh }: Props) {
  const [events,       setEvents]       = useState(initialData.rows)
  const [totalCount,   setTotalCount]   = useState(initialData.total_count)
  const [filter,       setFilter]       = useState('all')
  const [search,       setSearch]       = useState('')
  const [page,         setPage]         = useState(1)
  const [includeSnoozed, setIncludeSnoozed] = useState(false)
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set())
  const [bulkAssignTo, setBulkAssignTo] = useState('')

  const [searchPending, startSearch]  = useTransition()
  const [pending,       startAction]  = useTransition()
  const [bulkPending,   startBulk]    = useTransition()

  // Sync when parent refreshes initial data
  useEffect(() => {
    setEvents(initialData.rows)
    setTotalCount(initialData.total_count)
    setPage(1)
  }, [initialData])

  const loadPage = useCallback((p: number, s: string, f: string, incSnoozed: boolean) => {
    startSearch(async () => {
      const result = await getOpsEvents({
        search:          s || undefined,
        status:          ['open','resolved','acknowledged'].includes(f) ? f : undefined,
        severity:        ['info','warning','error','critical'].includes(f) ? f : undefined,
        page:            p,
        pageSize:        PAGE_SIZE,
        include_snoozed: incSnoozed,
      })
      setEvents(result.rows)
      setTotalCount(result.total_count)
      capture('ops_server_search_used', { has_search: !!s, page: p })
    })
  }, [])

  const handleSearch = (s: string) => {
    setSearch(s); setPage(1)
    loadPage(1, s, filter, includeSnoozed)
  }

  const handlePage = (p: number) => {
    setPage(p)
    loadPage(p, search, filter, includeSnoozed)
    capture('ops_server_page_changed', { page: p })
  }

  const handleFilter = (f: string) => {
    setFilter(f); setPage(1)
    loadPage(1, search, f, includeSnoozed)
  }

  const toggleSnoozed = () => {
    const next = !includeSnoozed
    setIncludeSnoozed(next); setPage(1)
    loadPage(1, search, filter, next)
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  const handleBulkResolve = () => {
    if (!selectedIds.size) return
    startBulk(async () => {
      await bulkUpdateOpsEvents(Array.from(selectedIds), 'resolve')
      capture('ops_event_bulk_resolved', { count: selectedIds.size })
      setSelectedIds(new Set()); loadPage(page, search, filter, includeSnoozed)
    })
  }
  const handleBulkIgnore = () => {
    if (!selectedIds.size) return
    startBulk(async () => {
      await bulkUpdateOpsEvents(Array.from(selectedIds), 'ignore')
      capture('ops_event_bulk_ignored', { count: selectedIds.size })
      setSelectedIds(new Set()); loadPage(page, search, filter, includeSnoozed)
    })
  }
  const handleBulkAssign = () => {
    if (!selectedIds.size) return
    startBulk(async () => {
      await bulkAssignOpsItems('ops_events', Array.from(selectedIds), bulkAssignTo || null)
      capture('ops_bulk_assigned', { count: selectedIds.size })
      setSelectedIds(new Set()); loadPage(page, search, filter, includeSnoozed)
    })
  }

  const handleResolve = (id: string) => {
    startAction(async () => {
      await updateOpsEventStatus(id, 'resolved')
      capture('ops_event_resolved', {})
      loadPage(page, search, filter, includeSnoozed)
    })
  }

  const handleRetry = (id: string) => {
    startAction(async () => {
      await retryOpsEventAutomation(id)
      capture('ops_automation_retry_clicked', {})
      loadPage(page, search, filter, includeSnoozed)
    })
  }

  const handleAssign = (id: string, userId: string) => {
    startAction(async () => {
      await assignOpsItem('ops_events', id, userId || null)
      loadPage(page, search, filter, includeSnoozed)
    })
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        {['all','info','warning','error','critical','open','resolved'].map((f) => (
          <button key={f} onClick={() => handleFilter(f)}
            className={`px-3 py-1 rounded-lg text-[11.5px] font-medium transition-all capitalize
                        ${filter === f ? 'bg-white/[0.10] text-white' : 'text-[#6a6a6e] hover:text-[#9a9a9d]'}`}>
            {f}
          </button>
        ))}
        <button onClick={toggleSnoozed}
          className={`px-3 py-1 rounded-lg text-[11.5px] transition-all ${includeSnoozed ? 'bg-[#ffae3c]/10 text-[#ffae3c]' : 'text-[#6a6a6e] hover:text-[#9a9a9d]'}`}>
          💤 {includeSnoozed ? 'Hide snoozed' : 'Show snoozed'}
        </button>
      </div>

      <SearchPaginationBar
        search={search} onSearch={handleSearch}
        page={page} totalPages={totalPages} total={totalCount} pageSize={PAGE_SIZE} onPage={handlePage}
        placeholder="Search events…" loading={searchPending}
      />

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] flex-wrap">
          <span className="text-[12px] text-[#9a9a9d]">{selectedIds.size} selected</span>
          <button onClick={handleBulkResolve} disabled={bulkPending} className="h-7 px-3 rounded-lg text-[11.5px] border border-[#22d093]/30 text-[#22d093] hover:bg-[#22d093]/10 transition-all disabled:opacity-40">Resolve</button>
          <button onClick={handleBulkIgnore} disabled={bulkPending} className="h-7 px-3 rounded-lg text-[11.5px] border border-white/[0.10] text-[#9a9a9d] hover:bg-white/[0.08] transition-all disabled:opacity-40">Ignore</button>
          {members.length > 0 && (
            <>
              <select value={bulkAssignTo} onChange={(e) => setBulkAssignTo(e.target.value)}
                className="h-7 px-2 rounded-lg border border-white/[0.10] bg-[#0a0b0d] text-[11.5px] text-[#9a9a9d]">
                <option value="">Unassign</option>
                {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.full_name ?? m.email}</option>)}
              </select>
              <button onClick={handleBulkAssign} disabled={bulkPending} className="h-7 px-3 rounded-lg text-[11.5px] border border-[#3b9eff]/30 text-[#3b9eff] hover:bg-[#3b9eff]/10 transition-all disabled:opacity-40">Assign</button>
            </>
          )}
          <button onClick={() => setSelectedIds(new Set())} className="h-7 px-3 rounded-lg text-[11.5px] text-[#6a6a6e] hover:text-[#9a9a9d] transition-all">Clear</button>
        </div>
      )}

      {events.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center rounded-2xl border border-white/[0.07] bg-[#0f1012]">
          <span className="text-[24px]">📊</span>
          <p className="text-[13px] font-medium text-white">{search ? 'No results' : 'No activity yet'}</p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-white/[0.04] rounded-2xl border border-white/[0.07] bg-[#0f1012] overflow-hidden">
          {events.map((ev) => {
            const autoStatus = (ev as { automation_status?: string | null }).automation_status
            const isSnoozed  = !!(ev as { snoozed_until?: string | null }).snoozed_until
            const snoozedUntil = (ev as { snoozed_until?: string | null }).snoozed_until ?? null
            return (
              <div key={ev.id} className={`flex items-start gap-3 px-5 py-3.5 ${selectedIds.has(ev.id) ? 'bg-white/[0.04]' : ''} ${isSnoozed ? 'opacity-60' : ''}`}>
                <input type="checkbox" checked={selectedIds.has(ev.id)} onChange={() => toggleSelect(ev.id)} className="mt-1.5 w-3.5 h-3.5 accent-[#ff7a18] cursor-pointer shrink-0" />
                <span className={`mt-2 w-2 h-2 rounded-full shrink-0 ${SEVERITY_DOT[ev.severity] ?? 'bg-[#9a9a9d]'}`} />
                <span className="w-7 text-[14px] text-center shrink-0">{SOURCE_ICON[ev.source] ?? '•'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[13px] font-medium text-white">{ev.title}</p>
                    <SlaCountdown slaDueAt={ev.sla_due_at ?? null} status={ev.status} escalationLevel={ev.escalation_level ?? 0} compact />
                    {autoStatus && autoStatus in AUTO_STATUS_COLOR && (
                      <span className={`text-[9.5px] font-semibold capitalize ${AUTO_STATUS_COLOR[autoStatus]}`}>auto:{autoStatus}</span>
                    )}
                  </div>
                  {ev.description && <p className="text-[11.5px] text-[#9a9a9d] mt-0.5 truncate">{ev.description}</p>}
                  <p className="text-[10.5px] text-[#6a6a6e] mt-0.5 capitalize">{ev.source} · {ev.event_type} · {relTime(ev.created_at)}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                  <SnoozeControl table="ops_events" id={ev.id} isSnoozed={isSnoozed} snoozedUntil={snoozedUntil} onUpdated={() => loadPage(page, search, filter, includeSnoozed)} />
                  {autoStatus === 'failed' && (
                    <button onClick={() => handleRetry(ev.id)} disabled={pending}
                      className="text-[10.5px] px-2 py-0.5 rounded-lg border border-[#ffae3c]/30 text-[#ffae3c] hover:bg-[#ffae3c]/10 transition-all disabled:opacity-40">
                      Retry
                    </button>
                  )}
                  {members.length > 0 && ev.status === 'open' && (
                    <select defaultValue={(ev as { assigned_to?: string | null }).assigned_to ?? ''} onChange={(e) => handleAssign(ev.id, e.target.value)}
                      className="h-7 px-1.5 rounded-lg border border-white/[0.10] bg-[#0a0b0d] text-[10.5px] text-[#9a9a9d] cursor-pointer">
                      <option value="">Assign</option>
                      {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.full_name ?? m.email}</option>)}
                    </select>
                  )}
                  {ev.status === 'open' && (
                    <button onClick={() => handleResolve(ev.id)} disabled={pending}
                      className="text-[10.5px] px-2 py-0.5 rounded-lg border border-[#22d093]/30 text-[#22d093] hover:bg-[#22d093]/10 transition-all disabled:opacity-40">
                      Resolve
                    </button>
                  )}
                  {ev.status === 'resolved' && <span className="text-[10px] text-[#22d093]">✓</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
