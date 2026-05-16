'use client'

import { useState, useTransition } from 'react'
import { updateOpsAlertStatus, bulkUpdateOpsAlerts, assignOpsItem } from '@/lib/actions/ops'
import type { OpsAlert, BusinessMember } from '@/lib/actions/ops'
import { capture } from '@/lib/analytics/posthog'

interface Props {
  alerts:     OpsAlert[]
  members:    BusinessMember[]
  businessId: string | null
  onRefresh:  () => void
}

const SEV_CONFIG: Record<string, { bg: string; text: string; icon: string }> = {
  critical: { bg: 'bg-[#ff8a7a]/10 border-[#ff8a7a]/20', text: 'text-[#ff8a7a]', icon: '🔴' },
  error:    { bg: 'bg-[#ff8a7a]/10 border-[#ff8a7a]/20', text: 'text-[#ff8a7a]', icon: '🔺' },
  warning:  { bg: 'bg-[#ffae3c]/10 border-[#ffae3c]/20', text: 'text-[#ffae3c]', icon: '⚠' },
  info:     { bg: 'bg-white/[0.03] border-white/[0.07]', text: 'text-[#9a9a9d]', icon: 'ℹ' },
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
  const resolved = ['resolved','acknowledged']
  if (resolved.includes(status)) return null
  if (escalationLevel > 0) return <span className="text-[9.5px] px-1.5 py-0.5 rounded-full bg-[#c084fc]/10 text-[#c084fc] font-medium">ESC {escalationLevel}</span>
  const rem = new Date(slaDueAt).getTime() - Date.now()
  if (rem < 0) return <span className="text-[9.5px] px-1.5 py-0.5 rounded-full bg-[#ff8a7a]/10 text-[#ff8a7a] font-medium">SLA Breached</span>
  if (rem < 15 * 60000) return <span className="text-[9.5px] px-1.5 py-0.5 rounded-full bg-[#ff7a18]/10 text-[#ff7a18] font-medium">Due Soon</span>
  return null
}

export default function OpsAlertPanel({ alerts, members, onRefresh }: Props) {
  const [filter,      setFilter]      = useState('active')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [pending,     startTransition] = useTransition()
  const [bulkPending, startBulk]      = useTransition()

  const filtered = filter === 'all' ? alerts : alerts.filter((a) => a.status === filter)

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  const bulk = (action: 'acknowledge' | 'resolve' | 'ignore') => {
    if (!selectedIds.size) return
    startBulk(async () => {
      const actualAction = action === 'ignore' ? 'resolve' : action
      await bulkUpdateOpsAlerts(Array.from(selectedIds), actualAction)
      capture(`ops_alert_bulk_${action}d`, { count: selectedIds.size })
      setSelectedIds(new Set())
      onRefresh()
    })
  }

  const ack     = (id: string) => startTransition(async () => { await updateOpsAlertStatus(id, 'acknowledged'); capture('ops_alert_acknowledged', {}); onRefresh() })
  const resolve = (id: string) => startTransition(async () => { await updateOpsAlertStatus(id, 'resolved'); onRefresh() })
  const assign  = (id: string, userId: string) => startTransition(async () => {
    await assignOpsItem('ops_alerts', id, userId || null)
    capture('ops_item_assigned', { table: 'ops_alerts' })
    onRefresh()
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1.5 flex-wrap">
        {['active','acknowledged','resolved','all'].map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-lg text-[11.5px] font-medium transition-all capitalize
                        ${filter === f ? 'bg-white/[0.10] text-white' : 'text-[#6a6a6e] hover:text-[#9a9a9d]'}`}>
            {f}
            {f === 'active' && alerts.filter((a) => a.status === 'active').length > 0 && (
              <span className="ml-1 text-[10px] px-1 rounded-full bg-[#ff8a7a]/20 text-[#ff8a7a]">
                {alerts.filter((a) => a.status === 'active').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04]">
          <span className="text-[12px] text-[#9a9a9d]">{selectedIds.size} selected</span>
          <button onClick={() => bulk('acknowledge')} disabled={bulkPending}
            className="h-7 px-3 rounded-lg text-[11.5px] border border-[#3b9eff]/30 text-[#3b9eff] hover:bg-[#3b9eff]/10 transition-all disabled:opacity-40">
            Acknowledge
          </button>
          <button onClick={() => bulk('resolve')} disabled={bulkPending}
            className="h-7 px-3 rounded-lg text-[11.5px] border border-[#22d093]/30 text-[#22d093] hover:bg-[#22d093]/10 transition-all disabled:opacity-40">
            Resolve
          </button>
          <button onClick={() => setSelectedIds(new Set())}
            className="h-7 px-3 rounded-lg text-[11.5px] text-[#6a6a6e] hover:text-[#9a9a9d] transition-all">
            Clear
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center rounded-2xl border border-white/[0.07] bg-[#0f1012]">
          <span className="text-[24px]">✅</span>
          <p className="text-[13px] font-medium text-white">No alerts</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((alert) => {
            const cfg = SEV_CONFIG[alert.severity] ?? SEV_CONFIG.info
            return (
              <div key={alert.id} className={`flex items-start gap-3 px-4 py-3.5 rounded-2xl border ${cfg.bg} ${selectedIds.has(alert.id) ? 'ring-1 ring-[#ff7a18]/30' : ''}`}>
                <input type="checkbox" checked={selectedIds.has(alert.id)} onChange={() => toggleSelect(alert.id)}
                  className="mt-0.5 w-3.5 h-3.5 accent-[#ff7a18] cursor-pointer shrink-0" />
                <span className="text-[16px] mt-0.5">{cfg.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-[13px] font-semibold ${cfg.text}`}>{alert.title}</p>
                    <SlaBadge slaDueAt={alert.sla_due_at ?? null} status={alert.status} escalationLevel={alert.escalation_level ?? 0} />
                  </div>
                  {alert.message && <p className="text-[12px] text-[#9a9a9d] mt-0.5">{alert.message}</p>}
                  <p className="text-[10.5px] text-[#6a6a6e] mt-1 capitalize">{alert.alert_type} · {relTime(alert.created_at)}</p>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0 items-end">
                  {members.length > 0 && alert.status === 'active' && (
                    <select defaultValue={(alert as { assigned_to?: string | null }).assigned_to ?? ''} onChange={(e) => assign(alert.id, e.target.value)}
                      className="h-7 px-1.5 rounded-lg border border-white/[0.10] bg-[#0a0b0d] text-[10.5px] text-[#9a9a9d] cursor-pointer">
                      <option value="">Assign</option>
                      {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.full_name ?? m.email}</option>)}
                    </select>
                  )}
                  <div className="flex gap-1.5">
                    {alert.status === 'active' && (
                      <>
                        <button onClick={() => ack(alert.id)} disabled={pending}
                          className="text-[11px] px-2.5 py-1 rounded-lg border border-[#3b9eff]/30 text-[#3b9eff] hover:bg-[#3b9eff]/10 transition-all disabled:opacity-40">
                          Ack
                        </button>
                        <button onClick={() => resolve(alert.id)} disabled={pending}
                          className="text-[11px] px-2.5 py-1 rounded-lg border border-[#22d093]/30 text-[#22d093] hover:bg-[#22d093]/10 transition-all disabled:opacity-40">
                          Resolve
                        </button>
                      </>
                    )}
                    {alert.status === 'acknowledged' && (
                      <button onClick={() => resolve(alert.id)} disabled={pending}
                        className="text-[11px] px-2.5 py-1 rounded-lg border border-[#22d093]/30 text-[#22d093] hover:bg-[#22d093]/10 transition-all disabled:opacity-40">
                        Resolve
                      </button>
                    )}
                    {alert.status === 'resolved' && <span className="text-[11px] text-[#22d093]">✓</span>}
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
