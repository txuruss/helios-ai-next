'use client'

import { useState, useRef, useEffect, useTransition } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  businessId:   string
  businessName: string
  botName:      string
  primaryColor: string
}

export default function ChatTestClient({ businessId, businessName, botName, primaryColor }: Props) {
  const [messages, setMessages]   = useState<Message[]>([])
  const [input, setInput]         = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = () => {
    const text = input.trim()
    if (!text || pending) return

    const userMsg: Message = { role: 'user', content: text }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    setError(null)

    startTransition(async () => {
      try {
        const res = await fetch('/api/chat', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            business_id: businessId,
            messages:    nextMessages,
            session_id:  sessionId ?? undefined,
          }),
        })

        const data = await res.json().catch(() => ({}))

        if (!res.ok) {
          const friendlyErrors: Record<number, string> = {
            429: 'Too many messages sent. Please wait a moment before continuing.',
            403: 'Chat is currently disabled or this origin is not allowed.',
            413: 'Message too large. Please shorten your message.',
            503: 'AI service is not configured. Set ANTHROPIC_API_KEY in .env.local and restart.',
            404: 'Business not found. Check your configuration.',
          }
          setError(
            friendlyErrors[res.status] ??
            (data as { error?: string }).error ??
            'Something went wrong. Please try again.',
          )
          return
        }

        setMessages((prev) => [...prev, { role: 'assistant', content: (data as { reply: string }).reply }])
        if ((data as { session_id?: string }).session_id && !sessionId) {
          setSessionId((data as { session_id: string }).session_id)
        }

      } catch {
        setError('Network error. Check your connection and try again.')
      }
    })
  }

  const reset = () => {
    setMessages([])
    setSessionId(null)
    setError(null)
    setInput('')
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Chat window */}
      <div className="lg:col-span-2 border border-white/10 rounded-2xl overflow-hidden flex flex-col" style={{ height: '580px' }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06] bg-[#0f1012]">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0 shadow-[0_0_16px_rgba(255,122,24,0.4)]"
               style={{ background: primaryColor }}>
            ✦
          </div>
          <div>
            <div className="text-[14px] font-semibold">{botName}</div>
            <div className="text-[11px] text-[#6a6a6e]">{businessName}</div>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#22d093]" />
            <span className="text-[11px] text-[#22d093]">Online</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 bg-[#07080a]">
          {messages.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
                   style={{ background: primaryColor + '28' }}>
                💬
              </div>
              <p className="text-[13px] text-[#6a6a6e]">Start a conversation to test the AI assistant.</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] flex-shrink-0 mt-0.5"
                     style={{ background: primaryColor }}>
                  ✦
                </div>
              )}
              <div className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-[13.5px] leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#ff7a18]/20 border border-[#ff7a18]/25 text-white rounded-br-sm'
                  : 'bg-white/[0.05] border border-white/[0.06] text-[#e8e8ea] rounded-bl-sm'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}

          {pending && (
            <div className="flex gap-2.5 justify-start">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] flex-shrink-0"
                   style={{ background: primaryColor }}>
                ✦
              </div>
              <div className="px-3.5 py-3 rounded-2xl rounded-bl-sm bg-white/[0.05] border border-white/[0.06]">
                <span className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#6a6a6e] animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="px-4 py-3 rounded-xl bg-[#ff6a5a]/10 border border-[#ff6a5a]/30 text-[13px] text-[#ff8a7a]">
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex items-center gap-2 px-4 py-3.5 border-t border-white/[0.06] bg-[#0c0d0f]">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Type a message…"
            disabled={pending}
            className="flex-1 h-10 bg-white/[0.03] border border-white/[0.06] rounded-[10px] px-3.5
                       text-[13.5px] text-white placeholder:text-[#6a6a6e] outline-none
                       focus:border-white/20 transition-colors disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={pending || !input.trim()}
            className="h-10 w-10 rounded-[10px] flex items-center justify-center text-[#1a0c00]
                       transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: pending || !input.trim() ? '#6a6a6e' : primaryColor }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M5 12h14M13 5l7 7-7 7"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Info panel */}
      <div className="flex flex-col gap-4">
        {/* Session info */}
        <div className="border border-white/10 rounded-2xl p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6a6a6e] mb-3">Session</div>
          <div className="flex flex-col gap-2 text-[12.5px]">
            <div className="flex justify-between">
              <span className="text-[#6a6a6e]">Business ID</span>
              <span className="font-mono text-[10.5px] text-[#9a9a9d] truncate max-w-[120px]">{businessId.slice(0, 8)}…</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6a6a6e]">Session ID</span>
              <span className="font-mono text-[10.5px] text-[#9a9a9d]">
                {sessionId ? `${sessionId.slice(0, 8)}…` : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6a6a6e]">Messages</span>
              <span className="text-white">{messages.length}</span>
            </div>
          </div>
          <button onClick={reset}
            className="mt-4 w-full h-8 rounded-[9px] text-[12px] border border-white/10 bg-white/[0.02]
                       text-[#9a9a9d] hover:text-white hover:border-white/20 transition-all">
            Reset Conversation
          </button>
        </div>

        {/* Test prompts */}
        <div className="border border-white/10 rounded-2xl p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6a6a6e] mb-3">Quick Tests</div>
          <div className="flex flex-col gap-2">
            {[
              'What services do you offer?',
              'What are your hours?',
              "I'd like to book an appointment",
              'How much does it cost?',
              'My name is Jane and I want to book for Saturday',
            ].map((prompt) => (
              <button
                key={prompt}
                onClick={() => { setInput(prompt); }}
                disabled={pending}
                className="text-left px-3 py-2.5 rounded-[9px] text-[12px] text-[#9a9a9d]
                           border border-white/[0.06] bg-white/[0.015]
                           hover:text-white hover:border-white/10 hover:bg-white/[0.03]
                           transition-all disabled:opacity-40 leading-snug"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* API info */}
        <div className="border border-white/10 rounded-2xl p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6a6a6e] mb-3">API Endpoint</div>
          <code className="text-[11px] text-[#5be3c5] font-mono">POST /api/chat</code>
          <p className="text-[11.5px] text-[#6a6a6e] mt-2 leading-relaxed">
            Leads captured during conversation appear in the{' '}
            <span className="text-[#9a9a9d]">Leads</span> dashboard.
          </p>
        </div>
      </div>
    </div>
  )
}
