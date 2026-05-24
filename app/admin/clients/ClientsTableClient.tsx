'use client'

import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import type { MockBusiness } from '@/lib/data/mock-businesses'
import PlanPill from '@/components/admin/ui/PlanPill'

interface Props {
  clients: MockBusiness[]
}

const PLAN_RATES: Record<string, number> = {
  starter: 149,
  pro:     399,
  scale:   999,
  free:    0,
}

const PLAN_OPTIONS = [
  { value: 'all',     label: 'All plans'  },
  { value: 'starter', label: 'Starter'    },
  { value: 'pro',     label: 'Booking OS' },
  { value: 'scale',   label: 'Ops Center' },
]

type HealthStatus = 'Healthy' | 'Watch' | 'At Risk' | 'Unknown'

function computeHealth(leads: number, bookings: number): HealthStatus {
  if (leads === 0) return 'Unknown'
  const ratio = bookings / leads
  if (ratio >= 0.6) return 'Healthy'
  if (ratio >= 0.3) return 'Watch'
  return 'At Risk'
}

const HEALTH_COLORS: Record<HealthStatus, string> = {
  'Healthy':  '#22d093',
  'Watch':    '#ffae3c',
  'At Risk':  '#ff8a7a',
  'Unknown':  '#6a6a6e',
}

export default function ClientsTableClient({ clients }: Props) {
  const [search,     setSearch]     = useState('')
  const [planFilter, setPlanFilter] = useState('all')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return clients.filter((c) => {
      if (planFilter !== 'all' && c.plan !== planFilter) return false
      if (!q) return true
      return (
        c.name.toLowerCase().includes(q)     ||
        c.industry.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q)
      )
    })
  }, [clients, search, planFilter])

  return (
    <div className="flex flex-col gap-3">

      {/* Filter toolbar */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6a6a6e] pointer-events-none" />
          <input
            type="text"
            placeholder="Search business, industry, city…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-4 py-2 rounded-xl border border-white/[0.08] bg-white/[0.03]
                       text-[13px] text-white placeholder-[#6a6a6e]
                       focus:outline-none focus:border-[#ff7a18]/40 focus:bg-white/[0.04] transition-all"
          />
        </div>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-white/[0.08] bg-[#0f1012]
                     text-[13px] text-white focus:outline-none focus:border-[#ff7a18]/40
                     transition-all cursor-pointer"
        >
          {PLAN_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/[0.06]
                        bg-white/[0.02] text-[12px] text-[#6a6a6e] shrink-0">
          <span className="font-semibold text-white tabular-nums">{filtered.length}</span>
          <span>/ {clients.length}</span>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 px-5 py-10
                        text-center text-[13px] text-[#9a9a9d]">
          No clients match your search.
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px] min-w-[860px]">
              <thead className="bg-white/[0.02] text-[10px] uppercase tracking-[0.08em] text-[#6a6a6e]">
                <tr>
                  <th className="text-left px-4 py-2.5 min-w-[150px]">Business</th>
                  <th className="text-left px-4 py-2.5">Industry</th>
                  <th className="text-left px-4 py-2.5">City</th>
                  <th className="text-left px-4 py-2.5">Plan</th>
                  <th className="text-right px-4 py-2.5 whitespace-nowrap">Leads/mo</th>
                  <th className="text-right px-4 py-2.5 whitespace-nowrap">Bookings/mo</th>
                  <th className="text-right px-4 py-2.5 whitespace-nowrap">Est. MRR</th>
                  <th className="text-left px-4 py-2.5">Health</th>
                  <th className="text-right px-4 py-2.5">Since</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const health = computeHealth(c.monthly_leads, c.monthly_bookings)
                  const healthColor = HEALTH_COLORS[health]
                  const mrr = PLAN_RATES[c.plan] ?? 0
                  return (
                    <tr key={c.id} className="border-t border-white/[0.04] hover:bg-white/[0.015] transition-colors">
                      <td className="px-4 py-3 text-white font-medium whitespace-nowrap">{c.name}</td>
                      <td className="px-4 py-3 text-[#9a9a9d] whitespace-nowrap">{c.industry}</td>
                      <td className="px-4 py-3 text-[#9a9a9d] whitespace-nowrap">{c.city}</td>
                      <td className="px-4 py-3"><PlanPill plan={c.plan} /></td>
                      <td className="px-4 py-3 text-right font-mono text-white tabular-nums">{c.monthly_leads}</td>
                      <td className="px-4 py-3 text-right font-mono text-white tabular-nums">{c.monthly_bookings}</td>
                      <td className="px-4 py-3 text-right font-mono text-[12.5px] font-semibold text-white tabular-nums">
                        ${mrr.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center text-[10.5px] font-semibold px-2.5 py-[3px] rounded-full border whitespace-nowrap"
                          style={{ color: healthColor, borderColor: `${healthColor}33`, background: `${healthColor}12` }}
                        >
                          {health}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-[11px] text-[#6a6a6e] whitespace-nowrap">
                        {new Date(c.created_at).toLocaleDateString()}
                      </td>
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
