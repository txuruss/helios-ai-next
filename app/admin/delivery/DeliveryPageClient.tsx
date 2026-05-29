'use client'

// Cross-client delivery board. Reuses existing task server actions
// (updateClientTask / completeClientTask / reopenClientTask) and the
// ClientDetailDrawer. Bulk status changes go through bulkUpdateClientTasks.
// No hard deletes — status changes only.

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Search, RotateCcw, Activity, X,
} from 'lucide-react'
import type {
  AdminDeliveryTaskRow, AdminDeliverySummary, DeliveryDueFilter,
  TaskStatus, TaskPriority, TaskCategory,
} from '@/lib/data/admin-delivery'
import AdminKpiCard from '@/components/admin/ui/AdminKpiCard'
import PlanPill from '@/components/admin/ui/PlanPill'
import ConfirmActionDialog from '@/components/admin/ui/ConfirmActionDialog'
import ClientDetailDrawer from '@/app/admin/clients/ClientDetailDrawer'
import {
  updateClientTask, completeClientTask, reopenClientTask, bulkUpdateClientTasks,
} from '@/lib/actions/admin-client-tasks'

const STATUS_CFG: Record<TaskStatus, { label: string; color: string }> = {
  todo:        { label: 'To do',       color: '#6a6a6e' },
  in_progress: { label: 'In progress', color: '#3b9eff' },
  blocked:     { label: 'Blocked',     color: '#ff5247' },
  done:        { label: 'Done',        color: '#22d093' },
}
const PRIORITY_CFG: Record<TaskPriority, { label: string; color: string }> = {
  low:    { label: 'Low',    color: '#6a6a6e' },
  normal: { label: 'Normal', color: '#9a9a9d' },
  high:   { label: 'High',   color: '#ffae3c' },
  urgent: { label: 'Urgent', color: '#ff5247' },
}
const CATEGORIES: TaskCategory[] = ['onboarding', 'setup', 'automation', 'communication', 'QA', 'handoff', 'support']

const STATUS_OPTIONS   = ['all', 'todo', 'in_progress', 'blocked', 'done'] as const
const PRIORITY_OPTIONS = ['all', 'low', 'normal', 'high', 'urgent'] as const
const DUE_OPTIONS: { value: DeliveryDueFilter; label: string }[] = [
  { value: 'all',         label: 'All due dates' },
  { value: 'overdue',     label: 'Overdue'       },
  { value: 'due_today',   label: 'Due today'     },
  { value: 'due_week',    label: 'Due this week' },
  { value: 'no_due_date', label: 'No due date'   },
]

const todayIso = () => new Date().toISOString().slice(0, 10)
const soonIso  = () => new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)

function isOverdue(t: AdminDeliveryTaskRow, today: string) {
  return t.status !== 'done' && !!t.due_date && t.due_date < today
}
function isDueSoon(t: AdminDeliveryTaskRow, today: string, soon: string) {
  return t.status !== 'done' && !!t.due_date && t.due_date >= today && t.due_date <= soon
}
// Sort rank: blocked → overdue → due soon → urgent → high → in progress → todo → done.
function rank(t: AdminDeliveryTaskRow, today: string, soon: string): number {
  if (t.status === 'done') return 8
  if (t.status === 'blocked') return 0
  if (isOverdue(t, today)) return 1
  if (isDueSoon(t, today, soon)) return 2
  if (t.priority === 'urgent') return 3
  if (t.priority === 'high') return 4
  if (t.status === 'in_progress') return 5
  return 6 // todo
}
function dueCmp(a: AdminDeliveryTaskRow, b: AdminDeliveryTaskRow): number {
  if (a.due_date && b.due_date) return a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0
  if (a.due_date) return -1
  if (b.due_date) return 1
  return 0
}

type BulkModal = { open: false } | { open: true; status: TaskStatus; label: string }

interface Props {
  tasks:           AdminDeliveryTaskRow[]
  summary:         AdminDeliverySummary
  migrationNeeded: boolean
  error:           string | null
}

export default function DeliveryPageClient({ tasks, summary, migrationNeeded, error }: Props) {
  const router = useRouter()
  const [search,     setSearch]     = useState('')
  const [statusF,    setStatusF]    = useState<string>('all')
  const [priorityF,  setPriorityF]  = useState<string>('all')
  const [categoryF,  setCategoryF]  = useState<string>('all')
  const [dueF,       setDueF]        = useState<DeliveryDueFilter>('all')
  const [selected,   setSelected]   = useState<Set<string>>(new Set())
  const [editTask,   setEditTask]   = useState<AdminDeliveryTaskRow | null>(null)
  const [bulkModal,  setBulkModal]  = useState<BulkModal>({ open: false })
  const [bulkErr,    setBulkErr]    = useState<string | null>(null)
  const [bulkPending, startBulk]    = useTransition()
  const [drawerId,   setDrawerId]   = useState<string | null>(null)
  const [drawerKey,  setDrawerKey]  = useState(0)

  const today = todayIso()
  const soon  = soonIso()

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const rows = tasks.filter((t) => {
      if (statusF   !== 'all' && t.status   !== statusF)   return false
      if (priorityF !== 'all' && t.priority !== priorityF) return false
      if (categoryF !== 'all' && t.category !== categoryF) return false
      if (dueF === 'overdue'     && !isOverdue(t, today)) return false
      if (dueF === 'due_today'   && !(t.status !== 'done' && t.due_date === today)) return false
      if (dueF === 'due_week'    && !isDueSoon(t, today, soon)) return false
      if (dueF === 'no_due_date' && t.due_date !== null) return false
      if (!q) return true
      return (
        t.client_business_name.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        (t.description ?? '').toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      )
    })
    return rows.sort((a, b) => rank(a, today, soon) - rank(b, today, soon) || dueCmp(a, b))
  }, [tasks, search, statusF, priorityF, categoryF, dueF, today, soon])

  const filtersActive = search !== '' || statusF !== 'all' || priorityF !== 'all' || categoryF !== 'all' || dueF !== 'all'
  function clearFilters() {
    setSearch(''); setStatusF('all'); setPriorityF('all'); setCategoryF('all'); setDueF('all')
  }

  const selectedVisible = filtered.filter((t) => selected.has(t.id))
  const selCount = selectedVisible.length
  const allSelected = filtered.length > 0 && filtered.every((t) => selected.has(t.id))

  function toggle(id: string) {
    setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleAll() {
    if (allSelected) setSelected((p) => { const n = new Set(p); filtered.forEach((t) => n.delete(t.id)); return n })
    else setSelected((p) => new Set([...p, ...filtered.map((t) => t.id)]))
  }

  function runBulk() {
    if (!bulkModal.open) return
    const ids = selectedVisible.map((t) => t.id)
    const status = bulkModal.status
    setBulkErr(null)
    startBulk(async () => {
      const r = await bulkUpdateClientTasks(ids, status)
      if (r.ok) {
        setBulkModal({ open: false })
        setSelected(new Set())
        router.refresh()
      } else {
        setBulkErr(r.error ?? 'Bulk update failed. Selected tasks are unchanged.')
      }
    })
  }

  const recs = buildRecommendations(summary)

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <header className="flex flex-col gap-1.5">
        <Link href="/admin/mission-control"
          className="text-[12px] text-[#6a6a6e] hover:text-[#ffae3c] flex items-center gap-1.5 mb-1 w-fit transition-colors">
          <ArrowLeft size={12} /> Back to Mission Control
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-[24px] font-bold tracking-tight text-white">Client Delivery</h1>
          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.10em]
                           px-2.5 py-1 rounded-full border border-[#22d093]/30 bg-[#22d093]/[0.07] text-[#22d093]">
            Live task data
          </span>
        </div>
        <p className="text-[13.5px] text-[#9a9a9d]">
          Track onboarding tasks, blocked work, upcoming deadlines, and clients ready to go live.
        </p>
      </header>

      {error && (
        <div className="rounded-xl border border-[#ffae3c]/30 bg-[#ffae3c]/[0.05] px-4 py-2.5 text-[12.5px] text-[#ffae3c]">
          {error}
        </div>
      )}

      {/* KPI cards */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <AdminKpiCard label="Overdue Tasks"       value={summary.overdueTasks}         tone={summary.overdueTasks > 0 ? 'danger' : 'neutral'}   sublabel="Past due" />
        <AdminKpiCard label="Due This Week"       value={summary.dueSoonTasks}         tone={summary.dueSoonTasks > 0 ? 'warning' : 'neutral'}  sublabel="Next 7 days" />
        <AdminKpiCard label="Blocked Tasks"       value={summary.blockedTasks}         tone={summary.blockedTasks > 0 ? 'danger' : 'neutral'}   sublabel="Need attention" />
        <AdminKpiCard label="Clients In Onboarding" value={summary.clientsInOnboarding} tone="info"                                              sublabel="In progress" />
        <AdminKpiCard label="Ready To Go Live"    value={summary.readyToGoLiveClients} tone={summary.readyToGoLiveClients > 0 ? 'success' : 'neutral'} sublabel="All tasks done" />
        <AdminKpiCard label="Open Tasks"          value={summary.openTasks}            tone="orange"                                            sublabel="Not done" />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main column */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          {/* Bulk action bar */}
          {selCount > 0 && (
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-[#ffae3c]/20 bg-[#ffae3c]/[0.04] flex-wrap">
              <span className="text-[12.5px] text-[#ffae3c] font-medium tabular-nums">{selCount} selected</span>
              <div className="flex items-center gap-2 flex-wrap">
                <BulkBtn label="Mark in progress" onClick={() => { setBulkErr(null); setBulkModal({ open: true, status: 'in_progress', label: 'in progress' }) }} />
                <BulkBtn label="Mark blocked"     onClick={() => { setBulkErr(null); setBulkModal({ open: true, status: 'blocked', label: 'blocked' }) }} />
                <BulkBtn label="Mark done"        onClick={() => { setBulkErr(null); setBulkModal({ open: true, status: 'done', label: 'done' }) }} />
                <BulkBtn label="Reopen"           onClick={() => { setBulkErr(null); setBulkModal({ open: true, status: 'todo', label: 'reopened (to do)' }) }} />
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-2.5 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6a6a6e] pointer-events-none" />
              <input type="text" placeholder="Search client, task, description…" value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-4 py-2 rounded-xl border border-white/[0.08] bg-white/[0.03] text-[13px] text-white placeholder-[#6a6a6e] focus:outline-none focus:border-[#ff7a18]/40 focus:bg-white/[0.04] transition-all" />
            </div>
            <FilterSelect value={statusF} onChange={setStatusF} options={STATUS_OPTIONS.map((s) => ({ value: s, label: s === 'all' ? 'All statuses' : STATUS_CFG[s as TaskStatus].label }))} />
            <FilterSelect value={priorityF} onChange={setPriorityF} options={PRIORITY_OPTIONS.map((p) => ({ value: p, label: p === 'all' ? 'All priorities' : PRIORITY_CFG[p as TaskPriority].label }))} />
            <FilterSelect value={categoryF} onChange={setCategoryF} options={[{ value: 'all', label: 'All categories' }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]} />
            <FilterSelect value={dueF} onChange={(v) => setDueF(v as DeliveryDueFilter)} options={DUE_OPTIONS} />
            {filtersActive && (
              <button type="button" onClick={clearFilters}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.02] text-[12px] text-[#9a9a9d] hover:text-white hover:bg-white/[0.05] transition-all">
                <RotateCcw size={11} /> Clear
              </button>
            )}
          </div>

          {/* Table */}
          {migrationNeeded ? (
            <Empty title="Delivery tracking unavailable" body="Apply the onboarding tasks migration to enable delivery tracking." />
          ) : tasks.length === 0 ? (
            <Empty title="No delivery work yet" body={summary.clientsInOnboarding === 0
              ? 'Delivery work will appear after clients are added.'
              : 'No onboarding tasks yet. Create checklists from the client detail drawer.'} />
          ) : filtered.length === 0 ? (
            <Empty title="No matches" body="No tasks match the current filters." />
          ) : (
            <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px] min-w-[920px]">
                  <thead className="bg-white/[0.02] text-[10px] uppercase tracking-[0.08em] text-[#6a6a6e]">
                    <tr>
                      <th className="px-3 py-2.5 w-[36px]">
                        <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all"
                          className="cursor-pointer" style={{ accentColor: '#ff7a18', width: 13, height: 13 }} />
                      </th>
                      <th className="text-left px-3 py-2.5 min-w-[150px]">Client</th>
                      <th className="text-left px-3 py-2.5 min-w-[200px]">Task</th>
                      <th className="text-left px-3 py-2.5">Category</th>
                      <th className="text-left px-3 py-2.5">Status</th>
                      <th className="text-left px-3 py-2.5">Priority</th>
                      <th className="text-left px-3 py-2.5 whitespace-nowrap">Due Date</th>
                      <th className="text-right px-3 py-2.5">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((t) => (
                      <DeliveryTaskRow
                        key={t.id} task={t} today={today} soon={soon}
                        selected={selected.has(t.id)} onToggle={() => toggle(t.id)}
                        onEdit={() => setEditTask(t)} onOpenClient={() => setDrawerId(t.client_id)}
                        onChanged={() => router.refresh()}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Delivery Focus */}
        <aside className="flex flex-col gap-4">
          <section className="rounded-2xl border border-[#ff7a18]/20 bg-[#ff7a18]/[0.03] overflow-hidden">
            <header className="flex items-center gap-2 px-5 py-3.5 border-b border-[#ff7a18]/10">
              <Activity size={13} className="text-[#ff7a18]" />
              <h2 className="text-[13.5px] font-semibold text-white">Delivery Focus</h2>
            </header>
            <div className="px-5 py-3.5 flex flex-col gap-2.5">
              {recs.map((r, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{ background: r.color }} />
                  <span className="text-[12.5px] text-[#cfd3dc] leading-snug">{r.label}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      {/* Bulk confirm */}
      <ConfirmActionDialog
        open={bulkModal.open}
        title={bulkModal.open ? `Mark ${selCount} task${selCount !== 1 ? 's' : ''} ${bulkModal.label}?` : ''}
        body={bulkModal.open
          ? `This updates the status of ${selCount} selected task${selCount !== 1 ? 's' : ''}. No tasks are deleted.${bulkErr ? `\n\n${bulkErr}` : ''}`
          : ''}
        confirmLabel="Update tasks"
        loading={bulkPending}
        onConfirm={runBulk}
        onCancel={() => { setBulkModal({ open: false }); setBulkErr(null) }}
      />

      {/* Edit task */}
      {editTask && (
        <EditTaskModal task={editTask} onClose={() => setEditTask(null)} onSaved={() => { setEditTask(null); router.refresh() }} />
      )}

      {/* Client detail drawer (reused) */}
      {drawerId && (
        <ClientDetailDrawer
          clientId={drawerId}
          reloadKey={drawerKey}
          onClose={() => setDrawerId(null)}
          onUpdatePayment={() => router.push('/admin/clients')}
          onChanged={() => { setDrawerKey((k) => k + 1); router.refresh() }}
        />
      )}
    </div>
  )
}

function buildRecommendations(s: AdminDeliverySummary): { label: string; color: string }[] {
  const recs: { label: string; color: string }[] = []
  if (s.overdueTasks > 0)         recs.push({ label: 'Clear overdue onboarding work first.', color: '#ff5247' })
  if (s.blockedTasks > 0)         recs.push({ label: 'Unblock client delivery tasks.',       color: '#ff5247' })
  if (s.dueSoonTasks > 0)         recs.push({ label: 'Complete tasks due this week.',         color: '#ffae3c' })
  if (s.readyToGoLiveClients > 0) recs.push({ label: 'Review ready clients and mark them live.', color: '#22d093' })
  if (recs.length === 0)          recs.push({ label: 'No delivery issues need attention.',    color: '#22d093' })
  return recs
}

function DeliveryTaskRow({
  task, today, soon, selected, onToggle, onEdit, onOpenClient, onChanged,
}: {
  task: AdminDeliveryTaskRow; today: string; soon: string; selected: boolean
  onToggle: () => void; onEdit: () => void; onOpenClient: () => void; onChanged: () => void
}) {
  const [busy, startBusy] = useTransition()
  const s = STATUS_CFG[task.status]
  const p = PRIORITY_CFG[task.priority]
  const overdue = isOverdue(task, today)
  const dueSoon = isDueSoon(task, today, soon)

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    startBusy(async () => {
      const r = await fn()
      if (r.ok) onChanged()
      else alert(r.error ?? 'Action failed. Try again.')
    })
  }

  return (
    <tr className={`border-t border-white/[0.04] transition-colors ${task.status === 'done' ? 'opacity-60' : 'hover:bg-white/[0.015]'} ${selected ? 'bg-[#ff7a18]/[0.04]' : ''}`}>
      <td className="px-3 py-2.5">
        <input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Select ${task.title}`}
          className="cursor-pointer" style={{ accentColor: '#ff7a18', width: 13, height: 13 }} />
      </td>
      <td className="px-3 py-2.5">
        <button type="button" onClick={onOpenClient}
          className="text-white font-medium hover:text-[#ffae3c] transition-colors text-left focus:outline-none focus:underline">
          {task.client_business_name}
        </button>
        {task.client_plan && <div className="mt-0.5"><PlanPill plan={task.client_plan} /></div>}
      </td>
      <td className="px-3 py-2.5">
        <div className={`leading-snug ${task.status === 'done' ? 'text-[#9a9a9d] line-through' : 'text-white'}`}>{task.title}</div>
        {task.description && <div className="text-[10.5px] text-[#6a6a6e] mt-0.5 max-w-[280px] truncate">{task.description}</div>}
      </td>
      <td className="px-3 py-2.5 text-[#9a9a9d] uppercase text-[10px] tracking-[0.06em] whitespace-nowrap">{task.category}</td>
      <td className="px-3 py-2.5"><MiniPill color={s.color} label={s.label} /></td>
      <td className="px-3 py-2.5"><MiniPill color={p.color} label={p.label} /></td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        {task.due_date ? (
          <div className="flex flex-col gap-0.5">
            <span className="text-[11.5px] tabular-nums" style={{ color: overdue ? '#ff5247' : '#9a9a9d' }}>
              {new Date(task.due_date).toLocaleDateString()}
            </span>
            {overdue && <MiniPill color="#ff5247" label="Overdue" />}
            {!overdue && dueSoon && <MiniPill color="#ffae3c" label="Due soon" />}
          </div>
        ) : (
          <span className="text-[11px] text-[#6a6a6e]">No due date</span>
        )}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center justify-end gap-2.5 text-[11px] whitespace-nowrap">
          {task.status !== 'done' ? (
            <>
              {task.status === 'todo' && (
                <button type="button" disabled={busy} onClick={() => run(() => updateClientTask(task.id, { status: 'in_progress' }))}
                  className="text-[#3b9eff] hover:text-[#7ec0ff] transition-colors disabled:opacity-50 focus:outline-none focus:underline">Start</button>
              )}
              {task.status !== 'blocked' && (
                <button type="button" disabled={busy} onClick={() => run(() => updateClientTask(task.id, { status: 'blocked' }))}
                  className="text-[#ff8a7a] hover:text-[#ffb0a4] transition-colors disabled:opacity-50 focus:outline-none focus:underline">Block</button>
              )}
              <button type="button" disabled={busy} onClick={() => run(() => completeClientTask(task.id))}
                className="text-[#22d093] hover:text-[#5be4b5] transition-colors disabled:opacity-50 focus:outline-none focus:underline">Done</button>
            </>
          ) : (
            <button type="button" disabled={busy} onClick={() => run(() => reopenClientTask(task.id))}
              className="text-[#ffae3c] hover:text-[#ffce7a] transition-colors disabled:opacity-50 focus:outline-none focus:underline">Reopen</button>
          )}
          <button type="button" disabled={busy} onClick={onEdit}
            className="text-[#9a9a9d] hover:text-white transition-colors disabled:opacity-50 focus:outline-none focus:underline">Edit</button>
        </div>
      </td>
    </tr>
  )
}

function EditTaskModal({ task, onClose, onSaved }: { task: AdminDeliveryTaskRow; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle]       = useState(task.title)
  const [desc,  setDesc]        = useState(task.description ?? '')
  const [status, setStatus]     = useState<TaskStatus>(task.status)
  const [category, setCategory] = useState<TaskCategory>(task.category)
  const [priority, setPriority] = useState<TaskPriority>(task.priority)
  const [due,    setDue]        = useState(task.due_date ?? '')
  const [err,    setErr]        = useState<string | null>(null)
  const [saving, startSave]     = useTransition()

  function save() {
    setErr(null)
    startSave(async () => {
      const r = await updateClientTask(task.id, { title, description: desc, status, category, priority, due_date: due })
      if (r.ok) onSaved()
      else setErr(r.error ?? 'Could not save task.')
    })
  }

  const inputCls = 'w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.03] text-[13px] text-white placeholder-[#6a6a6e] focus:outline-none focus:border-[#ff7a18]/40 transition-all'
  const labelCls = 'text-[11px] font-medium text-[#9a9a9d] mb-1 block'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 backdrop-blur-sm px-4"
      role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-[460px] rounded-2xl border border-white/[0.10] bg-[#0f1012] shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-1">
          <div>
            <h2 className="text-[15px] font-semibold text-white">Edit task</h2>
            <p className="text-[12px] text-[#6a6a6e] mt-0.5">{task.client_business_name}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[#6a6a6e] hover:text-white transition-colors mt-0.5"><X size={14} /></button>
        </div>
        <div className="px-5 py-4 flex flex-col gap-3.5">
          <div>
            <label className={labelCls}>Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)} className={`${inputCls} cursor-pointer`}>
                {(['todo', 'in_progress', 'blocked', 'done'] as TaskStatus[]).map((s) => <option key={s} value={s}>{STATUS_CFG[s].label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} className={`${inputCls} cursor-pointer`}>
                {(['low', 'normal', 'high', 'urgent'] as TaskPriority[]).map((p) => <option key={p} value={p}>{PRIORITY_CFG[p].label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as TaskCategory)} className={`${inputCls} cursor-pointer`}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Due date</label>
              <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={inputCls} />
            </div>
          </div>
          {err && <p className="text-[12px] text-[#ff8a7a]">{err}</p>}
        </div>
        <div className="flex justify-end gap-2.5 px-5 pb-5">
          <button type="button" onClick={onClose} disabled={saving}
            className="px-4 py-2 rounded-xl text-[13px] font-medium text-[#9a9a9d] border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:text-white transition-all disabled:opacity-50">Cancel</button>
          <button type="button" onClick={save} disabled={saving || title.trim().length === 0}
            className="px-4 py-2 rounded-xl text-[13px] font-medium bg-[#ff7a18]/[0.14] border border-[#ff7a18]/40 text-[#ffae3c] hover:bg-[#ff7a18]/25 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? 'Saving…' : 'Save task'}
          </button>
        </div>
      </div>
    </div>
  )
}

function FilterSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="px-3 py-2 rounded-xl border border-white/[0.08] bg-[#0f1012] text-[13px] text-white cursor-pointer focus:outline-none focus:border-[#ff7a18]/40 transition-all">
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function BulkBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="text-[12px] font-medium px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.12] text-[#cfd3dc] hover:bg-white/[0.08] hover:text-white transition-all">
      {label}
    </button>
  )
}

function MiniPill({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center text-[10px] font-semibold px-2 py-[2px] rounded-full border whitespace-nowrap"
      style={{ color, borderColor: `${color}33`, background: `${color}12` }}>
      {label}
    </span>
  )
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 px-5 py-12 text-center flex flex-col items-center gap-2">
      <div className="text-[15px] font-medium text-white">{title}</div>
      <p className="text-[13px] text-[#9a9a9d] max-w-[420px]">{body}</p>
    </div>
  )
}
