import type { Metadata } from 'next'
import Link from 'next/link'
import DemoFlowClient from './DemoFlowClient'
import DemoWidgetSandbox from './widget/DemoWidgetSandbox'

export const metadata: Metadata = {
  title: 'See Helios AI in Action — Demo',
  description: 'Watch Helios AI capture leads, answer FAQs, and book appointments automatically.',
}

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0c]">
      {/* Nav */}
      <div className="flex items-center justify-between px-7 py-5 border-b border-white/[0.06] max-w-[1280px] mx-auto">
        <Link href="/" className="flex items-center gap-2.5 text-[14.5px] font-semibold text-white hover:opacity-80 transition-opacity">
          <span className="w-7 h-7 rounded-[7px] bg-[#ff7a18]/20 border border-[#ff7a18]/30 flex items-center justify-center text-[#ffae3c] text-[13px]">⚙</span>
          Helios AI
        </Link>
        <div className="flex gap-3">
          <Link href="/login" className="h-9 px-4 rounded-[10px] text-[13px] text-[#9a9a9d] border border-white/[0.10] hover:bg-white/[0.04] hover:text-white transition-all">
            Sign In
          </Link>
          <Link href="/login" className="h-9 px-4 rounded-[10px] text-[13px] font-medium bg-gradient-to-b from-[#ff8a2a] to-[#ee6a0c] text-[#1a0c00] hover:opacity-90 transition-opacity">
            Book a Demo
          </Link>
        </div>
      </div>

      <main className="max-w-[1280px] mx-auto px-7 py-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#ffae3c] border border-[#ffae3c]/30 bg-[#ffae3c]/[0.06] px-3 py-1.5 rounded-full mb-5">
            Demo — Elite Cuts Barbershop
          </span>
          <h1 className="text-[clamp(28px,4vw,52px)] font-semibold tracking-tight leading-[1.06] text-white mb-4">
            See Helios AI capture leads and book appointments
          </h1>
          <p className="text-[16px] text-[#9a9a9d] max-w-[580px] mx-auto leading-relaxed">
            This is a live demo for Elite Cuts Barbershop. No real messages, bookings, or payments are sent.
          </p>
        </div>

        {/* Demo Flow */}
        <DemoFlowClient />

        {/* Embedded widget sandbox */}
        <div className="mt-16 max-w-[640px] mx-auto">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[13px] font-semibold text-white">Try the AI Chat Widget</p>
            <span className="text-[10.5px] px-2.5 py-1 rounded-full border border-[#3b9eff]/30 bg-[#3b9eff]/[0.06] text-[#3b9eff]">
              Demo sandbox
            </span>
          </div>
          <DemoWidgetSandbox />
          <p className="text-center text-[11.5px] text-[#6a6a6e] mt-3">
            Demo sandbox — no real messages, bookings, emails, or payments are sent.
          </p>
        </div>

        {/* Static preview cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-16">
          {/* Website chat preview */}
          <div className="border border-white/10 rounded-2xl p-5 bg-[#0f1012]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6a6a6e] mb-4">Website Chat</p>
            <div className="flex flex-col gap-2.5 text-[12.5px]">
              {[
                { role: 'cust', text: 'Do you have openings Saturday?' },
                { role: 'ai',   text: 'Yes! 10 AM, 1 PM, and 3 PM. Which works?' },
                { role: 'cust', text: '1 PM please.' },
                { role: 'ai',   text: 'Confirmed for 1 PM Saturday. See you then!' },
              ].map((m, i) => (
                <div key={i} className={`flex gap-2 ${m.role === 'ai' ? '' : 'flex-row-reverse'}`}>
                  <div className={`max-w-[80%] rounded-xl px-3 py-2 border ${
                    m.role === 'ai'
                      ? 'bg-[#ff7a18]/[0.08] border-[#ff7a18]/20 text-white'
                      : 'bg-white/[0.04] border-white/[0.06] text-[#d0d0d3]'
                  }`}>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mission Control preview */}
          <div className="border border-white/10 rounded-2xl p-5 bg-[#0f1012]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6a6a6e] mb-4">Mission Control</p>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: 'New Leads',  value: '4',    color: '#22d093' },
                { label: 'Bookings',   value: '6',    color: '#3b9eff' },
                { label: 'Convs',      value: '2',    color: '#ffae3c' },
                { label: 'AI Status',  value: '✓ On', color: '#22d093' },
              ].map((s) => (
                <div key={s.label} className="border border-white/[0.06] rounded-xl p-3 bg-white/[0.02]">
                  <div className="text-[10px] text-[#6a6a6e] mb-1">{s.label}</div>
                  <div className="text-[18px] font-semibold" style={{ color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Owner notification */}
          <div className="border border-white/10 rounded-2xl p-5 bg-[#0f1012]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6a6a6e] mb-4">Owner Alert</p>
            <div className="border border-[#22d093]/20 rounded-xl p-4 bg-[#22d093]/[0.04]">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[14px]">🔔</span>
                <p className="text-[12.5px] font-semibold text-white">New Booking Request</p>
              </div>
              <p className="text-[12px] text-[#9a9a9d]">Marcus T. → Classic Haircut · Saturday 1:00 PM</p>
              <p className="text-[11px] text-[#22d093] mt-2">✓ AI replied and booking confirmed</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 text-center flex flex-col items-center gap-4">
          <h2 className="text-[24px] font-semibold text-white">Ready to set this up for your business?</h2>
          <p className="text-[14px] text-[#9a9a9d]">Book a free demo — we&apos;ll show you exactly how it works for your type of business.</p>
          <div className="flex gap-3 flex-wrap justify-center">
            <Link href="/login" className="h-11 px-6 rounded-full text-[14px] font-semibold bg-gradient-to-b from-[#ff8a2a] to-[#ee6a0c] text-[#1a0c00] hover:opacity-90 transition-opacity flex items-center gap-2">
              Book a Demo
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
            </Link>
            <Link href="/demo/widget" className="h-11 px-6 rounded-full text-[14px] text-[#9a9a9d] border border-white/[0.12] hover:bg-white/[0.04] hover:text-white transition-all flex items-center">
              Try the Widget Sandbox →
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
