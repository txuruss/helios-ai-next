'use client'

import { useState, useTransition, useMemo } from 'react'
import { updateOpsEventStatus, bulkUpdateOpsEvents, bulkAssignOpsItems, assignOpsItem } from '@/lib/actions/ops'
import type { OpsEvent, BusinessMember } from '@/lib/actions/ops'
import { capture } from '@/lib/analytics/posthog'
import SearchPaginationBar from './SearchPaginationBar'

const PAGE_SIZE = 25

interface Props {
  events:     OpsEvent[]
  members:    BusinessMember[]
  businessId: string | null
  onRefresh:  () => void
}

const SEVERITY_DOT: Record<string, string> = {
  info: 'bg-[#22d093]', warning: 'bg-[#ffae3c]', error: 'bg-[#ff8a7a]', critical: 'bg-[#ff4444] animate-pulse',
}
const SOURCE_ICON: Record<string, string> = {
  chat: '💬', whatsapp: '✆', calcom: '📅', stripe: '💳', relevance: '🤖', system: '⚙', widget: '🌐',
}

function relTime(ts: string) {
  const d = Date.now() - new Date(ts).getTime()
  const m = Math.floor(d / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
}

export default function OpsEventFeed({ events, members, onRefresh }: Props) {
  const [filter,       setFilter]       = useState('all')
  const [search,       setSearch]       = useState('')
  const [page,         setPage]         = useState(1)
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set())
  const [bulkAssignTo, setBulkAssignTo] = useState('')
  const [pending,      startTransition] = useTransition()
  const [bulkPending,  startBulk]       = useTransition()

  const filtered = useMemo(() => {
    let list = filter === 'all' ? events : events.filter((e) => e.severity === filter || e.status === filter)
    if (search) list = list.filter((e) => e.title.toLowerCase().includes(search.toLowerCase()) || (e.description ?? '').toLowerCase().includes(search.toLowerCase()))
    return list
  }, [events, filter, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  const handleBulkResolve = () => {
    if (!selectedIds.size) return
    startBulk(async () => {
      await bulkUpdateOpsEvents(Array.from(selectedIds), 'resolve')
      capture('ops_event_bulk_resolved', { count: selectedIds.size })
      setSelectedIds(new Set()); onRefresh()
    })
  }
  const handleBulkIgnore = () => {
    if (!selectedIds.size) return
    startBulk(async () => {
      await bulkUpdateOpsEvents(Array.from(selectedIds), 'ignore')
      capture('ops_event_bulk_ignored', { count: selectedIds.size })
      setSelectedIds(new Set()); onRefresh()
    })
  }
  const handleBulkAssign = () => {
    if (!selectedIds.size) return
    startBulk(async () => {
      await bulkAssignOpsItems('ops_events', Array.from(selectedIds), bulkAssignTo || null)
      capture('ops_bulk_assigned', { count: selectedIds.size, table: 'ops_events' })
      setSelectedIds(new Set()); onRefresh()
    })
  }

  const handleResolve = (id: string) => {
    startTransition(async () => {
      await updateOpsEventStatus(id, 'resolved')
      capture('ops_event_resolved', {}); onRefresh()
    })
  }
  const handleAssign = (id: string, userId: string) => {
    startTransition(async () => {
      await assignOpsItem('ops_events', id, userId || null)
      capture('ops_item_assigned', { table: 'ops_events' }); onRefresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        {['all','info','warning','error','critical','open','resolved'].map((f) => (
          <button key={f} onClick={() => { setFilter(f); setPage(1) }}
            className={`px-3 py-1 rounded-lg text-[11.5px] font-medium transition-all capitalize
                        ${filter === f ? 'bg-white/[0.10] text-white' : 'text-[#6a6a6e] hover:text-[#9a9a9d]'}`}>
            {f}
          </button>
        ))}
      </div>

      <SearchPaginationBar search={search} onSearch={(s) => { setSearch(s); setPage(1) }} page={page} totalPages={totalPages} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} placeholder="Search events…" />

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

      {paginated.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center rounded-2xl border border-white/[0.07] bg-[#0f1012]">
          <span className="text-[24px]">📊</span>
          <p className="text-[13px] font-medium text-white">{search ? 'No results' : 'No activity yet'}</p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-white/[0.04] rounded-2xl border border-white/[0.07] bg-[#0f1012] overflow-hidden">
          {paginated.map((ev) => (
            <div key={ev.id} className={`flex items-start gap-3 px-5 py-3.5 ${selectedIds.has(ev.id) ? 'bg-white/[0.04]' : ''}`}>
              <input type="checkbox" checked={selectedIds.has(ev.id)} onChange={() => toggleSelect(ev.id)} className="mt-1.5 w-3.5 h-3.5 accent-[#ff7a18] cursor-pointer shrink-0" />
              <span className={`mt-2 w-2 h-2 rounded-full shrink-0 ${SEVERITY_DOT[ev.severity] ?? 'bg-[#9a9a9d]'}`} />
              <span className="w-7 text-[14px] text-center shrink-0">{SOURCE_ICON[ev.source] ?? '•'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-white">{ev.title}</p>
                {ev.description && <p className="text-[11.5px] text-[#9a9a9d] mt-0.5 truncate">{ev.description}</p>}
                <p className="text-[10.5px] text-[#6a6a6e] mt-0.5 capitalize">{ev.source} · {ev.event_type} · {ev.severity}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10.5px] text-[#6a6a6e] font-mono">{relTime(ev.created_at)}</span>
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
          ))}
        </div>
      )}
    </div>
  )
}
