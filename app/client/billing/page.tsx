import { requireClient } from '@/lib/auth/require-client'
import PlanGate from '@/components/client-portal/PlanGate'
import Link from 'next/link'
import { clientPlanLabel } from '@/lib/plans/plan-access'

export default async function ClientBillingPage() {
  const session = await requireClient({ redirectFrom: '/client/billing' })

  return (
    <PlanGate plan={session.plan} feature="billing">
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-[22px] font-semibold">Billing</h1>
          <p className="text-[13.5px] text-[#9a9a9d]">
            Manage your subscription, view invoices, and upgrade your plan.
          </p>
        </header>

        <div className="rounded-2xl border border-[#ff7a18]/25 bg-[#ff7a18]/[0.04] p-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.14em] text-[#ffae3c]">Current plan</div>
              <div className="text-[22px] font-semibold mt-1">{clientPlanLabel(session.plan)}</div>
            </div>
            <Link href="/dashboard/settings/billing" className="btn-primary">Manage subscription</Link>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5 text-[13.5px] text-[#9a9a9d]">
          Need to switch plans, update payment, or download invoices?
          {' '}
          <Link href="/dashboard/settings/billing" className="text-[#ffae3c] hover:underline">Open billing dashboard →</Link>
        </div>
      </div>
    </PlanGate>
  )
}
