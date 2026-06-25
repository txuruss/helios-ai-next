import { requireClient } from '@/lib/auth/require-client'
import PlanGate from '@/components/client-portal/PlanGate'

export default async function ClientReportsPage() {
  const session = await requireClient({ redirectFrom: '/client/reports' })

  // Starter has 'basic_reports'; Booking OS has 'better_analytics'; Helios AIOS has 'advanced_analytics'.
  return (
    <PlanGate plan={session.plan} feature="basic_reports">
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-[22px] font-semibold">Reports</h1>
          <p className="text-[13.5px] text-[#9a9a9d]">
            Track conversations, leads, and booking conversions over time.
          </p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ReportCard label="Conversations (30d)" value="0" />
          <ReportCard label="Leads (30d)"         value="0" />
          <ReportCard label="Bookings (30d)"      value="0" />
        </div>

        {(session.plan === 'pro' || session.plan === 'scale') && (
          <div className="rounded-2xl border border-white/10 bg-[#0f1012]/60 p-6">
            <h3 className="text-[15px] font-semibold mb-2">Conversion funnel</h3>
            <p className="text-[13.5px] text-[#9a9a9d]">
              Detailed conversion funnel and source attribution charts will appear here as your data grows.
            </p>
          </div>
        )}

        {session.plan === 'scale' && (
          <div className="rounded-2xl border border-white/10 bg-[#0f1012]/60 p-6">
            <h3 className="text-[15px] font-semibold mb-2">Monthly insights</h3>
            <p className="text-[13.5px] text-[#9a9a9d]">
              Helios AIOS plan unlocks monthly insight emails and automation performance reports.
            </p>
          </div>
        )}
      </div>
    </PlanGate>
  )
}

function ReportCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/60 p-4">
      <div className="text-[11px] uppercase tracking-[0.08em] text-[#6a6a6e]">{label}</div>
      <div className="text-[28px] font-semibold mt-1 text-white">{value}</div>
    </div>
  )
}
