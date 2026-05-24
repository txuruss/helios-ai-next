import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/require-admin'
import LeadsPageClient from './LeadsPageClient'
import { ArrowLeft } from 'lucide-react'

export const metadata = { title: 'Leads — Mission Control' }

export default async function AdminLeadsPage() {
  await requireAdmin({ path: '/admin/leads' })

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
          <h1 className="text-[24px] font-bold tracking-tight text-white">Leads Pipeline</h1>
          <span className="text-[9.5px] font-medium uppercase tracking-[0.08em]
                           px-2 py-0.5 rounded-full border border-white/[0.10] bg-white/[0.03] text-[#6a6a6e]">
            Pipeline
          </span>
        </div>
        <p className="text-[13px] text-[#9a9a9d]">
          Founder view of inbound and outbound lead opportunities across all stages.
        </p>
      </header>

      <LeadsPageClient deals={[]} />

    </div>
  )
}
