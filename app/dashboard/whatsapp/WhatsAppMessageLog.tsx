'use client'

import type { WhatsAppMessageRow } from '@/lib/actions/whatsapp'

interface Props {
  messages: WhatsAppMessageRow[]
}

export default function WhatsAppMessageLog({ messages }: Props) {
  if (messages.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.07] bg-[#0f1012] p-8 flex flex-col items-center gap-3 text-center">
        <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center text-[18px]">
          💬
        </div>
        <p className="text-[13px] text-white font-medium">No messages yet</p>
        <p className="text-[12px] text-[#6a6a6e] max-w-[280px]">
          Incoming WhatsApp messages will appear here once the webhook is live.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0f1012] overflow-hidden">
      <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between">
        <p className="text-[12.5px] font-semibold text-white">Recent Messages</p>
        <span className="text-[11px] text-[#6a6a6e]">{messages.length} shown</span>
      </div>

      <div className="divide-y divide-white/[0.04]">
        {messages.map((msg) => (
          <MessageRow key={msg.id} msg={msg} />
        ))}
      </div>
    </div>
  )
}

function MessageRow({ msg }: { msg: WhatsAppMessageRow }) {
  const isInbound  = msg.direction === 'inbound'
  const phone      = isInbound ? msg.from_phone : msg.to_phone
  const maskedPhone = maskPhone(phone)
  const time       = new Date(msg.created_at).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="px-5 py-3.5 flex items-start gap-3">
      <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-[10px] shrink-0
                       ${isInbound ? 'bg-[#25d366]/10 text-[#25d366]' : 'bg-[#ff7a18]/10 text-[#ffae3c]'}`}>
        {isInbound ? '↓' : '↑'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px] text-white font-mono">{maskedPhone}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium
                           ${isInbound ? 'bg-[#25d366]/10 text-[#25d366]' : 'bg-[#ff7a18]/10 text-[#ffae3c]'}`}>
            {isInbound ? 'Inbound' : 'Outbound'}
          </span>
          <StatusBadge status={msg.status} />
        </div>
        {msg.content_summary && (
          <p className="text-[11.5px] text-[#9a9a9d] mt-1 leading-relaxed line-clamp-2">
            {msg.content_summary}
          </p>
        )}
        <p className="text-[10.5px] text-[#6a6a6e] mt-1">{time}</p>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    received: 'bg-white/[0.06] text-[#9a9a9d]',
    sent:     'bg-[#22d093]/10 text-[#22d093]',
    failed:   'bg-[#ff8a7a]/10 text-[#ff8a7a]',
    read:     'bg-[#22d093]/10 text-[#22d093]',
  }
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium capitalize ${colors[status] ?? 'bg-white/[0.06] text-[#9a9a9d]'}`}>
      {status}
    </span>
  )
}

function maskPhone(phone: string): string {
  if (phone.length <= 4) return phone
  return `••• ${phone.slice(-4)}`
}
