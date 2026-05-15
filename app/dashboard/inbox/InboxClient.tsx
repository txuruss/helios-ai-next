'use client'

import { useState, useTransition, useEffect } from 'react'
import { getConversations, getConversationThread } from '@/lib/actions/inbox'
import type { ConversationSummary, InboxFilter, InboxStats } from '@/lib/actions/inbox'
import type { HandoffStatus, WhatsAppMessage } from '@/types'
import { capture } from '@/lib/analytics/posthog'
import ConversationList           from './ConversationList'
import ConversationThread         from './ConversationThread'
import ConversationComposer       from './ConversationComposer'
import ConversationStatusControls from './ConversationStatusControls'
import AssignmentControl          from './AssignmentControl'
import InternalNotes              from './InternalNotes'

export type { InboxFilter, ConversationSummary }
export type { HandoffStatus, WhatsAppMessage }

export interface ThreadSession {
  id:                  string
  external_thread_id:  string | null
  handoff_status:      HandoffStatus
  priority:            string
  assigned_to:         string | null
  lead_id:             string | null
  internal_notes:      string | null
  updated_at:          string
}

interface Props {
  initialConversations: ConversationSummary[]
  initialStats:         InboxStats
  plan:                 string
  currentFilter:        string
  initialSelectedId:    string | null
  error:                string | null
}

export default function InboxClient({
  initialConversations,
  initialStats,
  plan,
  currentFilter: _initFilter,
  initialSelectedId,
  error,
}: Props) {
  const [filter,        setFilter]        = useState<InboxFilter>((_initFilter as InboxFilter) ?? 'all')
  const [conversations, setConversations] = useState(initialConversations)
  const [stats,         setStats]         = useState(initialStats)
  const [selectedId,    setSelectedId]    = useState<string | null>(initialSelectedId)
  const [thread,        setThread]        = useState<{ session: ThreadSession; messages: WhatsAppMessage[] } | null>(null)
  const [threadError,   setThreadError]   = useState<string | null>(null)

  const [convPending,   startConvTransition]   = useTransition()
  const [threadPending, startThreadTransition] = useTransition()

  useEffect(() => {
    capture('inbox_page_viewed', { plan })
  }, [plan])

  useEffect(() => {
    if (!selectedId) { setThread(null); return }
    setThreadError(null)
    startThreadTransition(async () => {
      const result = await getConversationThread(selectedId)
      if (result.error) { setThreadError(result.error); return }
      if (result.session) {
        setThread({
          session:  result.session as ThreadSession,
          messages: result.messages as WhatsAppMessage[],
        })
      }
    })
  }, [selectedId])

  const loadConversations = (f: InboxFilter = filter) => {
    startConvTransition(async () => {
      const result = await getConversations(f)
      if (!result.error) {
        setConversations(result.conversations)
        setStats(result.stats)
      }
    })
  }

  const handleFilterChange = (f: InboxFilter) => {
    setFilter(f)
    setSelectedId(null)
    setThread(null)
    loadConversations(f)
  }

  const handleThreadRefresh = () => {
    if (!selectedId) return
    startThreadTransition(async () => {
      const result = await getConversationThread(selectedId)
      if (result.session) {
        setThread({
          session:  result.session as ThreadSession,
          messages: result.messages as WhatsAppMessage[],
        })
      }
    })
    loadConversations()
  }

  const statsRecord: Record<string, number> = {
    all:             stats.all,
    ai:              stats.ai,
    human_requested: stats.human_requested,
    human:           stats.human,
    resolved:        stats.resolved,
    archived:        stats.archived,
  }

  return (
    <div className="flex h-full">
      {/* Left panel — 280px conversation list */}
      <div className="w-[280px] shrink-0 flex flex-col bg-[#0a0b0d]">
        <ConversationList
          conversations={conversations}
          selectedId={selectedId}
          onSelect={setSelectedId}
          currentFilter={filter}
          onFilterChange={handleFilterChange}
          stats={statsRecord}
        />
        {convPending && (
          <div className="px-4 py-2 text-[11px] text-[#6a6a6e]">Refreshing…</div>
        )}
      </div>

      {/* Right panel */}
      {!selectedId ? (
        <div className="flex-1 flex items-center justify-center bg-[#080809]">
          {error ? (
            <p className="text-[13px] text-[#ff8a7a]">{error}</p>
          ) : (
            <div className="flex flex-col items-center gap-3 text-center max-w-xs">
              <span className="text-[32px]">💬</span>
              <p className="text-[14px] font-medium text-white">Select a conversation</p>
              <p className="text-[12px] text-[#6a6a6e]">
                Choose a WhatsApp conversation from the left to view messages and manage handoff.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden bg-[#080809]">
          {/* Thread column */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {threadPending && !thread ? (
              <div className="flex-1 flex items-center justify-center">
                <span className="text-[12px] text-[#6a6a6e]">Loading…</span>
              </div>
            ) : threadError ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-[12px] text-[#ff8a7a]">{threadError}</p>
              </div>
            ) : thread ? (
              <>
                <div className="flex-1 overflow-hidden">
                  <ConversationThread session={thread.session} messages={thread.messages} />
                </div>
                <ConversationComposer sessionId={selectedId} plan={plan} onSent={handleThreadRefresh} />
              </>
            ) : null}
          </div>

          {/* Controls sidebar */}
          {thread && (
            <div className="w-[240px] shrink-0 border-l border-white/[0.06] flex flex-col gap-5 px-4 py-4 overflow-y-auto">
              <ConversationStatusControls
                sessionId={selectedId}
                currentStatus={thread.session.handoff_status}
                onUpdated={handleThreadRefresh}
              />
              <div className="border-t border-white/[0.06] pt-4">
                <AssignmentControl
                  sessionId={selectedId}
                  assignedTo={thread.session.assigned_to}
                  onAssigned={handleThreadRefresh}
                />
              </div>
              {thread.session.lead_id && (
                <div className="border-t border-white/[0.06] pt-4">
                  <p className="text-[10.5px] font-semibold text-[#6a6a6e] uppercase tracking-[0.12em] mb-1.5">Lead</p>
                  <a href="/dashboard/leads" className="text-[12px] text-[#ffae3c] hover:underline">
                    View lead →
                  </a>
                </div>
              )}
              <div className="border-t border-white/[0.06] pt-4">
                <InternalNotes sessionId={selectedId} onNoteAdded={handleThreadRefresh} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
