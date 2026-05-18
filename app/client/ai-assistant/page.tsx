import { requireClient } from '@/lib/auth/require-client'
import PlanGate from '@/components/client-portal/PlanGate'

export default async function ClientAIAssistantPage() {
  const session = await requireClient({ redirectFrom: '/client/ai-assistant' })

  return (
    <PlanGate plan={session.plan} feature="ai_assistant_status">
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-[22px] font-semibold">AI Assistant</h1>
          <p className="text-[13.5px] text-[#9a9a9d]">
            Your AI is replying to customers on your behalf. See its status and what it is saying.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <StatusCard label="Status" value="Active" tone="success" />
          <StatusCard label="Today" value="0 replies" tone="neutral" />
          <StatusCard label="Mode" value="Auto-reply" tone="neutral" />
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0f1012]/60 p-6">
          <h3 className="text-[15px] font-semibold mb-2">What your AI knows</h3>
          <p className="text-[13.5px] text-[#9a9a9d]">
            Your AI replies based on your business profile, services, hours, and FAQs.
            To update what it knows, edit your <a href="/client/business-profile" className="text-[#ffae3c] hover:underline">business profile</a>
            {session.plan === 'pro' || session.plan === 'scale' ? (
              <> or your <a href="/client/knowledge-base" className="text-[#ffae3c] hover:underline">knowledge base</a></>
            ) : null}.
          </p>
        </div>
      </div>
    </PlanGate>
  )
}

function StatusCard({ label, value, tone }: { label: string; value: string; tone: 'success' | 'neutral' }) {
  const colors = tone === 'success'
    ? 'border-[#22d093]/25 bg-[#22d093]/[0.05] text-[#22d093]'
    : 'border-white/[0.08] bg-[#0f1012]/60 text-white'
  return (
    <div className={`rounded-2xl border p-4 ${colors}`}>
      <div className="text-[11px] uppercase tracking-[0.08em] text-[#6a6a6e]">{label}</div>
      <div className="text-[20px] font-semibold mt-1">{value}</div>
    </div>
  )
}
