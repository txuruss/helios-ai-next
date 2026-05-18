import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/require-admin'
import { MOCK_ADMIN_CALLS } from '@/lib/data/mock-admin'
import LegacyNote from '@/components/admin/LegacyNote'
import { ArrowLeft } from 'lucide-react'

export const metadata = { title: 'Bookings — Mission Control' }

const STATUS_TONE: Record<string, string> = {
  upcoming: '#3b9eff', completed: '#22d093', no_show: '#ff8a7a',
}

export default async function AdminBookingsPage() {
  await requireAdmin({ path: '/admin/bookings' })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/admin/mission-control" className="text-[12px] text-[#6a6a6e] hover:text-white flex items-center gap-1.5 mb-1">
          <ArrowLeft size={12} /> Back to Mission Control
        </Link>
        <h1 className="text-[22px] font-semibold">Bookings & Calls</h1>
        <p className="text-[13.5px] text-[#9a9a9d]">
          Strategy calls scheduled with prospects and existing clients. Cal.com + manual bookings combined.
        </p>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/60 overflow-hidden">
        <table className="w-full text-[13.5px]">
          <thead className="bg-white/[0.02] text-[11px] uppercase tracking-[0.08em] text-[#6a6a6e]">
            <tr>
              <th className="text-left px-5 py-3">Contact</th>
              <th className="text-left px-5 py-3">Business</th>
              <th className="text-left px-5 py-3">Channel</th>
              <th className="text-left px-5 py-3">Status</th>
              <th className="text-right px-5 py-3">Scheduled</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_ADMIN_CALLS.map((c) => {
              const color = STATUS_TONE[c.status]
              return (
                <tr key={c.id} className="border-t border-white/[0.04]">
                  <td className="px-5 py-3 text-white">{c.contact}</td>
                  <td className="px-5 py-3 text-[#9a9a9d]">{c.business}</td>
                  <td className="px-5 py-3 text-[#9a9a9d]">{c.channel}</td>
                  <td className="px-5 py-3">
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border capitalize"
                      style={{ color, borderColor: `${color}40`, background: `${color}12` }}>
                      {c.status.replaceAll('_', ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right text-[12px] text-[#9a9a9d]">{new Date(c.scheduled_at).toLocaleString()}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <LegacyNote href="/dashboard/bookings" label="Open legacy bookings workspace" />
    </div>
  )
}
