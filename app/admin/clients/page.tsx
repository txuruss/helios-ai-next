import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/require-admin'
import { MOCK_BUSINESSES } from '@/lib/data/mock-businesses'
import LegacyNote from '@/components/admin/LegacyNote'
import { ArrowLeft } from 'lucide-react'

export const metadata = { title: 'Clients — Mission Control' }

export default async function AdminClientsPage() {
  await requireAdmin({ path: '/admin/clients' })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/admin/mission-control" className="text-[12px] text-[#6a6a6e] hover:text-white flex items-center gap-1.5 mb-1">
          <ArrowLeft size={12} /> Back to Mission Control
        </Link>
        <h1 className="text-[22px] font-semibold">Clients</h1>
        <p className="text-[13.5px] text-[#9a9a9d]">Active Helios AI clients across all plans.</p>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/60 overflow-hidden">
        <table className="w-full text-[13.5px]">
          <thead className="bg-white/[0.02] text-[11px] uppercase tracking-[0.08em] text-[#6a6a6e]">
            <tr>
              <th className="text-left px-5 py-3">Business</th>
              <th className="text-left px-5 py-3">Industry</th>
              <th className="text-left px-5 py-3">City</th>
              <th className="text-left px-5 py-3">Plan</th>
              <th className="text-right px-5 py-3">Leads (mo)</th>
              <th className="text-right px-5 py-3">Bookings (mo)</th>
              <th className="text-right px-5 py-3">Since</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_BUSINESSES.map((b) => (
              <tr key={b.id} className="border-t border-white/[0.04]">
                <td className="px-5 py-3 text-white">{b.name}</td>
                <td className="px-5 py-3 text-[#9a9a9d]">{b.industry}</td>
                <td className="px-5 py-3 text-[#9a9a9d]">{b.city}</td>
                <td className="px-5 py-3 text-[#9a9a9d] capitalize">{b.plan}</td>
                <td className="px-5 py-3 text-right font-mono text-white">{b.monthly_leads}</td>
                <td className="px-5 py-3 text-right font-mono text-white">{b.monthly_bookings}</td>
                <td className="px-5 py-3 text-right text-[12px] text-[#6a6a6e]">{new Date(b.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <LegacyNote href="/dashboard/business" label="Open legacy business workspace" />
    </div>
  )
}
