import { requireClient } from '@/lib/auth/require-client'
import PlanGate from '@/components/client-portal/PlanGate'
import Link from 'next/link'

export default async function ClientSettingsPage() {
  const session = await requireClient({ redirectFrom: '/client/settings' })

  return (
    <PlanGate plan={session.plan} feature="settings">
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-[22px] font-semibold">Settings</h1>
          <p className="text-[13.5px] text-[#9a9a9d]">
            Account, security, and notification preferences.
          </p>
        </header>

        <div className="rounded-2xl border border-white/10 bg-[#0f1012]/60 p-6 flex flex-col gap-4">
          <Row label="Account email" value={session.email} />
          <Row label="Display name"  value={session.fullName ?? '—'} />
          <Row label="Role"          value={session.role} />
          <Row label="Business ID"   value={session.businessId} mono />
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5 text-[13.5px] text-[#9a9a9d]">
          For password changes and account security, use the
          {' '}<Link href="/dashboard/settings" className="text-[#ffae3c] hover:underline">full settings page</Link>.
        </div>
      </div>
    </PlanGate>
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
