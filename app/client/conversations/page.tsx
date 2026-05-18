import { requireClient } from '@/lib/auth/require-client'
import PlanGate from '@/components/client-portal/PlanGate'

export default async function ClientConversationsPage() {
  const session = await requireClient({ redirectFrom: '/client/conversations' })

  return (
    <PlanGate plan={session.plan} feature="conversation_review">
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-[22px] font-semibold">Conversations</h1>
          <p className="text-[13.5px] text-[#9a9a9d]">
            Every conversation your AI has had with customers across website chat and WhatsApp.
          </p>
        </header>

        <div className="rounded-2xl border border-white/10 bg-[#0f1012]/60 p-10 text-center">
          <div className="text-[15px] text-white">No conversations yet</div>
          <p className="text-[13px] text-[#9a9a9d] mt-2 max-w-[460px] mx-auto">
            When your customers chat with the AI, transcripts appear here. You can review, label, or take over manually.
          </p>
        </div>
      </div>
    </PlanGate>
  )
}
