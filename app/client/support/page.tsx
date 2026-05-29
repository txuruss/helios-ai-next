import { requireClient } from '@/lib/auth/require-client'
import PlanGate from '@/components/client-portal/PlanGate'

export default async function ClientSupportPage() {
  const session = await requireClient({ redirectFrom: '/client/support' })

  return (
    <PlanGate plan={session.plan} feature="support">
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-[22px] font-semibold">Support</h1>
          <p className="text-[13.5px] text-[#9a9a9d]">
            Need help? Open a ticket with the Helios AI team.
          </p>
        </header>

        <div className="rounded-2xl border border-white/10 bg-[#0f1012]/60 p-6 flex flex-col gap-3">
          <div className="text-[15px] font-semibold">Email us</div>
          <p className="text-[13.5px] text-[#9a9a9d]">
            We reply within one business day. For urgent issues, mark your email with <span className="text-white">[URGENT]</span>.
          </p>
          <a href="mailto:hello@heliosai.agency" className="btn-primary self-start">Email hello@heliosai.agency</a>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5 text-[13.5px] text-[#9a9a9d]">
          Looking for setup help? Visit your <a href="/dashboard/setup" className="text-[#ffae3c] hover:underline">setup guide</a>.
        </div>
      </div>
    </PlanGate>
  )
}
