import type { Metadata } from 'next'
import Link from 'next/link'
import DemoWidgetSandbox from './DemoWidgetSandbox'

export const metadata: Metadata = {
  title: 'Widget Sandbox — Helios AI Demo',
  description: 'Try the Helios AI chat widget sandbox. No real messages or data are sent.',
}

export default function DemoWidgetPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0c]">
      {/* Nav */}
      <div className="flex items-center justify-between px-7 py-5 border-b border-white/[0.06] max-w-[1280px] mx-auto">
        <Link href="/" className="flex items-center gap-2.5 text-[14.5px] font-semibold text-white hover:opacity-80 transition-opacity">
          <span className="w-7 h-7 rounded-[7px] bg-[#ff7a18]/20 border border-[#ff7a18]/30 flex items-center justify-center text-[#ffae3c] text-[13px]">⚙</span>
          Helios AI
        </Link>
        <div className="flex gap-3">
          <Link href="/demo" className="text-[13px] text-[#9a9a9d] hover:text-white transition-colors">
            ← Back to Demo
          </Link>
          <Link href="/login" className="h-9 px-4 rounded-[10px] text-[13px] font-medium bg-gradient-to-b from-[#ff8a2a] to-[#ee6a0c] text-[#1a0c00] hover:opacity-90 transition-opacity">
            Book a Demo
          </Link>
        </div>
      </div>

      <main className="max-w-[720px] mx-auto px-7 py-14">
        <div className="text-center mb-10">
          <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#3b9eff] border border-[#3b9eff]/30 bg-[#3b9eff]/[0.06] px-3 py-1.5 rounded-full mb-5">
            Widget Sandbox
          </span>
          <h1 className="text-[clamp(24px,3.5vw,40px)] font-semibold tracking-tight text-white mb-3">
            Try the AI chat widget
          </h1>
          <p className="text-[14.5px] text-[#9a9a9d] leading-relaxed">
            This is a sandbox demo for <strong className="text-white">Elite Cuts Barbershop</strong>.
            No real messages, bookings, or payments are sent.
          </p>
        </div>

        {/* Warning banner */}
        <div className="border border-[#ffae3c]/20 rounded-xl px-4 py-3 bg-[#ffae3c]/[0.05] mb-8 text-center">
          <p className="text-[12.5px] text-[#ffae3c]">
            ⚠ Demo sandbox — mocked replies only. No external APIs are called.
          </p>
        </div>

        <DemoWidgetSandbox />

        <div className="mt-10 text-center">
          <p className="text-[13px] text-[#6a6a6e] mb-4">Ready to install this on your real website?</p>
          <Link href="/login" className="inline-flex items-center gap-2 h-10 px-6 rounded-full text-[13.5px] font-medium bg-gradient-to-b from-[#ff8a2a] to-[#ee6a0c] text-[#1a0c00] hover:opacity-90 transition-opacity">
            Book a Demo →
          </Link>
        </div>
      </main>
    </div>
  )
}
