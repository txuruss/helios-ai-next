import { getConversations, getInboxStats } from '@/lib/actions/inbox'
import InboxClient from './InboxClient'

export const metadata = { title: 'Inbox — Helios AI' }

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; session?: string }>
}) {
  const { filter: rawFilter, session: selectedSessionId } = await searchParams
  const filter = (['all', 'ai', 'human_requested', 'human', 'resolved', 'archived'].includes(rawFilter ?? ''))
    ? (rawFilter as 'all' | 'ai' | 'human_requested' | 'human' | 'resolved' | 'archived')
    : 'all'

  const [{ conversations, stats, plan, error: convErr }] = await Promise.all([
    getConversations(filter),
  ])

  // Upgrade gate
  if (convErr === 'Inbox requires the Pro plan.') {
    return (
      <div className="flex flex-col gap-8 max-w-2xl">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-white">Inbox</h1>
          <p className="text-[13px] text-[#6a6a6e] mt-1">WhatsApp conversation management</p>
        </div>
        <div className="rounded-2xl border border-[#ff7a18]/20 bg-[#ff7a18]/[0.06] p-8 flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 rounded-xl bg-[#ff7a18]/10 flex items-center justify-center text-[24px]">💬</div>
          <div>
            <p className="text-[15px] font-semibold text-white">Inbox requires Pro</p>
            <p className="text-[13px] text-[#9a9a9d] mt-1 max-w-sm">
              Upgrade to the Pro plan to manage WhatsApp conversations, assign agents, and handle human handoff.
            </p>
          </div>
          <a
            href="/dashboard/settings/billing"
            className="mt-2 px-5 py-2.5 rounded-[10px] bg-gradient-to-b from-[#ff8a2a] to-[#ee6a0c] text-[#1a0c00] text-[13px] font-semibold hover:opacity-90 transition-opacity"
          >
            Upgrade to Pro →
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0 h-[calc(100vh-4rem)] -mt-6 -mx-6">
      <InboxClient
        initialConversations={conversations}
        initialStats={stats}
        plan={plan}
        currentFilter={filter}
        initialSelectedId={selectedSessionId ?? null}
        error={convErr}
      />
    </div>
  )
}
