'use client'

import type { ConversationSummary, InboxFilter } from '@/lib/actions/inbox'
import type { HandoffStatus } from '@/types'

interface Props {
  conversations:  ConversationSummary[]
  selectedId:     string | null
  onSelect:       (id: string) => void
  currentFilter:  InboxFilter
  onFilterChange: (f: InboxFilter) => void
  stats:          Record<string, number>
}

const FILTERS: Array<{ id: InboxFilter; label: string; color?: string }> = [
  { id: 'all',             label: 'All' },
  { id: 'ai',              label: 'AI',          color: '#22d093' },
  { id: 'human_requested', label: 'Needs Agent', color: '#ffae3c' },
  { id: 'human',           label: 'Human',       color: '#3b9eff' },
  { id: 'resolved',        label: 'Resolved',    color: '#6a6a6e' },
  { id: 'archived',        label: 'Archived',    color: '#4a4a4e' },
]

const STATUS_COLORS: Record<HandoffStatus, string> = {
  ai:              '#22d093',
  human_requested: '#ffae3c',
  human:           '#3b9eff',
  resolved:        '#6a6a6e',
  archived:        '#4a4a4e',
}

function maskPhone(phone: string | null): string {
  if (!phone) return 'Unknown'
  if (phone.length <= 4) return phone
  return `••• ${phone.slice(-4)}`
}

function relativeTime(ts: string | null): string {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  const min  = Math.floor(diff / 60000)
  if (min < 1)  return 'just now'
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h  < 24)  return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function ConversationList({
  conversations, selectedId, onSelect, currentFilter, onFilterChange, stats,
}: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3.5 border-b border-white/[0.06]">
        <h2 className="text-[14px] font-semibold text-white">Inbox</h2>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 px-3 py-2 border-b border-white/[0.06] flex-wrap">
        {FILTERS.map((f) => {
          const count  = stats[f.id] ?? 0
          const active = currentFilter === f.id
          return (
            <button
              key={f.id}
              onClick={() => onFilterChange(f.id)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all
                          ${active ? 'bg-white/[0.08] text-white' : 'text-[#6a6a6e] hover:text-[#9a9a9d] hover:bg-white/[0.04]'}`}
            >
              {f.color && <span className="w-1.5 h-1.5 rounded-full" style={{ background: f.color }} />}
              {f.label}
              {count > 0 && <span className="text-[10px] text-[#6a6a6e]">{count}</span>}
            </button>
          )
        })}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center px-4">
            <span className="text-[24px]">💬</span>
            <p className="text-[12px] text-[#6a6a6e]">No conversations</p>
          </div>
        ) : (
          conversations.map((conv) => (
            <ConvRow
              key={conv.id}
              conv={conv}
              isSelected={selectedId === conv.id}
              onSelect={() => onSelect(conv.id)}
              statusColor={STATUS_COLORS[conv.handoff_status] ?? '#6a6a6e'}
            />
          ))
        )}
      </div>
    </div>
  )
}

function ConvRow({
  conv, isSelected, onSelect, statusColor,
}: {
  conv:        ConversationSummary
  isSelected:  boolean
  onSelect:    () => void
  statusColor: string
}) {
  const time  = relativeTime(conv.last_customer_message_at ?? conv.updated_at)
  const phone = maskPhone(conv.external_thread_id)
  const name  = conv.lead_name ?? phone

  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-start gap-3 px-4 py-3.5 text-left border-b border-white/[0.03]
                  transition-colors ${isSelected ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'}`}
    >
      <div className="relative shrink-0 mt-0.5">
        <div className="w-8 h-8 rounded-full bg-[#25d366]/10 flex items-center justify-center text-[13px] text-[#25d366]">
          ✆
        </div>
        <span
          className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-[#0c0d0f]"
          style={{ background: statusColor }}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className="text-[12.5px] font-medium text-white truncate">{name}</span>
          <span className="text-[10.5px] text-[#6a6a6e] shrink-0">{time}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#25d366]/10 text-[#25d366] font-medium shrink-0">
            WA
          </span>
          <p className="text-[11.5px] text-[#6a6a6e] truncate">
            {conv.last_message_preview ?? 'No messages yet'}
          </p>
        </div>
        {conv.handoff_status === 'human_requested' && (
          <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-md bg-[#ffae3c]/10 text-[#ffae3c] font-medium">
            Needs agent
          </span>
        )}
      </div>
    </button>
  )
}
