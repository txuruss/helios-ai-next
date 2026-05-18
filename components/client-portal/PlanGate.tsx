import Link from 'next/link'
import { Lock } from 'lucide-react'
import {
  planAllowsFeature,
  planUpgradeLabel,
  clientPlanLabel,
  type ClientPlan,
  type ClientFeature,
} from '@/lib/plans/plan-access'

interface Props {
  plan:     ClientPlan
  feature:  ClientFeature
  children: React.ReactNode
}

// Server component — wrap any plan-locked client portal page in this.
export default function PlanGate({ plan, feature, children }: Props) {
  if (planAllowsFeature(plan, feature)) {
    return <>{children}</>
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0f1012]/60 p-10 flex flex-col items-center gap-5 text-center">
      <div className="w-12 h-12 rounded-full border border-[#ff7a18]/30 bg-[#ff7a18]/[0.10] flex items-center justify-center text-[#ffae3c]">
        <Lock size={18} />
      </div>
      <div className="flex flex-col gap-2 max-w-[460px]">
        <h2 className="text-[20px] font-semibold">This feature requires a plan upgrade</h2>
        <p className="text-[14px] text-[#9a9a9d]">
          You are currently on the <span className="text-white">{clientPlanLabel(plan)}</span> plan.
          {' '}{planUpgradeLabel(feature)}.
        </p>
      </div>
      <div className="flex gap-3">
        <Link href="/client/billing" className="btn-primary">View plans</Link>
        <Link href="/client/dashboard" className="btn-ghost">Back to dashboard</Link>
      </div>
    </div>
  )
}
