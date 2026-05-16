'use client'

import { useState, useTransition, useEffect, useCallback } from 'react'
import {
  updateApprovalItemStatus, bulkUpdateApprovals, bulkAssignOpsItems,
  assignOpsItem, getApprovalItems,
} from '@/lib/actions/ops'
import type { ApprovalItem, BusinessMember, PaginatedOpsResult } from '@/lib/actions/ops'
import { capture } from '@/lib/analytics/posthog'
import SearchPaginationBar from './SearchPaginationBar'
import SlaCountdown         from './SlaCountdown'
import SnoozeControl        from './SnoozeControl'

const PAGE_SIZE = 25

interface Props {
  initialData: PaginatedOpsResult<ApprovalItem>
  members:     BusinessMember[]
  businessId:  string | null
  onRefresh:   () => void
}

const STATUS_BADGE: Record<string, string> = {
  pending:  'bg-[#ffae3c]/10 text-[#ffae3c]',
  approved: 'bg-[#22d093]/10 text-[#22d093]',
  rejected: 'bg-[#ff8a7a]/10 text-[#ff8a7a]',
  expired:  'bg-white/[0.06] text-[#6a6a6e]',
}

function relTime(ts: string) {
  const d = Date.now() - new Date(ts).getTime()
  const m = Math.floor(d / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
}

export default function ApprovalQueue({ initialData, members, onRefresh }: Props) {
  const [items,        setItems]       = useState(initialData.rows)
  const [totalCount,   setTotalCount]  = useState(initialData.total_count)
  const [filter,       setFilter]      = useState('pending')
  const [search,       setSearch]      = useState('')
  const [page,         setPage]        = useState(1)
  const [includeSnoozed, setIncludeSnoozed] = useState(false)
  const [selectedIds,  setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkAssignTo, setBulkAssignTo]= useState('')

  const [searchPending, startSearch] = useTransition()
  const [pending,       startAction] = useTransition()
  const [bulkPending,   startBulk]  = useTransition()

  useEffect(() => {
    setItems(initialData.rows); setTotalCount(initialData.total_count); setPage(1)
  }, [initialData])

  const loadPage = useCallback((p: number, s: string, f: string, incSnoozed: boolean) => {
    startSearch(async () => {
      const result = await getApprovalItems({
        search: s || undefined,
        status: ['pending','approved','rejected','expired'].includes(f) ? f : undefined,
        page: p, pageSize: PAGE_SIZE, include_snoozed: incSnoozed,
      })
      setItems(result.rows); setTotalCount(result.total_count)
    })
  }, [])

  const handleSearch  = (s: string) => { setSearch(s); setPage(1); loadPage(1, s, filter, includeSnoozed) }
  const handlePage    = (p: number) => { setPage(p); loadPage(p, search, filter, includeSnoozed) }
  const handleFilter  = (f: string) => { setFilter(f); setPage(1); loadPage(1, search, f, includeSnoozed) }
  const toggleSnoozed = () => { const n = !includeSnoozed; setIncludeSnoozed(n); setPage(1); loadPage(1, search, filter, n) }
  const toggleSelect  = (id: string) => { setSelectedIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n }) }
  const totalPages    = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const bulk = (action: 'approve'|'reject'|'archive') => {
    if (!selectedIds.size) return
    startBulk(async () => {
      await bulkUpdateApprovals(Array.from(selectedIds), action)
      capture(`approval_bulk_${action}d`, { count: selectedIds.size })
      setSelectedIds(new Set()); loadPage(page, search, filter, includeSnoozed)
    })
  }
  const handleBulkAssign = () => {
    if (!selectedIds.size) return
    startBulk(async () => {
      await bulkAssignOpsItems('approval_items', Array.from(selectedIds), bulkAssignTo || null)
      setSelectedIds(new Set()); loadPage(page, search, filter, includeSnoozed)
    })
  }
  const decide = (id: string, status: 'approved'|'rejected') => startAction(async () => {
    await updateApprovalItemStatus(id, status)
    capture(status === 'approved' ? 'approval_item_approved' : 'approval_item_rejected', {})
    loadPage(page, search, filter, includeSnoozed)
  })
  const assign = (id: string, uid: string) => startAction(async () => {
    await assignOpsItem('approval_items', id, uid||null); loadPage(page, search, filter, includeSnoozed)
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1.5 flex-wrap">
        {['pending','approved','rejected','all'].map((f) => (
          <button key={f} onClick={() => handleFilter(f)}
            className={`px-3 py-1 rounded-lg text-[11.5px] font-medium transition-all capitalize ${filter === f ? 'bg-white/[0.10] text-white' : 'text-[#6a6a6e] hover:text-[#9a9a9d]'}`}>
            {f}
            {f === 'pending' && items.filter((i) => i.status === 'pending').length > 0 && (
              <span className="ml-1 text-[10px] px-1 rounded-full bg-[#ffae3c]/20 text-[#ffae3c]">{items.filter((i) => i.status === 'pending').length}</span>
            )}
          </button>
        ))}
        <button onClick={toggleSnoozed} className={`px-3 py-1 rounded-lg text-[11.5px] transition-all ${includeSnoozed ? 'bg-[#ffae3c]/10 text-[#ffae3c]' : 'text-[#6a6a6e] hover:text-[#9a9a9d]'}`}>
          💤 {includeSnoozed ? 'Hide snoozed' : 'Show snoozed'}
        </button>
      </div>

      <SearchPaginationBar search={search} onSearch={handleSearch} page={page} totalPages={totalPages} total={totalCount} pageSize={PAGE_SIZE} onPage={handlePage} placeholder="Search approvals…" loading={searchPending} />

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] flex-wrap">
          <span className="text-[12px] text-[#9a9a9d]">{selectedIds.size} selected</span>
          <button onClick={() => bulk('approve')} disabled={bulkPending} className="h-7 px-3 rounded-lg text-[11.5px] border border-[#22d093]/30 text-[#22d093] hover:bg-[#22d093]/10 transition-all disabled:opacity-40">Approve</button>
          <button onClick={() => bulk('reject')} disabled={bulkPending} className="h-7 px-3 rounded-lg text-[11.5px] border border-[#ff8a7a]/20 text-[#ff8a7a] hover:bg-[#ff8a7a]/10 transition-all disabled:opacity-40">Reject</button>
          <button onClick={() => bulk('archive')} disabled={bulkPending} className="h-7 px-3 rounded-lg text-[11.5px] border border-white/[0.10] text-[#9a9a9d] hover:bg-white/[0.08] transition-all disabled:opacity-40">Archive</button>
          {members.length > 0 && (
            <>
              <select value={bulkAssignTo} onChange={(e) => setBulkAssignTo(e.target.value)} className="h-7 px-2 rounded-lg border border-white/[0.10] bg-[#0a0b0d] text-[11.5px] text-[#9a9a9d]">
                <option value="">Unassign</option>
                {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.full_name ?? m.email}</option>)}
              </select>
              <button onClick={handleBulkAssign} disabled={bulkPending} className="h-7 px-3 rounded-lg text-[11.5px] border border-[#3b9eff]/30 text-[#3b9eff] hover:bg-[#3b9eff]/10 transition-all disabled:opacity-40">Assign</button>
            </>
          )}
          <button onClick={() => setSelectedIds(new Set())} className="h-7 px-3 rounded-lg text-[11.5px] text-[#6a6a6e] hover:text-[#9a9a9d] transition-all">Clear</button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center rounded-2xl border border-white/[0.07] bg-[#0f1012]">
          <span className="text-[24px]">✅</span>
          <p className="text-[13px] font-medium text-white">{search ? 'No results' : 'No approvals'}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => {
            const isSnoozed   = !!(item as { snoozed_until?: string | null }).snoozed_until
            const snoozedUntil = (item as { snoozed_until?: string | null }).snoozed_until ?? null
            return (
              <div key={item.id} className={`rounded-2xl border border-white/[0.07] bg-[#0f1012] p-4 flex flex-col gap-3 ${selectedIds.has(item.id) ? 'ring-1 ring-[#ff7a18]/30' : ''} ${isSnoozed ? 'opacity-60' : ''}`}>
                <div className="flex items-start gap-3">
                  <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} className="mt-0.5 w-3.5 h-3.5 accent-[#ff7a18] cursor-pointer shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[13px] font-semibold text-white">{item.title}</p>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_BADGE[item.status] ?? STATUS_BADGE.pending}`}>{item.status}</span>
                      <SlaCountdown slaDueAt={item.sla_due_at ?? null} status={item.status} escalationLevel={item.escalation_level ?? 0} compact />
                    </div>
                    {item.description && <p className="text-[12px] text-[#9a9a9d] mt-1">{item.description}</p>}
                    <p className="text-[10.5px] text-[#6a6a6e] mt-1 capitalize">{item.approval_type}{item.requested_by ? ` · by ${item.requested_by}` : ''} · {relTime(item.created_at)}</p>
                  </div>
                  <SnoozeControl table="approval_items" id={item.id} isSnoozed={isSnoozed} snoozedUntil={snoozedUntil} onUpdated={() => loadPage(page,search,filter,includeSnoozed)} />
                </div>
                {item.content && (
                  <pre className="text-[11px] text-[#9a9a9d] bg-white/[0.02] rounded-lg px-3 py-2 overflow-x-auto font-mono whitespace-pre-wrap max-h-[120px] overflow-y-auto">
                    {item.content.slice(0, 500)}{item.content.length > 500 ? '…' : ''}
                  </pre>
                )}
                {item.status === 'pending' && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {members.length > 0 && (
                      <select defaultValue={(item as { assigned_to?: string | null }).assigned_to ?? ''} onChange={(e) => assign(item.id, e.target.value)}
                        className="h-8 px-2 rounded-lg border border-white/[0.10] bg-[#0a0b0d] text-[11.5px] text-[#9a9a9d] cursor-pointer">
                        <option value="">Assign reviewer</option>
                        {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.full_name ?? m.email}</option>)}
                      </select>
                    )}
                    <button onClick={() => decide(item.id,'approved')} disabled={pending} className="h-8 px-4 rounded-lg bg-[#22d093]/12 border border-[#22d093]/30 text-[#22d093] text-[12px] font-medium hover:bg-[#22d093]/20 transition-all disabled:opacity-40">Approve</button>
                    <button onClick={() => decide(item.id,'rejected')} disabled={pending} className="h-8 px-4 rounded-lg bg-[#ff8a7a]/[0.08] border border-[#ff8a7a]/20 text-[#ff8a7a] text-[12px] font-medium hover:bg-[#ff8a7a]/15 transition-all disabled:opacity-40">Reject</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
