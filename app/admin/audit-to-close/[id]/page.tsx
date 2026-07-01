import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Crosshair } from 'lucide-react'
import { requireAdmin } from '@/lib/auth/require-admin'
import { getAtcLeadDetail } from '@/lib/data/atc-leads'
import { getTeamMembers } from '@/lib/data/admin-team'
import AtcDetailClient from './AtcDetailClient'

export const metadata = { title: 'Lead — Audit-to-Close' }

export default async function AtcLeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await requireAdmin({ path: '/admin/audit-to-close' })
  const { id } = await params

  // Scoped read: an agent requesting another agent's lead id gets a 404 —
  // the same as a lead that does not exist (no existence leak).
  const detail = await getAtcLeadDetail(session, id)
  if (!detail) notFound()

  const isFounder = session.role === 'founder_admin'

  // Assignment options (founder only — getTeamMembers gates on founder).
  let members: Array<{ id: string; label: string }> = []
  if (isFounder) {
    const roster = await getTeamMembers()
    members = roster.rows
      .filter((m) => m.status === 'active')
      .map((m) => ({ id: m.id, label: m.full_name ?? m.email }))
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1.5">
        <Link
          href="/admin/audit-to-close"
          className="text-[12px] text-[#6a6a6e] hover:text-[#ffae3c] flex items-center gap-1.5 mb-1 w-fit transition-colors"
        >
          <ArrowLeft size={12} /> Back to Audit-to-Close
        </Link>
        <h1 className="text-[24px] font-bold tracking-tight text-white flex items-center gap-2">
          <Crosshair size={20} className="text-[#ff7a18]" /> {detail.lead.business_name}
        </h1>
        <p className="text-[13.5px] text-[#9a9a9d]">
          {[detail.lead.industry, detail.lead.location].filter(Boolean).join(' · ') || 'Audit-to-Close lead'}
        </p>
      </header>

      <AtcDetailClient detail={detail} isFounder={isFounder} members={members} />
    </div>
  )
}
