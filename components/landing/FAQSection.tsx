'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

const FAQS = [
  {
    q: 'Is Helios AI just a chatbot?',
    a: 'No. Helios AI builds connected systems that can include a website, AI assistant, lead capture flow, booking automation, client onboarding, WhatsApp automation, and an operations dashboard.',
  },
  {
    q: 'Can this work for my business?',
    a: 'Helios AI is designed for local service businesses that receive inquiries, appointments, bookings, or customer questions — barbershops, beauty studios, spas, fitness, home services, auto, and clinics.',
  },
  {
    q: 'Do I need an existing website?',
    a: 'No. Helios AI can improve your existing website or build a new website with the AI system included.',
  },
  {
    q: 'Can it connect to WhatsApp?',
    a: 'Yes. WhatsApp automation can be included depending on the business workflow and integration requirements.',
  },
  {
    q: 'How long does setup take?',
    a: 'Simple systems can be launched faster, while full dashboards and multi-agent systems take longer. The timeline depends on the workflow, integrations, and content needed.',
  },
  {
    q: 'What happens after launch?',
    a: 'Helios AI can monitor performance, improve prompts, fix missed questions, review bookings, and send monthly optimization reports.',
  },
]

export default function FAQSection() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <section className="section-base" id="faq">
      <div className="max-w-[1280px] mx-auto px-7 border-t border-white/[0.06] pt-28">
        <div className="flex flex-col gap-3.5 mb-14 max-w-[760px]">
          <span className="eyebrow">Frequently Asked</span>
          <h2 className="text-[clamp(28px,3.5vw,44px)] font-semibold tracking-tight leading-[1.08]">
            Questions before you book.
          </h2>
          <p className="text-[16px] text-[#9a9a9d]">
            If your question isn&apos;t here, the strategy call is the fastest way to a real answer.
          </p>
        </div>

        <div className="rounded-[18px] border border-white/10 overflow-hidden mb-8">
          {FAQS.map((f, i) => (
            <button
              key={i}
              type="button"
              className={`w-full text-left border-b border-white/[0.06] last:border-0 transition-colors duration-200
                          ${open === i ? 'bg-[#ff7a18]/[0.04]' : 'bg-white/[0.012] hover:bg-white/[0.02]'}`}
              onClick={() => setOpen(open === i ? null : i)}
            >
              <div className="flex items-center gap-4 px-6 py-5">
                <span className="font-mono text-[11px] text-[#ffae3c] font-semibold shrink-0">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="flex-1 text-[16px] font-medium text-[#f3f3f3]">{f.q}</span>
                <span className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[18px] font-light
                                  border transition-all duration-200
                                  ${open === i
                                    ? 'bg-[#ff7a18]/12 border-[#ff7a18]/30 text-[#ffae3c]'
                                    : 'bg-white/[0.04] border-white/10 text-[#9a9a9d]'}`}>
                  {open === i ? '−' : '+'}
                </span>
              </div>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-5 pl-14 text-[14.5px] text-[#9a9a9d] leading-relaxed">
                      {f.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-center gap-5 p-7 rounded-xl
                        bg-white/[0.02] border border-white/[0.06] flex-wrap">
          <span className="text-[15px] text-[#9a9a9d]">Still have questions?</span>
          <Link href="/audit" className="btn-primary btn-sm">
            Start Free Audit
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
          </Link>
        </div>
      </div>
    </section>
  )
}
