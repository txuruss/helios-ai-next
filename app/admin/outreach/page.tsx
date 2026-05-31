import Link from 'next/link'
import { ArrowLeft, Megaphone } from 'lucide-react'
import { requireAdmin } from '@/lib/auth/require-admin'
import { getAdminOutreachLeads, getOutreachDailyReview } from '@/lib/data/admin-outreach'
import OutreachPageClient from './OutreachPageClient'

export const metadata = { title: 'Outreach — Mission Control' }

export default async function AdminOutreachPage() {
  await requireAdmin({ path: '/admin/outreach' })

  const today = new Date().toISOString().slice(0, 10)
  const [{ rows, migrationNeeded, error }, review] = await Promise.all([
    getAdminOutreachLeads(),
    getOutreachDailyReview(today),
  ])

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <header className="flex flex-col gap-1.5">
        <Link
          href="/admin/mission-control"
          className="text-[12px] text-[#6a6a6e] hover:text-[#ffae3c] flex items-center gap-1.5 mb-1 w-fit transition-colors"
        >
          <ArrowLeft size={12} /> Back to Mission Control
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-[24px] font-bold tracking-tight text-white flex items-center gap-2">
            <Megaphone size={20} className="text-[#ff7a18]" /> Client Outreach
          </h1>
          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.10em]
                           px-2.5 py-1 rounded-full border border-[#ff7a18]/30 bg-[#ff7a18]/[0.07] text-[#ffae3c]">
            Manual outreach
          </span>
        </div>
        <p className="text-[13.5px] text-[#9a9a9d]">
          Find, score, contact, and follow up with local service businesses.
        </p>
      </header>

      {migrationNeeded && (
        <div className="rounded-xl border border-[#ffae3c]/30 bg-[#ffae3c]/[0.05] px-4 py-2.5 text-[12.5px] text-[#ffae3c]">
          Outreach tracking is unavailable until migration{' '}
          <code className="font-mono text-[11.5px]">20260605120000_create_admin_outreach.sql</code> is applied in Supabase.
          The dashboard, scripts, and follow-up tools below still work — leads just won&apos;t save yet.
        </div>
      )}
      {error && !migrationNeeded && (
        <div className="rounded-xl border border-[#ffae3c]/30 bg-[#ffae3c]/[0.05] px-4 py-2.5 text-[12.5px] text-[#ffae3c]">
          {error}
        </div>
      )}

      <OutreachPageClient leads={rows} initialReview={review} reviewDate={today} />
    </div>
  )
}
