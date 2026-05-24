'use client'

import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import type { MockPipelineDeal } from '@/lib/data/mock-team'

interface Props {
  deals: MockPipelineDeal[]
}

const STAGE_CONFIG: Record<MockPipelineDeal['stage'], { label: string; color: string }> = {
  new:        { label: 'New',          color: '#6a6a6e' },
  qualified:  { label: 'Qualified',    color: '#3b9eff' },
  audit_sent: { label: 'Audit Sent',   color: '#ffae3c' },
  proposal:   { label: 'Proposal',     color: '#ff7a18' },
  won:        { label: 'Won',          color: '#22d093' },
  lost:       { label: 'Lost',         color: '#ff8a7a' },
}

const STAGE_OPTIONS = [
  { value: 'all',        label: 'All stages'  },
  { value: 'new',        label: 'New'         },
  { value: 'qualified',  label: 'Qualified'   },
  { value: 'audit_sent', label: 'Audit Sent'  },
  { value: 'proposal',   label: 'Proposal'    },
  { value: 'won',        label: 'Won'         },
  { value: 'lost',       label: 'Lost'        },
]

const PLAN_CONFIG: Record<string, { label: string; color: string }> = {
  starter: { label: 'Starter',    color: '#3b9eff' },
  pro:     { label: 'Booking OS', color: '#a07cff' },
  scale:   { label: 'Ops Center', color: '#ffae3c' },
}

export default function LeadsTableClient({ deals }: Props) {
  const [search,      setSearch]      = useState('')
  const [stageFilter, setStageFilter] = useState('all')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return deals.filter((d) => {
      if (stageFilter !== 'all' && d.stage !== stageFilter) return false
      if (!q) return true
      return (
        d.business.toLowerCase().includes(q)   ||
        d.contact.toLowerCase().includes(q)    ||
        d.next_action.toLowerCase().includes(q)
      )
    })
  }, [deals, search, stageFilter])

  const pipelineValue = filtered.filter((d) => d.stage !== 'lost').reduce((s, d) => s + d.value_usd, 0)

  return (
    <div className="flex flex-col gap-3">

      {/* Filter toolbar */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6a6a6e] pointer-events-none" />
          <input
            type="text"
            placeholder="Search business, contact, next action…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-4 py-2 rounded-xl border border-white/[0.08] bg-white/[0.03]
                       text-[13px] text-white placeholder-[#6a6a6e]
                       focus:outline-none focus:border-[#ff7a18]/40 focus:bg-white/[0.04] transition-all"
          />
        </div>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-white/[0.08] bg-[#0f1012]
                     text-[13px] text-white focus:outline-none focus:border-[#ff7a18]/40
                     transition-all cursor-pointer"
        >
          {STAGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/[0.06] bg-white/[0.02]
                        text-[12px] text-[#6a6a6e] shrink-0 whitespace-nowrap">
          <span className="text-[#22d093] font-semibold tabular-nums">
            ${pipelineValue.toLocaleString()}
          </span>
          <span>pipeline</span>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 px-5 py-10
                        text-center text-[13px] text-[#9a9a9d]">
          No leads match your search.
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px] min-w-[720px]">
              <thead className="bg-white/[0.02] text-[10px] uppercase tracking-[0.08em] text-[#6a6a6e]">
                <tr>
                  <th className="text-left px-4 py-2.5 min-w-[160px]">Business</th>
                  <th className="text-left px-4 py-2.5">Contact</th>
                  <th className="text-left px-4 py-2.5">Stage</th>
                  <th className="text-left px-4 py-2.5">Plan</th>
                  <th className="text-right px-4 py-2.5">Value</th>
                  <th className="text-left px-4 py-2.5">Next Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => {
                  const stage = STAGE_CONFIG[d.stage]
                  const plan  = PLAN_CONFIG[d.plan_target] ?? { label: d.plan_target, color: '#6a6a6e' }
                  return (
                    <tr key={d.id} className="border-t border-white/[0.04] hover:bg-white/[0.015] transition-colors">
                      <td className="px-4 py-3 text-white font-medium whitespace-nowrap">{d.business}</td>
                      <td className="px-4 py-3 text-[#9a9a9d] whitespace-nowrap">{d.contact}</td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center text-[10.5px] font-semibold px-2.5 py-[3px] rounded-full border whitespace-nowrap"
                          style={{ color: stage.color, borderColor: `${stage.color}33`, background: `${stage.color}12` }}
                        >
                          {stage.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center text-[10.5px] font-semibold px-2.5 py-[3px] rounded-full border whitespace-nowrap"
                          style={{ color: plan.color, borderColor: `${plan.color}33`, background: `${plan.color}10` }}
                        >
                          {plan.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[12.5px] font-semibold text-white tabular-nums whitespace-nowrap">
                        ${d.value_usd.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-[#9a9a9d] max-w-[200px] truncate">{d.next_action}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
