'use client'

import { useState } from 'react'
import { DEMO_FAQS, DEMO_SERVICES } from '@/lib/demo/demo-data'
import { capture } from '@/lib/analytics/posthog'

interface Message {
  role:    'user' | 'ai'
  content: string
}

// Canned responses — never calls external APIs
function getCannonedReply(userMsg: string): string {
  const msg = userMsg.toLowerCase()

  if (msg.includes('service') || msg.includes('offer') || msg.includes('what do you do')) {
    const serviceList = DEMO_SERVICES.map((s) => `• ${s.name} ($${s.price_min}–$${s.price_max})`).join('\n')
    return `Here are our services:\n${serviceList}\n\nWould you like to book any of these?`
  }

  if (msg.includes('haircut') && (msg.includes('how much') || msg.includes('price') || msg.includes('cost'))) {
    return 'A classic haircut is $35–$45 and takes about 30 minutes. Want to book one?'
  }

  if (msg.includes('open') || msg.includes('hours')) {
    return 'We\'re open Monday–Friday 9am–7pm, and Saturday 9am–5pm. Walk-ins are welcome!'
  }

  if (msg.includes('saturday') || msg.includes('book') || msg.includes('appointment')) {
    return 'I can help you book! We have openings this Saturday at 10 AM, 1 PM, and 3 PM. Which works best for you?'
  }

  if (msg.includes('human') || msg.includes('speak') || msg.includes('agent') || msg.includes('person')) {
    return 'Of course! I\'ll let the team know you\'d like to speak with someone. They\'ll follow up shortly.'
  }

  // FAQ match
  const faqMatch = DEMO_FAQS.find((f) =>
    f.question.toLowerCase().split(' ').some((w) => w.length > 3 && msg.includes(w))
  )
  if (faqMatch) return faqMatch.answer

  return 'Great question! I can help with bookings, services, pricing, and availability. What would you like to know?'
}

const QUICK_PROMPTS = [
  'What services do you offer?',
  'How much is a haircut?',
  'Are you open today?',
  'Can I book for Saturday?',
  'I want to speak to someone.',
]

export default function DemoWidgetSandbox() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', content: 'Hi! I\'m the Helios AI assistant for Elite Cuts Barbershop. How can I help you today?' },
  ])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)

  const sendMessage = (text: string) => {
    if (!text.trim()) return
    capture('demo_widget_opened', { demo_mode: true })

    const userMsg = text.trim()
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }])
    setInput('')
    setTyping(true)

    // Simulate AI reply delay
    setTimeout(() => {
      const reply = getCannonedReply(userMsg)
      setMessages((prev) => [...prev, { role: 'ai', content: reply }])
      setTyping(false)
    }, 800 + Math.random() * 400)
  }

  return (
    <div className="border border-white/[0.08] rounded-2xl overflow-hidden bg-[#0f1012] flex flex-col"
         style={{ height: '520px' }}>
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-white/[0.06] bg-gradient-to-b from-[#141518] to-[#0f1012]">
        <div className="w-8 h-8 rounded-full bg-[#ff7a18]/20 border border-[#ff7a18]/30 flex items-center justify-center text-[14px]">⚙</div>
        <div>
          <p className="text-[13px] font-semibold text-white">Elite Cuts AI</p>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22d093]" />
            <p className="text-[10px] text-[#22d093]">Demo active</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            {m.role === 'ai' && (
              <div className="w-6 h-6 rounded-full shrink-0 bg-gradient-to-b from-[#ff8a2a] to-[#b34800] flex items-center justify-center text-[9px] font-semibold text-white mt-0.5">AI</div>
            )}
            <div className={`max-w-[80%] rounded-xl px-3 py-2 text-[13px] whitespace-pre-wrap border ${
              m.role === 'ai'
                ? 'bg-[#ff7a18]/[0.08] border-[#ff7a18]/20 text-white'
                : 'bg-white/[0.06] border-white/[0.08] text-white'
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex gap-2.5">
            <div className="w-6 h-6 rounded-full shrink-0 bg-gradient-to-b from-[#ff8a2a] to-[#b34800] flex items-center justify-center text-[9px] font-semibold text-white">AI</div>
            <div className="bg-[#ff7a18]/[0.08] border border-[#ff7a18]/20 rounded-xl px-3 py-2.5 flex gap-1">
              {[0,150,300].map((d) => (
                <span key={d} className="w-1.5 h-1.5 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick prompts */}
      <div className="px-4 py-2 border-t border-white/[0.06] flex gap-1.5 overflow-x-auto">
        {QUICK_PROMPTS.map((p) => (
          <button key={p} onClick={() => sendMessage(p)}
            className="text-[11px] px-2.5 py-1 rounded-full border border-white/[0.10] text-[#9a9a9d]
                       hover:border-[#ff7a18]/30 hover:text-white transition-all whitespace-nowrap shrink-0">
            {p}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-white/[0.06] flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }}
          placeholder="Type a message…"
          maxLength={500}
          className="flex-1 h-9 rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 text-[13px]
                     text-white placeholder-[#6a6a6e] outline-none focus:border-[#ff7a18]/40"
        />
        <button onClick={() => sendMessage(input)} disabled={!input.trim() || typing}
          className="h-9 px-3.5 rounded-lg text-[13px] bg-gradient-to-b from-[#ff8a2a] to-[#ee6a0c]
                     text-[#1a0c00] font-medium hover:opacity-90 transition-opacity disabled:opacity-40">
          →
        </button>
      </div>
    </div>
  )
}
