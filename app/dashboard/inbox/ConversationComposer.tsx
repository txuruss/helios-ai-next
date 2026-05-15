'use client'

import { useState, useTransition } from 'react'
import { capture } from '@/lib/analytics/posthog'

interface Props {
  sessionId: string
  plan:      string
  onSent:    () => void
}

const PLAN_ORDER: Record<string, number> = { starter: 0, pro: 1, scale: 2 }

export default function ConversationComposer({ sessionId, plan, onSent }: Props) {
  const [message,  setMessage]  = useState('')
  const [template, setTemplate] = useState('')
  const [lang,     setLang]     = useState('en_US')
  const [tab,      setTab]      = useState<'text' | 'template'>('text')

  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const canTemplate = (PLAN_ORDER[plan] ?? 0) >= (PLAN_ORDER['scale'] ?? 2)

  const handleSend = () => {
    if (!message.trim()) return
    setError(null)
    setSuccess(null)

    startTransition(async () => {
      try {
        const res = await fetch('/api/whatsapp/send', {
          method:      'POST',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          body:        JSON.stringify({ session_id: sessionId, message: message.trim() }),
        })
        const data = await res.json() as { ok?: boolean; error?: string }
        if (!res.ok) {
          setError(data.error ?? 'Failed to send message.')
          capture('whatsapp_send_failed', { session_id: sessionId })
          return
        }
        setMessage('')
        setSuccess('Message sent.')
        capture('whatsapp_reply_sent', { manual: true })
        onSent()
      } catch {
        setError('Network error. Please try again.')
      }
    })
  }

  const handleSendTemplate = () => {
    if (!template.trim()) return
    setError(null)
    setSuccess(null)

    startTransition(async () => {
      try {
        const res = await fetch('/api/whatsapp/send-template', {
          method:      'POST',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          body:        JSON.stringify({
            session_id:        sessionId,
            template_name:     template.trim().toLowerCase().replace(/\s+/g, '_'),
            template_language: lang.trim() || 'en_US',
          }),
        })
        const data = await res.json() as { ok?: boolean; error?: string }
        if (!res.ok) {
          setError(data.error ?? 'Failed to send template.')
          return
        }
        setTemplate('')
        setSuccess('Template sent.')
        capture('whatsapp_template_sent', { template_name: template })
        onSent()
      } catch {
        setError('Network error. Please try again.')
      }
    })
  }

  return (
    <div className="flex flex-col gap-3 border-t border-white/[0.06] bg-[#0a0b0d] px-4 py-3">
      {/* Tab switcher */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('text')}
          className={`text-[11.5px] font-medium px-2.5 py-1 rounded-lg transition-all
                      ${tab === 'text' ? 'bg-white/[0.08] text-white' : 'text-[#6a6a6e] hover:text-[#9a9a9d]'}`}
        >
          Reply
        </button>
        {canTemplate && (
          <button
            onClick={() => setTab('template')}
            className={`text-[11.5px] font-medium px-2.5 py-1 rounded-lg transition-all
                        ${tab === 'template' ? 'bg-white/[0.08] text-white' : 'text-[#6a6a6e] hover:text-[#9a9a9d]'}`}
          >
            Template <span className="text-[10px] text-[#6a6a6e]">Scale</span>
          </button>
        )}
      </div>

      {tab === 'text' && (
        <div className="flex gap-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
            }}
            placeholder="Type a reply… (Enter to send, Shift+Enter for new line)"
            rows={2}
            maxLength={4096}
            className="flex-1 rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 py-2.5
                       text-[12.5px] text-white placeholder-[#6a6a6e] resize-none outline-none
                       focus:border-[#ff7a18]/40 transition-colors"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={pending || !message.trim()}
            className="self-end h-10 px-4 rounded-xl bg-[#25d366] text-[#0a0c0e] text-[13px] font-semibold
                       hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {pending ? '…' : '↑'}
          </button>
        </div>
      )}

      {tab === 'template' && canTemplate && (
        <div className="flex flex-col gap-2">
          <p className="text-[10.5px] text-[#ffae3c]">
            Advanced · Templates must be pre-approved in Meta Business Manager.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              placeholder="template_name"
              maxLength={128}
              className="flex-1 h-9 rounded-lg bg-white/[0.04] border border-white/[0.08] px-3
                         text-[12.5px] text-white placeholder-[#6a6a6e] outline-none
                         focus:border-[#ff7a18]/40 transition-colors"
            />
            <input
              type="text"
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              placeholder="en_US"
              maxLength={20}
              className="w-24 h-9 rounded-lg bg-white/[0.04] border border-white/[0.08] px-3
                         text-[12.5px] text-white placeholder-[#6a6a6e] outline-none
                         focus:border-[#ff7a18]/40 transition-colors"
            />
            <button
              type="button"
              onClick={handleSendTemplate}
              disabled={pending || !template.trim()}
              className="h-9 px-4 rounded-lg border border-[#ffae3c]/30 bg-[#ffae3c]/[0.08]
                         text-[12px] font-medium text-[#ffae3c] hover:bg-[#ffae3c]/15 transition-all
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {pending ? '…' : 'Send'}
            </button>
          </div>
        </div>
      )}

      {error   && <p className="text-[11.5px] text-[#ff8a7a]">{error}</p>}
      {success && <p className="text-[11.5px] text-[#22d093]">{success}</p>}
    </div>
  )
}
