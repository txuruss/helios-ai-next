import Link from 'next/link'
import { ArrowLeft, Crosshair } from 'lucide-react'
import { requireAdmin } from '@/lib/auth/require-admin'
import { listAuthorizedLeads } from '@/lib/data/atc-leads'
import AtcPageClient from './AtcPageClient'

export const metadata = { title: 'Audit-to-Close — Mission Control' }

export default async function AuditToClosePage() {
  const session = await requireAdmin({ path: '/admin/audit-to-close' })
  const { rows, migrationNeeded, error } = await listAuthorizedLeads(session)

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1.5">
        <Link
          href="/admin/mission-control"
          className="text-[12px] text-[#6a6a6e] hover:text-[#ffae3c] flex items-center gap-1.5 mb-1 w-fit transition-colors"
        >
          <ArrowLeft size={12} /> Back to Mission Control
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-[24px] font-bold tracking-tight text-white flex items-center gap-2">
            <Crosshair size={20} className="text-[#ff7a18]" /> Audit-to-Close
          </h1>
          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.10em]
                           px-2.5 py-1 rounded-full border border-[#ff7a18]/30 bg-[#ff7a18]/[0.07] text-[#ffae3c]">
            Drafts only — nothing auto-sends
          </span>
        </div>
        <p className="text-[13.5px] text-[#9a9a9d]">
          Turn a local service business into a qualified lead: audit → pain points → qualification → offer → outreach drafts.
        </p>
      </header>

      {migrationNeeded && (
        <div className="rounded-xl border border-[#ffae3c]/30 bg-[#ffae3c]/[0.05] px-4 py-2.5 text-[12.5px] text-[#ffae3c]">
          Audit-to-Close is unavailable until migration{' '}
          <code className="font-mono text-[11.5px]">20260701120000_create_audit_to_close.sql</code> is applied in Supabase.
        </div>
      )}
      {error && !migrationNeeded && (
        <div className="rounded-xl border border-[#ffae3c]/30 bg-[#ffae3c]/[0.05] px-4 py-2.5 text-[12.5px] text-[#ffae3c]">
          {error}
        </div>
      )}

      <AtcPageClient leads={rows} viewAll={session.role === 'founder_admin'} />
    </div>
  )
}
