import { requireClient } from '@/lib/auth/require-client'
import PlanGate from '@/components/client-portal/PlanGate'
import Link from 'next/link'

export default async function ClientLeadsPage() {
  const session = await requireClient({ redirectFrom: '/client/leads' })

  return (
    <PlanGate plan={session.plan} feature="basic_leads">
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-[22px] font-semibold">Leads</h1>
          <p className="text-[13.5px] text-[#9a9a9d]">
            Every customer who messages your business. Reach out before they pick a competitor.
          </p>
        </header>

        <div className="rounded-2xl border border-white/10 bg-[#0f1012]/60 p-10 text-center flex flex-col items-center gap-3">
          <div className="text-[15px] text-white">No leads yet</div>
          <p className="text-[13px] text-[#9a9a9d] max-w-[420px]">
            Once your AI assistant captures inquiries, they will show up here with name, contact, and the service they asked about.
          </p>
          <Link href="/client/ai-assistant" className="btn-ghost mt-2">Check AI status</Link>
        </div>
      </div>
    </PlanGate>
  )
}
