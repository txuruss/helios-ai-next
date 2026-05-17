'use client'

import type { ThreadSession } from './InboxClient'
import type { WhatsAppMessage } from '@/types'
import AiConfidenceBadge     from './AiConfidenceBadge'
import ConversationAiControls from './ConversationAiControls'

interface Props {
  session:  ThreadSession
  messages: WhatsAppMessage[]
}

const MEDIA_ICON: Record<string, string> = {
  image:    '🖼',
  audio:    '🎵',
  document: '📄',
  video:    '🎥',
  sticker:  '🎭',
  template: '📋',
}

function maskPhone(phone: string | null): string {
  if (!phone) return 'Unknown'
  if (phone.length <= 4) return phone
  return `••• ${phone.slice(-4)}`
}

function formatTime(ts: string): string {
  return new Date(ts).toLocaleString('en-US', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

type ExtSession = ThreadSession & {
  ai_paused?:            boolean
  ai_confidence?:        string | null
  last_confidence_reason?: string | null
}

export default function ConversationThread({ session, messages }: Props) {
  const ext = session as ExtSession
  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[#25d366]/10 flex items-center justify-center text-[13px] text-[#25d366] shrink-0">
          ✆
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-white">{maskPhone(session.external_thread_id)}</p>
          <div className="flex items-center gap-3 mt-0.5">
            <p className="text-[11px] text-[#6a6a6e]">
              {messages.length} message{messages.length !== 1 ? 's' : ''} · WhatsApp
            </p>
            {ext.ai_confidence && (
              <AiConfidenceBadge
                confidence={ext.ai_confidence}
                reason={ext.last_confidence_reason}
              />
            )}
            {ext.ai_paused && (
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-[#ffae3c]/30 bg-[#ffae3c]/[0.08] text-[#ffae3c]">
                AI paused
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col gap-2 px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[12px] text-[#6a6a6e]">No messages yet.</p>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
        )}
      </div>

      {/* Conversation-level AI pause controls */}
      <ConversationAiControls
        sessionId={session.id}
        aiPaused={ext.ai_paused ?? false}
      />
    </div>
  )
}

function MessageBubble({ msg }: { msg: WhatsAppMessage }) {
  const isInbound  = msg.direction === 'inbound'
  const isNote     = msg.is_internal_note
  const isMedia    = !['text', 'template'].includes(msg.message_type)
  const isTemplate = msg.message_type === 'template'

  if (isNote) {
    return (
      <div className="flex justify-center my-1">
        <div className="max-w-[80%] px-3.5 py-2 rounded-xl bg-[#ffae3c]/[0.08] border border-[#ffae3c]/20">
          <p className="text-[10px] font-semibold text-[#ffae3c] mb-0.5">Internal Note</p>
          <p className="text-[12px] text-[#f3f3f3] leading-relaxed">{msg.content_summary}</p>
          <p className="text-[10px] text-[#6a6a6e] mt-1">{formatTime(msg.created_at)}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}>
      <div className={`max-w-[75%] flex flex-col gap-1 ${isInbound ? 'items-start' : 'items-end'}`}>
        <div className={`px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed
          ${isInbound
            ? 'bg-[#1a1c1f] border border-white/[0.07] text-white rounded-tl-sm'
            : 'bg-[#25d366]/90 text-[#0a0c0e] rounded-tr-sm'}`}
        >
          {(isMedia || isTemplate) && (
            <div className="flex items-center gap-2 mb-1 opacity-80">
              <span>{MEDIA_ICON[msg.message_type] ?? '📎'}</span>
              <span className="text-[11px] font-medium capitalize">
                {isTemplate
                  ? `${msg.template_name ?? 'template'} (${msg.template_language ?? ''})`
                  : `${msg.message_type}${msg.media_mime_type ? ` · ${msg.media_mime_type.split('/')[1]}` : ''}`
                }
              </span>
            </div>
          )}
          <p>{msg.content_summary ?? '—'}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[#6a6a6e]">{formatTime(msg.created_at)}</span>
          {!isInbound && <StatusDot status={msg.status} />}
        </div>
      </div>
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = { sent: '#6a6a6e', read: '#22d093', failed: '#ff8a7a' }
  return <span className="text-[10px]" style={{ color: colors[status] ?? '#6a6a6e' }}>●</span>
}
