import { requireClient } from '@/lib/auth/require-client'
import PlanGate from '@/components/client-portal/PlanGate'
import Link from 'next/link'

export default async function ClientBookingsPage() {
  const session = await requireClient({ redirectFrom: '/client/bookings' })

  return (
    <PlanGate plan={session.plan} feature="booking_management">
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-[22px] font-semibold">Bookings</h1>
          <p className="text-[13.5px] text-[#9a9a9d]">
            All upcoming appointments captured by your AI booking system.
          </p>
        </header>

        <div className="rounded-2xl border border-white/10 bg-[#0f1012]/60 p-10 text-center flex flex-col items-center gap-3">
          <div className="text-[15px] text-white">No bookings yet</div>
          <p className="text-[13px] text-[#9a9a9d] max-w-[460px]">
            Once your AI captures a confirmed booking through Cal.com or your booking flow, it will appear here.
          </p>
          <Link href="/dashboard/bookings" className="btn-ghost mt-2">Manage in setup workspace</Link>
        </div>
      </div>
    </PlanGate>
  )
}
