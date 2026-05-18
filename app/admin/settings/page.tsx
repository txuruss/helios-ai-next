import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/require-admin'
import { ArrowLeft } from 'lucide-react'

export const metadata = { title: 'Settings — Mission Control' }

export default async function AdminSettingsPage() {
  const session = await requireAdmin({ path: '/admin/settings' })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/admin/mission-control" className="text-[12px] text-[#6a6a6e] hover:text-white flex items-center gap-1.5 mb-1">
          <ArrowLeft size={12} /> Back to Mission Control
        </Link>
        <h1 className="text-[22px] font-semibold">Admin Settings</h1>
        <p className="text-[13.5px] text-[#9a9a9d]">Founder profile, role state, and integration endpoints.</p>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/60 p-6 flex flex-col gap-3">
        <Row label="Team member ID" value={session.teamMemberId} mono />
        <Row label="Account email"  value={session.email} />
        <Row label="Display name"   value={session.fullName ?? '—'} />
        <Row label="Role"           value={session.role} />
      </div>

      <div className="rounded-2xl border border-[#ff7a18]/25 bg-[#ff7a18]/[0.04] p-5 text-[13px] text-[#9a9a9d]">
        <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ffae3c] mb-2">Founder bootstrap</div>
        Until the production <code className="font-mono text-[12px] px-1 py-0.5 rounded bg-white/[0.04]">team_members</code> table is seeded with a row where
        <code className="font-mono text-[12px] px-1 py-0.5 rounded bg-white/[0.04]">role = &apos;founder_admin&apos;</code>, /admin/* is reachable only in development with
        <code className="font-mono text-[12px] px-1 py-0.5 rounded bg-white/[0.04]">HELIOS_ENABLE_MOCK_AUTH=true</code>. See <code>lib/auth/require-admin.ts</code> for the exact insert statement.
      </div>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 py-2 border-b border-white/[0.04] last:border-b-0">
      <span className="text-[12px] uppercase tracking-[0.08em] text-[#6a6a6e]">{label}</span>
      <span className={`text-[14px] text-white ${mono ? 'font-mono text-[12px]' : ''}`}>{value}</span>
    </div>
  )
}
