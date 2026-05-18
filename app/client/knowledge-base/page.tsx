import { requireClient } from '@/lib/auth/require-client'
import PlanGate from '@/components/client-portal/PlanGate'
import Link from 'next/link'

export default async function ClientKnowledgeBasePage() {
  const session = await requireClient({ redirectFrom: '/client/knowledge-base' })

  return (
    <PlanGate plan={session.plan} feature="faq_management">
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-[22px] font-semibold">Knowledge Base</h1>
          <p className="text-[13.5px] text-[#9a9a9d]">
            FAQs your AI uses when answering customer questions. Update these to teach the AI new things.
          </p>
        </header>

        <div className="rounded-2xl border border-white/10 bg-[#0f1012]/60 p-10 text-center flex flex-col items-center gap-3">
          <div className="text-[15px] text-white">No knowledge base entries yet</div>
          <p className="text-[13px] text-[#9a9a9d] max-w-[460px]">
            Add FAQs about pricing, hours, services, and policies so the AI can answer instantly.
          </p>
          <Link href="/dashboard/services" className="btn-ghost mt-2">Manage in setup workspace</Link>
        </div>
      </div>
    </PlanGate>
  )
}
