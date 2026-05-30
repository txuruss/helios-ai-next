'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Zap, CalendarCheck, BellRing } from 'lucide-react'
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
    { who: 'cust', text: 'Hi, any openings this Saturday for a haircut?' },
    { who: 'ai',   text: 'Yes! We have 10:00 AM and 1:30 PM available.' },
    { who: 'cust', text: '10 AM works.' },
    { who: 'ai',   text: 'Booked! Confirmation sent to your number.' },
  ]

  const stats = [
    { icon: Zap,           value: '< 1s',                                     label: 'Replied',     tone: '#ffae3c' },
    { icon: CalendarCheck, value: tick % 2 === 0 ? '12 today' : '13 today',   label: 'Booked',      tone: '#22d093' },
    { icon: BellRing,      value: 'Sent',                                     label: 'Owner alert', tone: '#9a9a9d' },
  ]

  return (
    <div className="relative">
      {/* Ambient orange/gold glow behind the card */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-3 -z-10 rounded-[2.25rem] blur-2xl
                   bg-[radial-gradient(60%_55%_at_50%_0%,rgba(255,122,24,0.22),transparent_70%)]"
      />

      <div className="glass relative rounded-[1.75rem] border border-white/10 overflow-hidden
                      shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_60px_120px_-40px_rgba(255,122,24,0.28)]
                      hover:border-[#ff7a18]/40 hover:shadow-[0_0_0_1px_rgba(255,122,24,0.18),0_60px_120px_-30px_rgba(255,122,24,0.5)]
                      transition-all duration-300">

        {/* Top accent line */}
        <div aria-hidden className="h-px w-full bg-gradient-to-r from-transparent via-[#ff7a18]/50 to-transparent" />

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full
                             bg-[#ff7a18]/[0.10] border border-[#ff7a18]/30
                             text-[10px] font-semibold tracking-[0.18em] uppercase text-[#ffae3c]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ff7a18] animate-pulse-orange" />
              Live Preview
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                             bg-[#22d093]/[0.10] border border-[#22d093]/25
                             text-[10.5px] font-medium text-[#22d093]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22d093] shadow-glow-green" />
              AI Active
            </span>
          </div>

          <div className="flex items-center gap-2.5 mt-3.5">
            <span className="w-2 h-2 rounded-full bg-[#22d093] shadow-glow-green shrink-0" />
            <span className="text-[15px] font-semibold text-white tracking-tight">Elite Cuts</span>
            <span className="text-[#3a3a3e]">·</span>
            <span className="text-[12.5px] text-[#9a9a9d] font-mono">WhatsApp</span>
          </div>
        </div>

        {/* Messages */}
        <div className="px-5 py-5 flex flex-col gap-3.5">
          {msgs.map((m, i) => (
            <div key={i} className="flex gap-2.5 items-start">
              <div className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold tracking-wide ${
                m.who === 'ai'
                  ? 'bg-gradient-to-b from-[#ff8a2a] to-[#b34800] text-white shadow-[0_4px_12px_-4px_rgba(255,122,24,0.7)]'
                  : 'bg-[#2a2a2e] text-[#cfcfcf] border border-white/[0.06]'
              }`}>
                {m.who === 'ai' ? 'AI' : 'CU'}
              </div>
              <div className={`rounded-2xl rounded-tl-md px-3.5 py-2.5 max-w-[85%] text-[12.5px] leading-relaxed border break-words ${
                m.who === 'ai'
                  ? 'bg-[#ff7a18]/[0.10] border-[#ff7a18]/25 text-[#f3e7da] shadow-[0_8px_26px_-14px_rgba(255,122,24,0.65)]'
                  : 'bg-white/[0.04] border-white/[0.07] text-[#dcdcde]'
              }`}>
                {m.text}
              </div>
            </div>
          ))}
          {typing && (
            <div className="flex gap-2.5 items-start">
              <div className="w-6 h-6 rounded-full shrink-0 bg-gradient-to-b from-[#ff8a2a] to-[#b34800] flex items-center justify-center text-[9px] font-bold text-white shadow-[0_4px_12px_-4px_rgba(255,122,24,0.7)]">AI</div>
              <div className="bg-white/[0.04] border border-white/[0.07] rounded-2xl rounded-tl-md px-3.5 py-3 flex gap-1.5 items-center">
                {[0, 150, 300].map((d) => (
                  <span key={d} className="w-1.5 h-1.5 rounded-full bg-white/50 animate-blink" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Stats — mini KPI cards */}
        <div className="border-t border-white/[0.06] px-5 py-4 grid grid-cols-3 gap-2.5">
          {stats.map(({ icon: Icon, value, label, tone }) => (
            <div key={label} className="rounded-xl bg-white/[0.03] border border-white/[0.07] px-3 py-3 flex flex-col gap-1.5">
              <Icon size={14} style={{ color: tone }} strokeWidth={2.2} />
              <div className="text-[14px] font-semibold text-white leading-none tabular-nums">{value}</div>
              <div className="text-[10px] text-[#6a6a6e] uppercase tracking-[0.08em] leading-tight">{label}</div>
            </div>
          ))}
        </div>
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
