'use client'

import { useState, useTransition, useMemo } from 'react'
import { updateOpsTaskStatus, bulkUpdateOpsTasks, bulkAssignOpsItems, assignOpsItem } from '@/lib/actions/ops'
import type { OpsTask, BusinessMember } from '@/lib/actions/ops'
import { capture } from '@/lib/analytics/posthog'
import SearchPaginationBar from './SearchPaginationBar'

const PAGE_SIZE = 25

interface Props {
  tasks:      OpsTask[]
  members:    BusinessMember[]
  businessId: string | null
  onRefresh:  () => void
}

const PRIORITY_COLOR: Record<string, string> = {
  urgent: 'text-[#ff8a7a]', high: 'text-[#ffae3c]', normal: 'text-[#9a9a9d]', low: 'text-[#6a6a6e]',
}

const STATUS_CFG: Record<string, { label: string; bg: string }> = {
  pending:     { label: 'Pending',     bg: 'bg-[#ffae3c]/10 text-[#ffae3c]' },
  in_progress: { label: 'In Progress', bg: 'bg-[#3b9eff]/10 text-[#3b9eff]' },
  completed:   { label: 'Completed',   bg: 'bg-[#22d093]/10 text-[#22d093]' },
  cancelled:   { label: 'Cancelled',   bg: 'bg-white/[0.06] text-[#6a6a6e]' },
}

function relTime(ts: string) {
  const d = Date.now() - new Date(ts).getTime()
  const m = Math.floor(d / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
}

function SlaBadge({ slaDueAt, status, escalationLevel }: { slaDueAt: string | null; status: string; escalationLevel: number }) {
  if (!slaDueAt) return null
  const done = ['completed','cancelled']
  if (done.includes(status)) return null
  if (escalationLevel > 0) return <span className="text-[9.5px] px-1.5 py-0.5 rounded-full bg-[#c084fc]/10 text-[#c084fc] font-medium">ESC {escalationLevel}</span>
  const rem = new Date(slaDueAt).getTime() - Date.now()
  if (rem < 0) return <span className="text-[9.5px] px-1.5 py-0.5 rounded-full bg-[#ff8a7a]/10 text-[#ff8a7a] font-medium">Overdue</span>
  if (rem < 15 * 60000) return <span className="text-[9.5px] px-1.5 py-0.5 rounded-full bg-[#ff7a18]/10 text-[#ff7a18] font-medium">Due Soon</span>
  return null
}

export default function OpsTaskBoard({ tasks, members, onRefresh }: Props) {
  const [filter,       setFilter]      = useState('pending')
  const [search,       setSearch]      = useState('')
  const [page,         setPage]        = useState(1)
  const [selectedIds,  setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkAssignTo, setBulkAssignTo]= useState('')
  const [pending,      startTransition]= useTransition()
  const [bulkPending,  startBulk]     = useTransition()

  const filtered = useMemo(() => {
    let list = filter === 'all' ? tasks : tasks.filter((t) => t.status === filter)
    if (search) list = list.filter((t) => t.title.toLowerCase().includes(search.toLowerCase()))
    return list
  }, [tasks, filter, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  const bulk = (action: 'start' | 'complete' | 'dismiss') => {
    if (!selectedIds.size) return
    startBulk(async () => {
      await bulkUpdateOpsTasks(Array.from(selectedIds), action)
      if (action === 'complete') capture('ops_task_bulk_completed', { count: selectedIds.size })
      setSelectedIds(new Set()); onRefresh()
    })
  }
  const handleBulkAssign = () => {
    if (!selectedIds.size) return
    startBulk(async () => {
      await bulkAssignOpsItems('ops_tasks', Array.from(selectedIds), bulkAssignTo || null)
      capture('ops_bulk_assigned', { count: selectedIds.size, table: 'ops_tasks' })
      setSelectedIds(new Set()); onRefresh()
    })
  }

  const setStatus = (id: string, status: string) => startTransition(async () => {
    await updateOpsTaskStatus(id, status)
    if (status === 'completed') capture('ops_task_completed', {})
    onRefresh()
  })

  const assign = (id: string, userId: string) => startTransition(async () => {
    await assignOpsItem('ops_tasks', id, userId || null)
    capture('ops_item_assigned', { table: 'ops_tasks' })
    onRefresh()
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1.5 flex-wrap">
        {['pending','in_progress','completed','all'].map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-lg text-[11.5px] font-medium transition-all capitalize
                        ${filter === f ? 'bg-white/[0.10] text-white' : 'text-[#6a6a6e] hover:text-[#9a9a9d]'}`}>
            {f.replace('_', ' ')}
          </button>
        ))}
      </div>

      <SearchPaginationBar search={search} onSearch={(s) => { setSearch(s); setPage(1) }} page={page} totalPages={totalPages} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} placeholder="Search tasks…" />

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

      {paginated.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center rounded-2xl border border-white/[0.07] bg-[#0f1012]">
          <span className="text-[24px]">📋</span>
          <p className="text-[13px] font-medium text-white">No tasks</p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-white/[0.04] rounded-2xl border border-white/[0.07] bg-[#0f1012] overflow-hidden">
          {paginated.map((task) => {
            const sCfg = STATUS_CFG[task.status] ?? STATUS_CFG.pending
            return (
              <div key={task.id} className={`flex items-start gap-3 px-5 py-3.5 ${selectedIds.has(task.id) ? 'bg-white/[0.04]' : ''}`}>
                <input type="checkbox" checked={selectedIds.has(task.id)} onChange={() => toggleSelect(task.id)}
                  className="mt-1 w-3.5 h-3.5 accent-[#ff7a18] cursor-pointer shrink-0" />
                <div className={`mt-0.5 shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${PRIORITY_COLOR[task.priority]}`}>
                  {task.priority}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[13px] font-medium text-white">{task.title}</p>
                    <SlaBadge slaDueAt={task.sla_due_at ?? null} status={task.status} escalationLevel={task.escalation_level ?? 0} />
                  </div>
                  {task.description && <p className="text-[11.5px] text-[#9a9a9d] mt-0.5 truncate">{task.description}</p>}
                  <p className="text-[10.5px] text-[#6a6a6e] mt-0.5 capitalize">{task.task_type} · {relTime(task.created_at)}</p>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0 items-end">
                  {members.length > 0 && ['pending','in_progress'].includes(task.status) && (
                    <select defaultValue={task.assigned_to ?? ''} onChange={(e) => assign(task.id, e.target.value)}
                      className="h-7 px-1.5 rounded-lg border border-white/[0.10] bg-[#0a0b0d] text-[10.5px] text-[#9a9a9d] cursor-pointer">
                      <option value="">Assign</option>
                      {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.full_name ?? m.email}</option>)}
                    </select>
                  )}
                  <div className="flex items-center gap-2">
                    <span className={`text-[10.5px] px-2 py-0.5 rounded-full font-medium ${sCfg.bg}`}>{sCfg.label}</span>
                    {task.status === 'pending' && (
                      <button onClick={() => setStatus(task.id, 'in_progress')} disabled={pending}
                        className="text-[10.5px] px-2 py-0.5 rounded-lg border border-[#3b9eff]/30 text-[#3b9eff] hover:bg-[#3b9eff]/10 transition-all disabled:opacity-40">
                        Start
                      </button>
                    )}
                    {['pending','in_progress'].includes(task.status) && (
                      <button onClick={() => setStatus(task.id, 'completed')} disabled={pending}
                        className="text-[10.5px] px-2 py-0.5 rounded-lg border border-[#22d093]/30 text-[#22d093] hover:bg-[#22d093]/10 transition-all disabled:opacity-40">
                        Done
                      </button>
                    )}
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
