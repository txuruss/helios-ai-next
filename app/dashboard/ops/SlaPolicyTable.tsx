'use client'

import { useState, useTransition } from 'react'
import { toggleSlaPolicy, deleteSlaPolicy } from '@/lib/actions/ops'
import type { SlaPolicy } from '@/lib/ops/sla'
import { capture } from '@/lib/analytics/posthog'
import SlaPolicyDrawer from './SlaPolicyDrawer'

interface Props {
  policies:  SlaPolicy[]
  onRefresh: () => void
}

function fmtMinutes(m: number): string {
  if (m < 60)   return `${m}m`
  if (m < 1440) return `${Math.floor(m / 60)}h`
  return `${Math.floor(m / 1440)}d`
}

export default function SlaPolicyTable({ policies, onRefresh }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editPolicy, setEditPolicy] = useState<SlaPolicy | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [togglePending, startToggle] = useTransition()
  const [delPending,    startDel]    = useTransition()

  const openCreate = () => { setEditPolicy(null); setDrawerOpen(true) }
  const openEdit   = (p: SlaPolicy) => { setEditPolicy(p); setDrawerOpen(true) }
  const closeDrawer = () => { setDrawerOpen(false); setEditPolicy(null) }

  const handleToggle = (id: string, current: boolean) => {
    startToggle(async () => {
      await toggleSlaPolicy(id, !current)
      capture('ops_sla_policy_toggled', { enabled: !current })
      onRefresh()
    })
  }

  const handleDelete = (id: string) => {
    if (!confirm('Delete this SLA policy?')) return
    setError(null)
    startDel(async () => {
      const result = await deleteSlaPolicy(id)
      if (result.error) { setError(result.error); return }
      capture('ops_sla_policy_deleted', {})
      onRefresh()
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-semibold text-[#6a6a6e] uppercase tracking-[0.12em]">SLA Policies</p>
        <button onClick={openCreate}
          className="h-8 px-3 rounded-lg text-[12px] bg-gradient-to-b from-[#ff8a2a] to-[#ee6a0c] text-[#1a0c00] font-medium hover:opacity-90 transition-opacity">
          + Create Policy
        </button>
      </div>

      {error && <p className="text-[12px] text-[#ff8a7a]">{error}</p>}

      {policies.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center rounded-2xl border border-white/[0.07] bg-[#0f1012]">
          <span className="text-[22px]">⏱</span>
          <p className="text-[13px] font-medium text-white">No SLA policies</p>
          <p className="text-[12px] text-[#6a6a6e]">Create a custom policy or seed defaults.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.07] bg-[#0f1012] overflow-hidden">
          <div className="divide-y divide-white/[0.04]">
            {policies.map((p) => (
              <div key={p.id} className="flex items-center gap-4 px-5 py-3.5">
                <button onClick={() => handleToggle(p.id, p.is_enabled)} disabled={togglePending}
                  className={`w-9 h-5 rounded-full transition-colors shrink-0 relative disabled:opacity-40 ${p.is_enabled ? 'bg-[#22d093]' : 'bg-white/[0.12]'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${p.is_enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-[13px] font-medium ${p.is_enabled ? 'text-white' : 'text-[#6a6a6e]'}`}>{p.name}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[10.5px] text-[#6a6a6e] capitalize">{p.target_type}</span>
                    {p.source   && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-[#9a9a9d]">{p.source}</span>}
                    {p.severity && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-[#9a9a9d]">{p.severity}</span>}
                    {p.priority && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-[#9a9a9d]">{p.priority}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0 min-w-[60px]">
                  <p className="text-[13px] font-semibold text-[#ffae3c]">{fmtMinutes(p.response_minutes)}</p>
                  {p.escalation_minutes && <p className="text-[10.5px] text-[#6a6a6e]">esc: {fmtMinutes(p.escalation_minutes)}</p>}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => openEdit(p)}
                    className="h-7 px-2.5 rounded-lg text-[11px] border border-white/[0.10] text-[#9a9a9d] hover:bg-white/[0.06] transition-all">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(p.id)} disabled={delPending}
                    className="h-7 px-2.5 rounded-lg text-[11px] border border-[#ff8a7a]/20 text-[#ff8a7a] hover:bg-[#ff8a7a]/10 transition-all disabled:opacity-40">
                    Del
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {drawerOpen && (
        <SlaPolicyDrawer policy={editPolicy} onClose={closeDrawer} onSaved={() => { onRefresh(); closeDrawer() }} />
      )}
    </div>
  )
}
