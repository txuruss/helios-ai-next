'use client'

// Audit-to-Close lead list: KPIs, search/status filter, table with links
// into the lead detail workspace, and the New Lead modal.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, Plus } from 'lucide-react'
import AdminKpiCard from '@/components/admin/ui/AdminKpiCard'
import AtcLeadModal from './AtcLeadModal'
import {
  ATC_STATUSES, ATC_STATUS_CONFIG, ATC_INACTIVE_STATUSES,
  FIT_LEVEL_CONFIG, type AtcLead,
} from '@/lib/atc/types'
import { PLAN_FEES, isAdminPlan } from '@/lib/admin/plan-pricing'

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) } catch { return '—' }
}

export default function AtcPageClient({ leads, viewAll }: { leads: AtcLead[]; viewAll: boolean }) {
  const router = useRouter()
  const [search, setSearch]     = useState('')
  const [statusF, setStatusF]   = useState('all')
  const [modalOpen, setModalOpen] = useState(false)

  const k = useMemo(() => {
    let qualified = 0, ready = 0, fitSum = 0, fitN = 0
    for (const l of leads) {
      if (!ATC_INACTIVE_STATUSES.includes(l.status)) {
        if (l.status === 'qualified') qualified++
        if (l.status === 'ready_for_outreach') ready++
      }
      if (l.fit_score !== null) { fitSum += l.fit_score; fitN++ }
    }
    return {
      total: leads.length,
      qualified,
      ready,
      avgFit: fitN ? Math.round(fitSum / fitN) : null,
    }
  }, [leads])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return leads.filter((l) => {
      if (statusF !== 'all' && l.status !== statusF) return false
      if (!q) return true
      return (
        l.business_name.toLowerCase().includes(q) ||
        (l.industry ?? '').toLowerCase().includes(q) ||
        (l.location ?? '').toLowerCase().includes(q)
      )
    })
  }, [leads, search, statusF])

  return (
    <div className="flex flex-col gap-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <AdminKpiCard label="Leads" value={k.total} sublabel={viewAll ? 'All agents' : 'Your leads'} />
        <AdminKpiCard label="Qualified" value={k.qualified} tone="warning" />
        <AdminKpiCard label="Ready for outreach" value={k.ready} tone="orange" />
        <AdminKpiCard label="Avg fit score" value={k.avgFit ?? '—'} tone={k.avgFit !== null && k.avgFit >= 60 ? 'success' : 'neutral'} sublabel="of scored leads" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6a6a6e]" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search business, industry, location…"
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.03] text-[13px] text-white placeholder-[#6a6a6e] focus:outline-none focus:border-[#ff7a18]/40 transition-all"
          />
        </div>
        <select
          value={statusF} onChange={(e) => setStatusF(e.target.value)}
          className="px-3 py-2 rounded-xl border border-white/[0.08] bg-[#0f1012] text-[12.5px] text-[#cfd3dc] cursor-pointer focus:outline-none focus:border-[#ff7a18]/40"
        >
          <option value="all">All statuses</option>
          {ATC_STATUSES.filter((s) => s !== 'archived').map((s) => (
            <option key={s} value={s}>{ATC_STATUS_CONFIG[s].label}</option>
          ))}
        </select>
        <button
          type="button" onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-medium bg-[#ff7a18]/[0.14] border border-[#ff7a18]/40 text-[#ffae3c] hover:bg-[#ff7a18]/25 hover:text-white transition-all"
        >
          <Plus size={14} /> New lead
        </button>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {['Business', 'Industry', 'Status', 'Fit', 'Package', 'Owner', 'Added'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.10em] text-[#6a6a6e] whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[13px] text-[#6a6a6e]">
                  {leads.length === 0 ? 'No leads yet — add your first prospect.' : 'No leads match the current filter.'}
                </td>
              </tr>
            )}
            {filtered.map((l) => {
              const st = ATC_STATUS_CONFIG[l.status]
              const fit = l.fit_level ? FIT_LEVEL_CONFIG[l.fit_level] : null
              const pkg = l.recommended_package && isAdminPlan(l.recommended_package)
                ? PLAN_FEES[l.recommended_package].label : null
              return (
                <tr key={l.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/admin/audit-to-close/${l.id}`} className="text-[13px] font-medium text-white hover:text-[#ffae3c] transition-colors">
                      {l.business_name}
                    </Link>
                    {l.location && <div className="text-[11px] text-[#6a6a6e]">{l.location}</div>}
                  </td>
                  <td className="px-4 py-3 text-[12.5px] text-[#9a9a9d]">{l.industry ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className="text-[10.5px] font-semibold px-2 py-[3px] rounded-full border whitespace-nowrap"
                      style={{ color: st.color, borderColor: `${st.color}33`, background: `${st.color}12` }}>
                      {st.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {l.fit_score !== null && fit ? (
                      <span className="text-[12.5px] font-bold tabular-nums" style={{ color: fit.color }}>
                        {l.fit_score}
                      </span>
                    ) : <span className="text-[12px] text-[#6a6a6e]">—</span>}
                  </td>
                  <td className="px-4 py-3 text-[12.5px] text-[#9a9a9d] whitespace-nowrap">{pkg ?? '—'}</td>
                  <td className="px-4 py-3 text-[12px] text-[#9a9a9d] whitespace-nowrap">
                    {l.assigned_to_name ?? l.created_by_name ?? 'Unknown'}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-[#6a6a6e] whitespace-nowrap">{fmtDate(l.created_at)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <AtcLeadModal
          onClose={() => setModalOpen(false)}
          onSaved={(leadId) => {
            setModalOpen(false)
            if (leadId) router.push(`/admin/audit-to-close/${leadId}`)
            else router.refresh()
          }}
        />
      )}
    </div>
  )
}
