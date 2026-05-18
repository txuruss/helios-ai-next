'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { capture } from '@/lib/analytics/posthog'

const TRUST_BULLETS = [
  'Built for barbershops, salons, spas, clinics, repair shops,',
  'and appointment-based local businesses.',
]

function ConversationCard() {
  const [tick, setTick]     = useState(0)
  const [typing, setTyping] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 2800)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    setTyping(true)
    const t = setTimeout(() => setTyping(false), 1100)
    return () => clearTimeout(t)
  }, [tick])

  const msgs = [
    { who: 'cust', text: 'Hi — any openings this Saturday for a haircut?' },
    { who: 'ai',   text: 'Yes! We have 10:00 AM and 1:30 PM available.' },
    { who: 'cust', text: '10 AM works.' },
    { who: 'ai',   text: 'Booked! Confirmation sent to your number.' },
  ]

  return (
    <div className="relative rounded-3xl border border-white/10 overflow-hidden
                    bg-gradient-to-b from-[#141518]/95 to-[#0c0c0e]/95
                    shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_60px_120px_-40px_rgba(255,122,24,0.25)]
                    hover:border-[#ff7a18]/40 hover:shadow-[0_0_0_1px_rgba(255,122,24,0.18),0_60px_120px_-30px_rgba(255,122,24,0.5)]
                    transition-all duration-300">

      {/* Live pill */}
      <div className="absolute -top-3 left-6 z-10 flex items-center gap-2 px-3 py-1.5 rounded-full
                      bg-[#0a0a0c] border border-[#ff7a18]/40
                      text-[11px] font-semibold tracking-widest uppercase text-[#ffae3c]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#ff7a18] animate-pulse-orange" />
        Live Preview
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5 text-[13px] text-[#9a9a9d] font-mono">
          <span className="w-2 h-2 rounded-full bg-[#22d093] shadow-glow-green" />
          Elite Cuts · WhatsApp
        </div>
        <span className="text-[10px] px-2.5 py-1 rounded-full bg-[#22d093]/10 text-[#22d093] font-medium">AI Active</span>
      </div>

      {/* Messages */}
      <div className="p-5 flex flex-col gap-2.5">
        {msgs.map((m, i) => (
          <div key={i} className="flex gap-2 text-[12.5px]">
            <div className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[9px] font-semibold ${
              m.who === 'ai'
                ? 'bg-gradient-to-b from-[#ff8a2a] to-[#b34800] text-white'
                : 'bg-[#2a2a2e] text-[#bbb]'
            }`}>
              {m.who === 'ai' ? 'AI' : 'CU'}
            </div>
            <div className={`rounded-xl px-2.5 py-1.5 max-w-[88%] border ${
              m.who === 'ai'
                ? 'bg-[#ff7a18]/[0.08] border-[#ff7a18]/[0.18]'
                : 'bg-white/[0.04] border-white/[0.06]'
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex gap-2 text-[12.5px]">
            <div className="w-5 h-5 rounded-full shrink-0 bg-gradient-to-b from-[#ff8a2a] to-[#b34800] flex items-center justify-center text-[9px] font-semibold text-white">AI</div>
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2 flex gap-1">
              {[0, 150, 300].map((d) => (
                <span key={d} className="w-1.5 h-1.5 rounded-full bg-white/50 animate-blink" style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Stats strip */}
      <div className="border-t border-white/[0.06] px-5 py-3 grid grid-cols-3 gap-3">
        {[
          { label: 'Replied',     value: '< 1s'   },
          { label: 'Booked',      value: tick % 2 === 0 ? '12 today' : '13 today' },
          { label: 'Owner alert', value: 'Sent ✓' },
        ].map((s) => (
          <div key={s.label} className="text-center">
            <div className="text-[15px] font-semibold text-white">{s.value}</div>
            <div className="text-[10px] text-[#6a6a6e] mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Hero() {
  return (
    <section className="pt-40 pb-24 relative" id="top">
      <div className="max-w-[1280px] mx-auto px-7">
        <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-16 items-center">

          {/* Left */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}
          >
            <span className="eyebrow">AI Booking Systems for Local Businesses</span>
            <h1 className="mt-4 text-[clamp(36px,5.2vw,62px)] font-semibold leading-[1.04] tracking-tight">
              Stop missing customers{' '}
              <span className="gradient-text">while you&apos;re busy working.</span>
            </h1>
            <p className="mt-5 text-[17px] text-[#9a9a9d] max-w-[560px] leading-relaxed">
              Helios AI replies to customers, answers FAQs, captures leads, books appointments,
              and alerts you instantly — through your website chat and WhatsApp.
            </p>

            {/* CTAs */}
            <div className="flex gap-3 mt-8 flex-wrap">
              <Link
                href="/audit"
                className="btn-primary"
                onClick={() => capture('landing_cta_clicked', { source: 'hero', cta: 'start_audit' })}
              >
                Start Free Business Audit
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
              </Link>
              <Link
                href="/choose-plan"
                className="btn-ghost"
                onClick={() => capture('landing_cta_clicked', { source: 'hero', cta: 'choose_plan' })}
              >
                Choose Your Plan
              </Link>
            </div>

            {/* Trust line */}
            <p className="mt-5 text-[13px] text-[#6a6a6e] leading-relaxed">
              Built for barbershops, salons, spas, clinics, repair shops, and appointment-based local businesses.
            </p>

            {/* Social proof chips */}
            <div className="flex flex-wrap gap-x-5 gap-y-2 mt-6">
              {[
                '24/7 AI replies',
                'Cal.com booking',
                'WhatsApp assistant',
                'One dashboard',
                'Human handoff',
              ].map((t) => (
                <span key={t} className="flex items-center gap-2 text-[12.5px] text-[#9a9a9d]">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffae3c" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="m4 12 5 5 11-12"/></svg>
                  {t}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Right — live conversation preview */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.2, 0.7, 0.2, 1] }}
          >
            <ConversationCard />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
