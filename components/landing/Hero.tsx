'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'

const CHIPS = ['AI Booking', 'Lead Capture', 'WhatsApp Replies', 'Client Onboarding', 'Ops Dashboard', 'Monthly Optimization']
const TRUST = ['Built for local service businesses', 'Website + AI booking systems', 'Dashboard included', 'Monthly optimization available']

function MissionControlCard() {
  const [tick, setTick] = useState(0)
  const [typing, setTyping] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 2600)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    setTyping(true)
    const t = setTimeout(() => setTyping(false), 1100)
    return () => clearTimeout(t)
  }, [tick])

  const kpis = [
    { label: 'Total Leads',     value: 1248 + (tick % 6), delta: '+18.4%' },
    { label: 'Bookings',        value: 384 + tick,         delta: '+24.1%' },
    { label: 'Active Clients',  value: 47,                  delta: '+3 wk'  },
    { label: 'MRR',             value: '$84.2k',            delta: '+12.6%' },
  ]

  return (
    <div className="relative rounded-3xl border border-white/10 overflow-hidden
                    bg-gradient-to-b from-[#141518]/95 to-[#0c0c0e]/95
                    shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_60px_120px_-40px_rgba(255,122,24,0.25)]
                    transition-all duration-300
                    hover:border-[#ff7a18]/40 hover:shadow-[0_0_0_1px_rgba(255,122,24,0.18),0_60px_120px_-30px_rgba(255,122,24,0.5)]">

      {/* Live pill */}
      <div className="absolute -top-3 left-6 z-10 flex items-center gap-2 px-3 py-1.5 rounded-full
                      bg-[#0a0a0c] border border-[#ff7a18]/40
                      text-[11px] font-semibold tracking-widest uppercase text-[#ffae3c]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#ff7a18] animate-pulse-orange" />
        Live System Preview
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5 text-[13px] text-[#9a9a9d] font-mono">
          <span className="w-2 h-2 rounded-full bg-[#22d093] shadow-glow-green" />
          helios.mc / mission-control
        </div>
        <div className="flex gap-1">
          {['Today', '7d', '30d'].map((t, i) => (
            <span key={t} className={`text-[11px] px-2.5 py-1 rounded-md ${i === 0 ? 'bg-white/[0.06] text-white' : 'text-[#6a6a6e]'}`}>{t}</span>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="p-4">
        <div className="grid grid-cols-4 gap-2.5">
          {kpis.map((k) => (
            <div key={k.label} className="border border-white/[0.06] rounded-2xl p-3 bg-white/[0.015]">
              <div className="text-[10.5px] text-[#6a6a6e] uppercase tracking-widest">{k.label}</div>
              <div className="text-xl font-semibold mt-1.5 tabular-nums">{k.value}</div>
              <div className="text-[11px] text-[#22d093] mt-0.5">↑ {k.delta}</div>
            </div>
          ))}
        </div>

        {/* Chat preview */}
        <div className="mt-3 border border-white/[0.06] rounded-2xl p-3.5 bg-white/[0.015]">
          <div className="text-[11px] text-[#6a6a6e] uppercase tracking-wider mb-2.5 flex items-center justify-between">
            Live AI Conversation
            <span className="bg-[#5be3c5]/10 text-[#5be3c5] px-2 py-0.5 rounded-full text-[10px]">island glow · spa</span>
          </div>
          {[
            { who: 'cust', text: 'Hi — any facial appointments this Saturday?' },
            { who: 'ai',   text: 'Yes — Signature Facial at 10:00 AM, 1:30 PM, and 3:00 PM.' },
            { who: 'cust', text: '1:30 PM please.' },
          ].map((m, i) => (
            <div key={i} className="flex gap-2 mb-2 text-[12.5px]">
              <div className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[9px] font-semibold ${
                m.who === 'ai'
                  ? 'bg-gradient-to-b from-[#ff8a2a] to-[#b34800] text-white'
                  : 'bg-[#2a2a2e] text-[#bbb]'
              }`}>
                {m.who === 'ai' ? 'AI' : 'JD'}
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
          {typing ? (
            <div className="flex gap-2 text-[12.5px]">
              <div className="w-5 h-5 rounded-full shrink-0 bg-gradient-to-b from-[#ff8a2a] to-[#b34800] flex items-center justify-center text-[9px] font-semibold text-white">AI</div>
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2 flex gap-1">
                {[0, 150, 300].map((d) => (
                  <span key={d} className="w-1.5 h-1.5 rounded-full bg-white/50 animate-blink" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          ) : (
            <div className="flex gap-2 text-[12.5px]">
              <div className="w-5 h-5 rounded-full shrink-0 bg-gradient-to-b from-[#ff8a2a] to-[#b34800] flex items-center justify-center text-[9px] font-semibold text-white">AI</div>
              <div className="bg-[#ff7a18]/[0.08] border border-[#ff7a18]/[0.18] rounded-xl px-2.5 py-1.5">
                Confirmed for Saturday at 1:30 PM — details sent to your email.
              </div>
            </div>
          )}
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
            <span className="eyebrow">AI Operations for Local Businesses</span>
            <h1 className="mt-4 text-[clamp(36px,5.5vw,64px)] font-semibold leading-[1.04] tracking-tight">
              Turn missed messages into{' '}
              <span className="gradient-text">booked customers</span> with AI.
            </h1>
            <p className="mt-5 text-[17px] text-[#9a9a9d] max-w-[560px] leading-relaxed">
              Helios AI builds AI booking systems, lead capture flows, WhatsApp automations,
              and operations dashboards for local service businesses that want faster replies,
              more bookings, and less manual work.
            </p>

            {/* CTAs */}
            <div className="flex gap-3 mt-8 flex-wrap">
              <Link href="/login" className="btn-primary">
                Book a Strategy Call
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
              </Link>
              <a href="#demo" className="btn-ghost">Watch the Demo</a>
            </div>

            {/* Trust row */}
            <div className="flex flex-wrap gap-x-5 gap-y-2 mt-6">
              {TRUST.map((t) => (
                <span key={t} className="flex items-center gap-2 text-[12.5px] text-[#9a9a9d]">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffae3c" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="m4 12 5 5 11-12"/></svg>
                  {t}
                </span>
              ))}
            </div>

            {/* Chips */}
            <div className="flex flex-wrap gap-2 mt-8">
              {CHIPS.map((c) => (
                <span key={c} className="chip">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ff7a18] shadow-[0_0_8px_#ff7a18]" />
                  {c}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Right — Mission Control */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.2, 0.7, 0.2, 1] }}
          >
            <MissionControlCard />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
