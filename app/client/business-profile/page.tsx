import Link from 'next/link'
import { requireClient } from '@/lib/auth/require-client'
import PlanGate from '@/components/client-portal/PlanGate'

export default async function ClientBusinessProfilePage() {
  const session = await requireClient({ redirectFrom: '/client/business-profile' })

  return (
    <PlanGate plan={session.plan} feature="business_profile">
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-[22px] font-semibold">Business Profile</h1>
          <p className="text-[13.5px] text-[#9a9a9d]">
            Keep your business details accurate so the AI assistant gives correct answers.
          </p>
        </header>

        <div className="rounded-2xl border border-white/10 bg-[#0f1012]/60 p-6 flex flex-col gap-4">
          <Row label="Business name"  value={session.businessName} />
          <Row label="Plan"            value={session.plan} />
          <Row label="Account email"   value={session.email} />
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5 text-[13.5px] text-[#9a9a9d]">
          To edit your business details (hours, services, contact info), use the full setup workspace.
          <Link href="/dashboard/business" className="ml-1 text-[#ffae3c] hover:underline">Open business setup →</Link>
        </div>
      </div>
    </PlanGate>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 py-2 border-b border-white/[0.04] last:border-b-0">
      <span className="text-[12px] uppercase tracking-[0.08em] text-[#6a6a6e]">{label}</span>
      <span className="text-[14px] text-white">{value}</span>
    </div>
  )
}
