import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/require-admin'
import { MOCK_BUSINESSES } from '@/lib/data/mock-businesses'
import AdminKpiCard from '@/components/admin/ui/AdminKpiCard'
import ClientsTableClient from './ClientsTableClient'
import { ArrowLeft, Users, ExternalLink, Activity } from 'lucide-react'

export const metadata = { title: 'Clients — Mission Control' }

const PLAN_RATES: Record<string, number> = {
  starter: 149,
  pro:     399,
  scale:   999,
  free:    0,
}

function clientHealth(leads: number, bookings: number): 'healthy' | 'watch' | 'at_risk' | 'unknown' {
  if (leads === 0) return 'unknown'
  const ratio = bookings / leads
  if (ratio >= 0.6) return 'healthy'
  if (ratio >= 0.3) return 'watch'
  return 'at_risk'
}

export default async function AdminClientsPage() {
  await requireAdmin({ path: '/admin/clients' })

  const active     = MOCK_BUSINESSES.length
  const totalLeads = MOCK_BUSINESSES.reduce((s, b) => s + b.monthly_leads,    0)
  const totalBook  = MOCK_BUSINESSES.reduce((s, b) => s + b.monthly_bookings, 0)
  const totalMRR   = MOCK_BUSINESSES.reduce((s, b) => s + (PLAN_RATES[b.plan] ?? 0), 0)
  const avgMRR     = active > 0 ? Math.round(totalMRR / active) : 0
  const atRisk     = MOCK_BUSINESSES.filter((b) => clientHealth(b.monthly_leads, b.monthly_bookings) === 'at_risk').length

  return (
    <div className="flex flex-col gap-5">

      {/* ── Page header ─────────────────────────────────────────── */}
      <header className="flex flex-col gap-1">
        <Link
          href="/admin/mission-control"
          className="text-[12px] text-[#6a6a6e] hover:text-[#ffae3c] flex items-center gap-1.5 mb-1 w-fit transition-colors"
        >
          <ArrowLeft size={12} /> Back to Mission Control
        </Link>
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-[24px] font-bold tracking-tight text-white">Active Clients</h1>
          <span className="text-[9.5px] font-medium uppercase tracking-[0.08em]
                           px-2 py-0.5 rounded-full border border-white/[0.10] bg-white/[0.03] text-[#6a6a6e]">
            Local data
          </span>
        </div>
        <p className="text-[13px] text-[#9a9a9d]">
          Founder view of all active clients across plans and health status.{' '}
          <Link href="/dashboard/business" className="text-[#ffae3c]/70 hover:text-[#ffae3c] transition-colors inline-flex items-center gap-1">
            Legacy workspace <ExternalLink size={10} />
          </Link>
        </p>
      </header>

      {/* ── KPI Command Strip ────────────────────────────────────── */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <AdminKpiCard
          label="Active Clients"
          value={active}
          tone="neutral"
          sublabel="All plans"
        />
        <AdminKpiCard
          label="Monthly Leads"
          value={totalLeads.toLocaleString()}
          tone="info"
          sublabel="Across all clients"
        />
        <AdminKpiCard
          label="Monthly Bookings"
          value={totalBook.toLocaleString()}
          tone="success"
          sublabel="Across all clients"
        />
        <AdminKpiCard
          label="Estimated MRR"
          value={`$${totalMRR.toLocaleString()}`}
          tone="orange"
          sublabel="Stripe not connected"
        />
        <AdminKpiCard
          label="Avg / Client"
          value={`$${avgMRR}/mo`}
          tone="info"
          sublabel="MRR ÷ active clients"
        />
        <AdminKpiCard
          label="At-Risk Clients"
          value={atRisk}
          tone={atRisk > 0 ? 'danger' : 'neutral'}
          sublabel={atRisk > 0 ? 'Low booking rate' : 'All healthy'}
        />
      </section>

      {/* ── Client table + Health Focus ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Table */}
        <div className="lg:col-span-2">
          <ClientsTableClient clients={MOCK_BUSINESSES} />
        </div>

        {/* Client Health Focus panel */}
        <aside className="flex flex-col gap-4">
          <section className="rounded-2xl border border-[#ff7a18]/20 bg-[#ff7a18]/[0.03] overflow-hidden">
            <header className="flex items-center gap-2 px-5 py-3.5 border-b border-[#ff7a18]/10">
              <Activity size={13} className="text-[#ff7a18]" />
              <h2 className="text-[13.5px] font-semibold text-white">Client Health</h2>
            </header>
            <div className="px-5 py-3.5 flex flex-col gap-3 text-[12.5px]">
              <HealthRow
                label="Healthy"
                count={MOCK_BUSINESSES.filter((b) => clientHealth(b.monthly_leads, b.monthly_bookings) === 'healthy').length}
                color="#22d093"
                note="Booking rate ≥ 60%"
              />
              <HealthRow
                label="Watch"
                count={MOCK_BUSINESSES.filter((b) => clientHealth(b.monthly_leads, b.monthly_bookings) === 'watch').length}
                color="#ffae3c"
                note="Booking rate 30–59%"
              />
              <HealthRow
                label="At Risk"
                count={atRisk}
                color="#ff8a7a"
                note="Booking rate < 30%"
              />
              <div className="border-t border-white/[0.06] pt-2.5 flex items-center justify-between">
                <span className="text-[#9a9a9d]">Total active</span>
                <span className="text-[#ffae3c] font-semibold tabular-nums">{active}</span>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 p-4">
            <p className="text-[13px] font-semibold text-white mb-2">Next best actions</p>
            <ul className="flex flex-col gap-1.5 text-[12px] text-[#9a9a9d]">
              <li className="flex items-start gap-1.5">
                <span className="text-[#ff7a18] mt-0.5 shrink-0">→</span>
                <span>Check Watch clients for upsell or support opportunities</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#ff7a18] mt-0.5 shrink-0">→</span>
                <span>Review new clients — onboarding may still be in progress</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#ff7a18] mt-0.5 shrink-0">→</span>
                <span>Connect Stripe to replace estimated revenue figures</span>
              </li>
            </ul>
          </section>

          <section className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 p-4 text-[12px] text-[#9a9a9d]">
            <p className="font-semibold text-white mb-2 text-[13px]">Health legend</p>
            <div className="flex flex-col gap-1.5">
              <LegendRow color="#22d093" label="Healthy — booking rate ≥ 60%" />
              <LegendRow color="#ffae3c" label="Watch — booking rate 30–59%" />
              <LegendRow color="#ff8a7a" label="At Risk — booking rate < 30%" />
              <LegendRow color="#6a6a6e" label="Unknown — no lead data" />
            </div>
            <p className="text-[10.5px] text-[#6a6a6e] mt-3 border-t border-white/[0.06] pt-2.5">
              Health is calculated from lead/booking ratios only. Not written to the database.
            </p>
          </section>
        </aside>
      </div>

    </div>
  )
}

// ── Health row ────────────────────────────────────────────────────

function HealthRow({ label, count, color, note }: {
  label: string; count: number; color: string; note: string
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
      <span className="text-[#9a9a9d] flex-1">{label}</span>
      <span className="tabular-nums font-semibold text-white">{count}</span>
      <span className="text-[10.5px] text-[#6a6a6e] shrink-0 hidden sm:block">{note}</span>
    </div>
  )
}

// ── Legend row ────────────────────────────────────────────────────

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
      <span className="text-[11px] text-[#9a9a9d]">{label}</span>
    </div>
  )
}
