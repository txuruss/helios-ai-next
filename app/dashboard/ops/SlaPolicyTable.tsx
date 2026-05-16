'use client'

import { useState, useTransition } from 'react'
import { toggleSlaPolicy } from '@/lib/actions/ops'
import type { SlaPolicy } from '@/lib/actions/ops'
import { capture } from '@/lib/analytics/posthog'

interface Props {
  policies:  SlaPolicy[]
  onRefresh: () => void
}

function fmtMinutes(m: number): string {
  if (m < 60)   return `${m} min`
  if (m < 1440) return `${Math.floor(m / 60)}h`
  return `${Math.floor(m / 1440)}d`
}

export default function SlaPolicyTable({ policies, onRefresh }: Props) {
  const [pending, startTransition] = useTransition()

  const handleToggle = (id: string, current: boolean) => {
    startTransition(async () => {
      await toggleSlaPolicy(id, !current)
      capture('ops_sla_policy_toggled', { enabled: !current })
      onRefresh()
    })
  }

  if (policies.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center rounded-2xl border border-white/[0.07] bg-[#0f1012]">
        <span className="text-[22px]">⏱</span>
        <p className="text-[13px] font-medium text-white">No SLA policies</p>
        <p className="text-[12px] text-[#6a6a6e]">Click "Seed Default SLA Policies" to create standard response time targets.</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0f1012] overflow-hidden">
      <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between">
        <p className="text-[12px] font-semibold text-[#6a6a6e] uppercase tracking-[0.12em]">SLA Policies</p>
        <span className="text-[11px] text-[#6a6a6e]">{policies.filter((p) => p.is_enabled).length} active</span>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {policies.map((p) => (
          <div key={p.id} className="flex items-center gap-4 px-5 py-3.5">
            {/* Toggle */}
            <button
              onClick={() => handleToggle(p.id, p.is_enabled)}
              disabled={pending}
              className={`w-9 h-5 rounded-full transition-colors shrink-0 relative disabled:opacity-40
                          ${p.is_enabled ? 'bg-[#22d093]' : 'bg-white/[0.12]'}`}
            >
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
            <div className="text-right shrink-0">
              <p className="text-[13px] font-semibold text-[#ffae3c]">{fmtMinutes(p.response_minutes)}</p>
              {p.escalation_minutes && (
                <p className="text-[10.5px] text-[#6a6a6e]">esc: {fmtMinutes(p.escalation_minutes)}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
