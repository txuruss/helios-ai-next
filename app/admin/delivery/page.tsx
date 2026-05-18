import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/require-admin'
import { MOCK_DELIVERY } from '@/lib/data/mock-team'
import LegacyNote from '@/components/admin/LegacyNote'
import { ArrowLeft } from 'lucide-react'

export const metadata = { title: 'Delivery — Mission Control' }

export default async function AdminDeliveryPage() {
  await requireAdmin({ path: '/admin/delivery' })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/admin/mission-control" className="text-[12px] text-[#6a6a6e] hover:text-white flex items-center gap-1.5 mb-1">
          <ArrowLeft size={12} /> Back to Mission Control
        </Link>
        <h1 className="text-[22px] font-semibold">Delivery</h1>
        <p className="text-[13.5px] text-[#9a9a9d]">Active client builds, launches, and optimization cycles.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {MOCK_DELIVERY.map((p) => (
          <div key={p.id} className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/60 p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[15px] font-semibold">{p.business}</div>
                <div className="text-[12px] text-[#6a6a6e] capitalize">Stage: {p.stage}</div>
              </div>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border border-[#ff7a18]/30 bg-[#ff7a18]/[0.08] text-[#ffae3c]">
                {p.progress}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#ff7a18] to-[#ffae3c]" style={{ width: `${p.progress}%` }} />
            </div>
            <div className="flex justify-between text-[12px] text-[#9a9a9d]">
              <span>Owner: {p.owner}</span>
              <span>Due {p.due_date}</span>
            </div>
          </div>
        ))}
      </div>

      <LegacyNote href="/dashboard/delivery" label="Open legacy delivery tracker" />
    </div>
  )
}
