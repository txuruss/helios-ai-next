'use client'

import { useState, useTransition, useEffect, useCallback } from 'react'
import {
  updateOpsTaskStatus, bulkUpdateOpsTasks, bulkAssignOpsItems,
  assignOpsItem, getOpsTasks,
} from '@/lib/actions/ops'
import type { OpsTask, BusinessMember, PaginatedOpsResult } from '@/lib/actions/ops'
import { capture } from '@/lib/analytics/posthog'
import SearchPaginationBar from './SearchPaginationBar'
import SlaCountdown         from './SlaCountdown'
import SnoozeControl        from './SnoozeControl'

const PAGE_SIZE = 25

interface Props {
  initialData: PaginatedOpsResult<OpsTask>
  members:     BusinessMember[]
  businessId:  string | null
  onRefresh:   () => void
}

const PRIORITY_COLOR: Record<string, string> = {
  urgent:'text-[#ff8a7a]', high:'text-[#ffae3c]', normal:'text-[#9a9a9d]', low:'text-[#6a6a6e]',
}
const STATUS_CFG: Record<string, { label: string; bg: string }> = {
  pending:     { label:'Pending',     bg:'bg-[#ffae3c]/10 text-[#ffae3c]' },
  in_progress: { label:'In Progress', bg:'bg-[#3b9eff]/10 text-[#3b9eff]' },
  completed:   { label:'Completed',   bg:'bg-[#22d093]/10 text-[#22d093]' },
  cancelled:   { label:'Cancelled',   bg:'bg-white/[0.06] text-[#6a6a6e]' },
}

function relTime(ts: string) {
  const d = Date.now() - new Date(ts).getTime()
  const m = Math.floor(d / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
}

export default function OpsTaskBoard({ initialData, members, onRefresh }: Props) {
  const [tasks,        setTasks]       = useState(initialData.rows)
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
    setTasks(initialData.rows); setTotalCount(initialData.total_count); setPage(1)
  }, [initialData])

  const loadPage = useCallback((p: number, s: string, f: string, incSnoozed: boolean) => {
    startSearch(async () => {
      const result = await getOpsTasks({
        search: s || undefined,
        status: ['pending','in_progress','completed','cancelled'].includes(f) ? f : undefined,
        priority: ['low','normal','high','urgent'].includes(f) ? f : undefined,
        page: p, pageSize: PAGE_SIZE, include_snoozed: incSnoozed,
      })
      setTasks(result.rows); setTotalCount(result.total_count)
    })
  }, [])

  const handleSearch  = (s: string) => { setSearch(s); setPage(1); loadPage(1, s, filter, includeSnoozed) }
  const handlePage    = (p: number) => { setPage(p); loadPage(p, search, filter, includeSnoozed) }
  const handleFilter  = (f: string) => { setFilter(f); setPage(1); loadPage(1, search, f, includeSnoozed) }
  const toggleSnoozed = () => { const n = !includeSnoozed; setIncludeSnoozed(n); setPage(1); loadPage(1, search, filter, n) }
  const toggleSelect  = (id: string) => { setSelectedIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n }) }
  const totalPages    = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const bulk = (action: 'start'|'complete'|'dismiss') => {
    if (!selectedIds.size) return
    startBulk(async () => {
      await bulkUpdateOpsTasks(Array.from(selectedIds), action)
      if (action === 'complete') capture('ops_task_bulk_completed', { count: selectedIds.size })
      setSelectedIds(new Set()); loadPage(page, search, filter, includeSnoozed)
    })
  }
  const handleBulkAssign = () => {
    if (!selectedIds.size) return
    startBulk(async () => {
      await bulkAssignOpsItems('ops_tasks', Array.from(selectedIds), bulkAssignTo || null)
      setSelectedIds(new Set()); loadPage(page, search, filter, includeSnoozed)
    })
  }
  const setStatus = (id: string, status: string) => startAction(async () => {
    await updateOpsTaskStatus(id, status)
    if (status === 'completed') capture('ops_task_completed', {})
    loadPage(page, search, filter, includeSnoozed)
  })
  const assign = (id: string, uid: string) => startAction(async () => {
    await assignOpsItem('ops_tasks', id, uid||null); loadPage(page, search, filter, includeSnoozed)
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1.5 flex-wrap">
        {['pending','in_progress','completed','all'].map((f) => (
          <button key={f} onClick={() => handleFilter(f)}
            className={`px-3 py-1 rounded-lg text-[11.5px] font-medium transition-all capitalize ${filter === f ? 'bg-white/[0.10] text-white' : 'text-[#6a6a6e] hover:text-[#9a9a9d]'}`}>
            {f.replace('_',' ')}
          </button>
        ))}
        <button onClick={toggleSnoozed} className={`px-3 py-1 rounded-lg text-[11.5px] transition-all ${includeSnoozed ? 'bg-[#ffae3c]/10 text-[#ffae3c]' : 'text-[#6a6a6e] hover:text-[#9a9a9d]'}`}>
          💤 {includeSnoozed ? 'Hide snoozed' : 'Show snoozed'}
        </button>
      </div>

      <SearchPaginationBar search={search} onSearch={handleSearch} page={page} totalPages={totalPages} total={totalCount} pageSize={PAGE_SIZE} onPage={handlePage} placeholder="Search tasks…" loading={searchPending} />

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] flex-wrap">
          <span className="text-[12px] text-[#9a9a9d]">{selectedIds.size} selected</span>
          <button onClick={() => bulk('start')} disabled={bulkPending} className="h-7 px-3 rounded-lg text-[11.5px] border border-[#3b9eff]/30 text-[#3b9eff] hover:bg-[#3b9eff]/10 transition-all disabled:opacity-40">Start</button>
          <button onClick={() => bulk('complete')} disabled={bulkPending} className="h-7 px-3 rounded-lg text-[11.5px] border border-[#22d093]/30 text-[#22d093] hover:bg-[#22d093]/10 transition-all disabled:opacity-40">Complete</button>
          <button onClick={() => bulk('dismiss')} disabled={bulkPending} className="h-7 px-3 rounded-lg text-[11.5px] border border-white/[0.10] text-[#9a9a9d] hover:bg-white/[0.08] transition-all disabled:opacity-40">Dismiss</button>
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

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center rounded-2xl border border-white/[0.07] bg-[#0f1012]">
          <span className="text-[24px]">📋</span>
          <p className="text-[13px] font-medium text-white">{search ? 'No results' : 'No tasks'}</p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-white/[0.04] rounded-2xl border border-white/[0.07] bg-[#0f1012] overflow-hidden">
          {tasks.map((task) => {
            const sCfg      = STATUS_CFG[task.status] ?? STATUS_CFG.pending
            const isSnoozed = !!(task as { snoozed_until?: string | null }).snoozed_until
            const snoozedUntil = (task as { snoozed_until?: string | null }).snoozed_until ?? null
            return (
              <div key={task.id} className={`flex items-start gap-3 px-5 py-3.5 ${selectedIds.has(task.id) ? 'bg-white/[0.04]' : ''} ${isSnoozed ? 'opacity-60' : ''}`}>
                <input type="checkbox" checked={selectedIds.has(task.id)} onChange={() => toggleSelect(task.id)} className="mt-1 w-3.5 h-3.5 accent-[#ff7a18] cursor-pointer shrink-0" />
                <div className={`mt-0.5 shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${PRIORITY_COLOR[task.priority]}`}>{task.priority}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[13px] font-medium text-white">{task.title}</p>
                    <SlaCountdown slaDueAt={task.sla_due_at ?? null} status={task.status} escalationLevel={task.escalation_level ?? 0} compact />
                  </div>
                  {task.description && <p className="text-[11.5px] text-[#9a9a9d] mt-0.5 truncate">{task.description}</p>}
                  <p className="text-[10.5px] text-[#6a6a6e] mt-0.5 capitalize">{task.task_type} · {relTime(task.created_at)}</p>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0 items-end">
                  <SnoozeControl table="ops_tasks" id={task.id} isSnoozed={isSnoozed} snoozedUntil={snoozedUntil} onUpdated={() => loadPage(page,search,filter,includeSnoozed)} />
                  {members.length > 0 && ['pending','in_progress'].includes(task.status) && (
                    <select defaultValue={task.assigned_to ?? ''} onChange={(e) => assign(task.id, e.target.value)}
                      className="h-7 px-1.5 rounded-lg border border-white/[0.10] bg-[#0a0b0d] text-[10.5px] text-[#9a9a9d] cursor-pointer">
                      <option value="">Assign</option>
                      {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.full_name ?? m.email}</option>)}
                    </select>
                  )}
                  <div className="flex items-center gap-2">
                    <span className={`text-[10.5px] px-2 py-0.5 rounded-full font-medium ${sCfg.bg}`}>{sCfg.label}</span>
                    {task.status === 'pending' && <button onClick={() => setStatus(task.id,'in_progress')} disabled={pending} className="text-[10.5px] px-2 py-0.5 rounded-lg border border-[#3b9eff]/30 text-[#3b9eff] hover:bg-[#3b9eff]/10 transition-all disabled:opacity-40">Start</button>}
                    {['pending','in_progress'].includes(task.status) && <button onClick={() => setStatus(task.id,'completed')} disabled={pending} className="text-[10.5px] px-2 py-0.5 rounded-lg border border-[#22d093]/30 text-[#22d093] hover:bg-[#22d093]/10 transition-all disabled:opacity-40">Done</button>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
