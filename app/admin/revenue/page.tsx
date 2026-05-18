import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/require-admin'
import { MOCK_ADMIN_REVENUE } from '@/lib/data/mock-admin'
import LegacyNote from '@/components/admin/LegacyNote'
import { ArrowLeft } from 'lucide-react'

export const metadata = { title: 'Revenue — Mission Control' }

export default async function AdminRevenuePage() {
  await requireAdmin({ path: '/admin/revenue' })

  const current = MOCK_ADMIN_REVENUE[MOCK_ADMIN_REVENUE.length - 1]
  const prior   = MOCK_ADMIN_REVENUE[MOCK_ADMIN_REVENUE.length - 2]
  const setupDelta   = current.setup_usd   - prior.setup_usd
  const monthlyDelta = current.monthly_usd - prior.monthly_usd
  const subDelta     = current.active_subs - prior.active_subs

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/admin/mission-control" className="text-[12px] text-[#6a6a6e] hover:text-white flex items-center gap-1.5 mb-1">
          <ArrowLeft size={12} /> Back to Mission Control
        </Link>
        <h1 className="text-[22px] font-semibold">Revenue</h1>
        <p className="text-[13.5px] text-[#9a9a9d]">
          Setup fees, monthly retainer income, and active subscription counts. Live Stripe data still flows through{' '}
          <Link href="/dashboard/settings/billing" className="text-[#ffae3c] hover:underline">/dashboard/settings/billing</Link>.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card label="Setup revenue (MTD)" value={`$${current.setup_usd.toLocaleString()}`} delta={`${setupDelta >= 0 ? '+' : ''}$${setupDelta.toLocaleString()} vs prior month`} tone={setupDelta >= 0 ? 'success' : 'warning'} />
        <Card label="Monthly retainer (MTD)" value={`$${current.monthly_usd.toLocaleString()}`} delta={`${monthlyDelta >= 0 ? '+' : ''}$${monthlyDelta.toLocaleString()} vs prior month`} tone={monthlyDelta >= 0 ? 'success' : 'warning'} />
        <Card label="Active subscriptions" value={String(current.active_subs)} delta={`${subDelta >= 0 ? '+' : ''}${subDelta} vs prior month`} tone={subDelta >= 0 ? 'success' : 'warning'} />
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/60 overflow-hidden">
        <table className="w-full text-[13.5px]">
          <thead className="bg-white/[0.02] text-[11px] uppercase tracking-[0.08em] text-[#6a6a6e]">
            <tr>
              <th className="text-left px-5 py-3">Month</th>
              <th className="text-right px-5 py-3">Setup ($)</th>
              <th className="text-right px-5 py-3">Monthly ($)</th>
              <th className="text-right px-5 py-3">Active subs</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_ADMIN_REVENUE.slice().reverse().map((r) => (
              <tr key={r.month} className="border-t border-white/[0.04]">
                <td className="px-5 py-3 text-white">{r.month}</td>
                <td className="px-5 py-3 text-right font-mono text-white">${r.setup_usd.toLocaleString()}</td>
                <td className="px-5 py-3 text-right font-mono text-white">${r.monthly_usd.toLocaleString()}</td>
                <td className="px-5 py-3 text-right font-mono text-[#9a9a9d]">{r.active_subs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <LegacyNote href="/dashboard/settings/billing" label="Open legacy billing dashboard"
        note="Live Stripe revenue data is currently surfaced through the legacy billing settings." />
    </div>
  )
}

function Card({ label, value, delta, tone }: { label: string; value: string; delta: string; tone: 'success' | 'warning' }) {
  const border = tone === 'success' ? 'border-[#22d093]/25 bg-[#22d093]/[0.05]' : 'border-[#ffae3c]/25 bg-[#ffae3c]/[0.05]'
  const text   = tone === 'success' ? 'text-[#22d093]' : 'text-[#ffae3c]'
  return (
    <div className={`rounded-2xl border p-4 ${border}`}>
      <div className="text-[11px] uppercase tracking-[0.08em] text-[#6a6a6e]">{label}</div>
      <div className="text-[26px] font-semibold mt-1 text-white">{value}</div>
      <div className={`text-[11.5px] mt-0.5 ${text}`}>{delta}</div>
    </div>
  )
}
