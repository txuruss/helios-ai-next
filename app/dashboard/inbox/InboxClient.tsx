'use client'

import { useState, useTransition, useEffect, useCallback } from 'react'
import { createClient }             from '@/lib/supabase/client'
import {
  getConversations,
  getConversationThread,
  markConversationRead,
  bulkUpdateConversations,
}                                   from '@/lib/actions/inbox'
import type { ConversationSummary, InboxFilter, InboxStats, BulkAction, ThreadSession } from '@/lib/actions/inbox'
import type { HandoffStatus, WhatsAppMessage }                                           from '@/types'
import { capture }                  from '@/lib/analytics/posthog'
import ConversationList             from './ConversationList'
import ConversationThread           from './ConversationThread'
import ConversationComposer         from './ConversationComposer'
import ConversationStatusControls   from './ConversationStatusControls'
import AssignmentControl            from './AssignmentControl'
import InternalNotes                from './InternalNotes'

export type { InboxFilter, ConversationSummary, InboxStats, BulkAction, ThreadSession }
export type { HandoffStatus, WhatsAppMessage }

// ── Priority sort ─────────────────────────────────────────────────

const PRIORITY_ORDER: Record<string, number> = { urgent: 3, high: 2, normal: 1, low: 0 }
const HANDOFF_URGENCY: Record<string, number> = { human_requested: 1, human: 0, ai: 0, resolved: 0, archived: 0 }

function sortConversations(convs: ConversationSummary[]): ConversationSummary[] {
  return [...convs].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 1
    const pb = PRIORITY_ORDER[b.priority] ?? 1
    if (pa !== pb) return pb - pa
    const ha = HANDOFF_URGENCY[a.handoff_status] ?? 0
    const hb = HANDOFF_URGENCY[b.handoff_status] ?? 0
    if (ha !== hb) return hb - ha
    const ta = a.last_message_at ?? a.updated_at
    const tb = b.last_message_at ?? b.updated_at
    return new Date(tb).getTime() - new Date(ta).getTime()
  })
}

// ── Props ─────────────────────────────────────────────────────────

interface Props {
  initialConversations: ConversationSummary[]
  initialStats:         InboxStats
  plan:                 string
  businessId:           string | null
  currentFilter:        string
  initialSelectedId:    string | null
  error:                string | null
}

export default function InboxClient({
  initialConversations,
  initialStats,
  plan,
  businessId,
  currentFilter: _initFilter,
  initialSelectedId,
  error,
}: Props) {
  const [filter,         setFilter]        = useState<InboxFilter>((_initFilter as InboxFilter) ?? 'all')
  const [conversations,  setConversations] = useState(() => sortConversations(initialConversations))
  const [stats,          setStats]         = useState(initialStats)
  const [selectedId,     setSelectedId]    = useState<string | null>(initialSelectedId)
  const [thread,         setThread]        = useState<{ session: ThreadSession; messages: WhatsAppMessage[] } | null>(null)
  const [threadError,    setThreadError]   = useState<string | null>(null)
  const [rtConnected,    setRtConnected]   = useState(false)
  const [selectedConvIds, setSelectedConvIds] = useState<Set<string>>(new Set())
  const [bulkError,      setBulkError]     = useState<string | null>(null)

  const [convPending,    startConvTransition]   = useTransition()
  const [threadPending,  startThreadTransition] = useTransition()
  const [bulkPending,    startBulkTransition]   = useTransition()

  // ── Page view analytics ───────────────────────────────────────────
  useEffect(() => {
    capture('inbox_page_viewed', { plan })
  }, [plan])

  // ── Supabase Realtime subscription ───────────────────────────────
  useEffect(() => {
    if (!businessId) return

    const supabase = createClient()

    // Subscribe to chat_sessions changes for this business
    const sessionsChannel = supabase
      .channel(`inbox-sessions-${businessId}`)
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'chat_sessions',
          filter: `business_id=eq.${businessId}`,
        },
        (payload) => {
          capture('inbox_message_received_live', { plan })
          const newRow = payload.new as ConversationSummary | null
          if (!newRow) return

          setConversations((prev) => {
            const updated = prev.map((c) =>
              c.id === newRow.id
                ? { ...c, ...newRow, last_message_preview: c.last_message_preview ?? newRow.last_message_preview }
                : c,
            )
            // If this is a new session not yet in list, add it
            const exists = prev.some((c) => c.id === newRow.id)
            const next   = exists ? updated : [newRow, ...prev]
            return sortConversations(next)
          })
        },
      )
      .subscribe((status) => {
        setRtConnected(status === 'SUBSCRIBED')
        if (status === 'SUBSCRIBED') capture('inbox_realtime_connected', { plan })
      })

    // Subscribe to new whatsapp_messages for this business
    const messagesChannel = supabase
      .channel(`inbox-messages-${businessId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'whatsapp_messages',
          filter: `business_id=eq.${businessId}`,
        },
        (payload) => {
          const msg = payload.new as WhatsAppMessage | null
          if (!msg) return

          // Append to open thread if this message belongs to selected conversation
          if (msg.chat_session_id === selectedId) {
            setThread((prev) =>
              prev ? { ...prev, messages: [...prev.messages, msg] } : prev,
            )
          }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(sessionsChannel)
      void supabase.removeChannel(messagesChannel)
    }
  }, [businessId, selectedId, plan])

  // ── Load thread on selection ──────────────────────────────────────
  useEffect(() => {
    if (!selectedId) { setThread(null); return }
    setThreadError(null)

    // Mark as read when opening
    void markConversationRead(selectedId).catch(() => undefined)
    // Update unread count in local state
    setConversations((prev) =>
      prev.map((c) => c.id === selectedId ? { ...c, unread_count: 0 } : c),
    )
    capture('conversation_opened', { session_id: selectedId.slice(0, 8) })
    capture('conversation_marked_read', {})

    startThreadTransition(async () => {
      const result = await getConversationThread(selectedId)
      if (result.error) { setThreadError(result.error); return }
      if (result.session) {
        setThread({ session: result.session, messages: result.messages as WhatsAppMessage[] })
      }
    })
  }, [selectedId])

  // ── Reload conversation list ──────────────────────────────────────
  const loadConversations = useCallback((f: InboxFilter = filter) => {
    startConvTransition(async () => {
      const result = await getConversations(f)
      if (!result.error) {
        setConversations(sortConversations(result.conversations))
        setStats(result.stats)
      }
    })
  }, [filter])

  const handleFilterChange = (f: InboxFilter) => {
    setFilter(f)
    setSelectedId(null)
    setThread(null)
    setSelectedConvIds(new Set())
    loadConversations(f)
  }

  const handleThreadRefresh = () => {
    if (!selectedId) return
    startThreadTransition(async () => {
      const result = await getConversationThread(selectedId)
      if (result.session) {
        setThread({ session: result.session, messages: result.messages as WhatsAppMessage[] })
      }
    })
    loadConversations()
  }

  // ── Bulk actions ──────────────────────────────────────────────────
  const handleBulkAction = (action: BulkAction) => {
    if (selectedConvIds.size === 0) return
    setBulkError(null)
    startBulkTransition(async () => {
      const ids    = Array.from(selectedConvIds)
      const result = await bulkUpdateConversations(ids, action)
      if (result.error) { setBulkError(result.error); return }
      setSelectedConvIds(new Set())
      capture(`conversation_bulk_${action}`, { count: ids.length, plan })
      loadConversations()
    })
  }

  const toggleConvSelected = (id: string) => {
    setSelectedConvIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
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
      {/* Left panel — conversation list */}
      <div className="w-[290px] shrink-0 flex flex-col bg-[#0a0b0d] border-r border-white/[0.06]">
        <ConversationList
          conversations={conversations}
          selectedId={selectedId}
          onSelect={setSelectedId}
          currentFilter={filter}
          onFilterChange={handleFilterChange}
          stats={statsRecord}
          selectedConvIds={selectedConvIds}
          onToggleSelect={toggleConvSelected}
          rtConnected={rtConnected}
        />

        {/* Bulk action bar */}
        {selectedConvIds.size > 0 && (
          <div className="border-t border-white/[0.06] bg-[#0c0d0f] px-3 py-3 flex flex-col gap-2">
            <p className="text-[11px] text-[#9a9a9d]">{selectedConvIds.size} selected</p>
            <div className="flex flex-wrap gap-1.5">
              {([
                { action: 'mark_read' as BulkAction, label: 'Mark Read' },
                { action: 'resolve'   as BulkAction, label: 'Resolve'   },
                { action: 'archive'   as BulkAction, label: 'Archive'   },
                { action: 'assign_to_me' as BulkAction, label: 'Assign to me' },
              ]).map(({ action, label }) => (
                <button
                  key={action}
                  onClick={() => handleBulkAction(action)}
                  disabled={bulkPending}
                  className="h-7 px-2.5 rounded-lg text-[11px] font-medium border border-white/[0.1]
                             bg-white/[0.04] text-[#9a9a9d] hover:bg-white/[0.08] transition-colors
                             disabled:opacity-40"
                >
                  {label}
                </button>
              ))}
              <button
                onClick={() => setSelectedConvIds(new Set())}
                className="h-7 px-2.5 rounded-lg text-[11px] font-medium text-[#6a6a6e] hover:text-[#9a9a9d] transition-colors"
              >
                Clear
              </button>
            </div>
            {bulkError && <p className="text-[11px] text-[#ff8a7a]">{bulkError}</p>}
          </div>
        )}

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
                <ConversationComposer
                  sessionId={selectedId}
                  plan={plan}
                  lastCustomerMessageAt={thread.session.last_customer_message_at}
                  onSent={handleThreadRefresh}
                />
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
                  onUpdated={handleThreadRefresh}
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
