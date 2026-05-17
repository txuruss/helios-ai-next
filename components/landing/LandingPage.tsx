'use client'

import Nav from './Nav'
import Hero from './Hero'
import PricingSection from './PricingSection'
import FAQSection from './FAQSection'
import Footer from './Footer'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { capture } from '@/lib/analytics/posthog'

// ─── Problem Section ──────────────────────────────────────────────
const PROBLEMS = [
  {
    n: '01', title: 'Missed Messages',
    copy: 'Customers message your website or WhatsApp, but you\'re with a client. They don\'t wait — they book somewhere else.',
    cost: 'One unanswered inquiry can mean a $120+ booking gone to whoever replies first.',
  },
  {
    n: '02', title: 'Slow Replies',
    copy: 'Owners spend hours answering the same questions, checking availability, and confirming appointments by hand.',
    cost: 'Inquiries are 7× more likely to convert when replied to within 5 minutes. Most local businesses take 60+.',
  },
  {
    n: '03', title: 'Bookings Getting Lost',
    copy: 'Requests come in through DM, text, call, and form — scattered across apps with no central system.',
    cost: 'Without one place to track everything, 40% of warm leads never get a follow-up.',
  },
]

function ProblemSection() {
  return (
    <section className="section-base" id="problem">
      <div className="max-w-[1280px] mx-auto px-7 border-t border-white/[0.06] pt-28">
        <div className="flex flex-col gap-3.5 mb-14 max-w-[760px]">
          <span className="eyebrow">The Real Problem</span>
          <h2 className="text-[clamp(28px,3.5vw,44px)] font-semibold tracking-tight leading-[1.08]">
            Most local businesses aren&apos;t losing customers because of bad service.
            They&apos;re losing them because they{' '}
            <span className="text-[#ffae3c]">reply too late.</span>
          </h2>
          <p className="text-[16px] text-[#9a9a9d]">
            Every unanswered message is a potential customer choosing another business. Helios AI fixes this.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PROBLEMS.map((p, i) => (
            <motion.div
              key={p.n}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.08 }}
              className="group relative border border-white/10 rounded-[18px] p-7
                          bg-gradient-to-b from-white/[0.018] to-white/[0.005]
                          transition-all duration-300 hover:-translate-y-1 hover:border-[#ff7a18]/35
                          overflow-hidden min-h-[260px] flex flex-col justify-between gap-4"
            >
              <div className="absolute inset-0 bg-[radial-gradient(400px_200px_at_50%_-10%,rgba(255,122,24,0.18),transparent_60%)]
                              opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              <div>
                <div className="font-mono text-[12px] text-[#ffae3c] flex items-center gap-2.5 mb-4">
                  <span className="w-6 h-px bg-[#ff7a18]" />{p.n}
                </div>
                <h3 className="text-[22px] font-semibold">{p.title}</h3>
                <p className="mt-3 text-[14.5px] text-[#9a9a9d] leading-relaxed">{p.copy}</p>
              </div>
              <div className="border-t border-dashed border-white/[0.08] pt-3.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#ffae3c]">The cost</div>
                <p className="text-[13.5px] text-[#f3f3f3] leading-relaxed mt-1">{p.cost}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── How It Works ─────────────────────────────────────────────────
const HOW_STEPS = [
  { n: '01', icon: '💬', title: 'Customer messages you',         copy: 'A customer texts your WhatsApp or chats on your website — any time of day.' },
  { n: '02', icon: '⚡', title: 'Helios AI replies instantly',    copy: 'The AI answers their question, confirms your services, and starts the booking flow.' },
  { n: '03', icon: '📅', title: 'Booking details are captured',   copy: 'The customer shares their preferred service, time, and details — no back-and-forth.' },
  { n: '04', icon: '✅', title: 'Booking created or routed',      copy: 'The appointment is booked via Cal.com, or handed to you for manual confirmation.' },
  { n: '05', icon: '📊', title: 'You see everything in one place',copy: 'Mission Control shows leads, bookings, conversations, and AI status in one dashboard.' },
]

function HowItWorksSection() {
  return (
    <section className="section-base" id="how-it-works">
      <div className="max-w-[1280px] mx-auto px-7 border-t border-white/[0.06] pt-28">
        <div className="flex flex-col gap-3.5 mb-14 max-w-[760px]">
          <span className="eyebrow">How It Works</span>
          <h2 className="text-[clamp(28px,3.5vw,44px)] font-semibold tracking-tight leading-[1.08]">
            From first message to booked appointment — automatically.
          </h2>
          <p className="text-[16px] text-[#9a9a9d]">
            No complicated setup. No manual follow-up. Helios AI handles the conversation from start to finish.
          </p>
        </div>

        <div className="flex flex-col gap-0">
          {HOW_STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.07 }}
              className="flex gap-6 py-6 border-b border-white/[0.06] last:border-b-0 group"
            >
              <div className="flex flex-col items-center gap-2 shrink-0 w-12">
                <div className="w-10 h-10 rounded-full border border-white/10 bg-[#0f1012]
                                flex items-center justify-center text-[18px]
                                group-hover:border-[#ff7a18]/40 group-hover:shadow-[0_0_20px_rgba(255,122,24,0.3)]
                                transition-all duration-300">
                  {s.icon}
                </div>
                {i < HOW_STEPS.length - 1 && <div className="w-px flex-1 bg-white/[0.06]" />}
              </div>
              <div className="flex flex-col gap-1 pt-1.5">
                <div className="flex items-center gap-3">
                  <span className="text-[10.5px] font-mono text-[#ffae3c]">{s.n}</span>
                  <h3 className="text-[18px] font-semibold">{s.title}</h3>
                </div>
                <p className="text-[14.5px] text-[#9a9a9d] leading-relaxed max-w-[640px]">{s.copy}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Features Section ──────────────────────────────────────────────
const FEATURES = [
  { icon: '🌐', title: 'Website AI Chat',      desc: 'Answers questions, captures leads, and books appointments from your website — 24/7.' },
  { icon: '✆',  title: 'WhatsApp Assistant',   desc: 'Handles incoming WhatsApp messages automatically. No manual follow-up needed.' },
  { icon: '❓',  title: 'FAQ Answers',          desc: 'Trained on your services, pricing, hours, and policies — no more repetitive questions.' },
  { icon: '🎯',  title: 'Lead Capture',         desc: 'Collects name, contact, and service interest from every conversation.' },
  { icon: '📅',  title: 'Cal.com Booking',      desc: 'Checks real availability and books directly into your calendar.' },
  { icon: '🔔',  title: 'Owner Notifications',  desc: 'Alerts you instantly when a lead comes in or something needs your attention.' },
  { icon: '📊',  title: 'Mission Control',      desc: 'One dashboard for leads, bookings, conversations, and system status.' },
  { icon: '🤝',  title: 'Human Handoff',        desc: 'AI pauses and notifies you the moment a customer needs personal attention.' },
]

function FeaturesSection() {
  return (
    <section className="section-base" id="features">
      <div className="max-w-[1280px] mx-auto px-7 border-t border-white/[0.06] pt-28">
        <div className="flex flex-col gap-3.5 mb-14 max-w-[760px]">
          <span className="eyebrow">Features</span>
          <h2 className="text-[clamp(28px,3.5vw,44px)] font-semibold tracking-tight leading-[1.08]">
            Every tool you need. Nothing you don&apos;t.
          </h2>
          <p className="text-[16px] text-[#9a9a9d]">
            Helios AI is purpose-built for appointment-based local businesses — not enterprise teams, not generic chatbots.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="group border border-white/10 rounded-2xl p-5 flex flex-col gap-3
                          bg-gradient-to-b from-white/[0.018] to-transparent
                          hover:border-[#ff7a18]/35 hover:-translate-y-1 transition-all duration-300"
            >
              <div className="w-10 h-10 rounded-xl border border-[#ff7a18]/25 bg-[#ff7a18]/[0.12]
                              flex items-center justify-center text-[18px]">
                {f.icon}
              </div>
              <h3 className="text-[16px] font-semibold">{f.title}</h3>
              <p className="text-[13.5px] text-[#9a9a9d] leading-relaxed flex-1">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Trust and Safety ─────────────────────────────────────────────
const TRUST_ITEMS = [
  { icon: '🤝', title: 'Human Handoff',            desc: 'When a customer needs personal attention, AI pauses and notifies the owner instantly.' },
  { icon: '📋', title: 'Full Conversation Logs',   desc: 'Every message is saved. Nothing gets lost or forgotten.' },
  { icon: '✅', title: 'Booking Confirmation',     desc: 'Appointments aren\'t confirmed until service, time, and details are all verified.' },
  { icon: '🔔', title: 'Failed Message Alerts',    desc: 'If anything fails to send, you\'ll be notified immediately.' },
  { icon: '⏸',  title: 'AI Pause Mode',            desc: 'Pause the AI at any time and take over conversations manually.' },
  { icon: '🛡',  title: 'Owner Override Controls',  desc: 'You\'re always in control. The AI assists — it doesn\'t replace your judgment.' },
]

function TrustSafetySection() {
  return (
    <section className="section-base" id="trust">
      <div className="max-w-[1280px] mx-auto px-7 border-t border-white/[0.06] pt-28">
        <div className="flex flex-col gap-3.5 mb-14 max-w-[760px]">
          <span className="eyebrow">Trust & Safety</span>
          <h2 className="text-[clamp(28px,3.5vw,44px)] font-semibold tracking-tight leading-[1.08]">
            You&apos;re always in control. The AI just handles the repetitive work.
          </h2>
          <p className="text-[16px] text-[#9a9a9d]">
            Helios AI is designed with local business owners in mind — not set-it-and-forget-it. You can pause, override, and review at any time.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TRUST_ITEMS.map((t, i) => (
            <motion.div
              key={t.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.06 }}
              onClick={() => capture('trust_feature_viewed', { feature: t.title })}
              className="border border-white/[0.08] rounded-2xl p-5 flex gap-4 bg-white/[0.015]
                          hover:border-[#22d093]/30 hover:bg-[#22d093]/[0.03] transition-all duration-300 cursor-default"
            >
              <div className="w-9 h-9 rounded-xl border border-[#22d093]/20 bg-[#22d093]/[0.08]
                              flex items-center justify-center text-[16px] shrink-0">
                {t.icon}
              </div>
              <div>
                <h3 className="text-[15px] font-semibold">{t.title}</h3>
                <p className="text-[13px] text-[#9a9a9d] mt-1 leading-relaxed">{t.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Social Proof Strip ───────────────────────────────────────────
const PROOF = [
  { v: '< 1s',   l: 'Reply time'        },
  { v: '24/7',   l: 'Always available'  },
  { v: '1',      l: 'Dashboard for all' },
  { v: 'Human',  l: 'Handoff built-in'  },
  { v: 'Monthly', l: 'Optimization'     },
]

function SocialProofStrip() {
  return (
    <section className="py-14 bg-gradient-to-b from-[#080808] to-[#0a0a0c]">
      <div className="max-w-[1280px] mx-auto px-7">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5 p-7 rounded-[18px]
                        border border-white/10 bg-[#ff7a18]/[0.04]
                        shadow-[0_30px_70px_-40px_rgba(255,122,24,0.3)]">
          {PROOF.map((p, i) => (
            <div key={i} className={`flex items-center gap-3.5 px-1.5 ${i > 0 ? 'border-l border-white/[0.06]' : ''}`}>
              <div className="w-[42px] h-[42px] rounded-[11px] shrink-0 flex items-center justify-center text-[#ffae3c]
                              bg-[#ff7a18]/[0.18] border border-[#ff7a18]/25 text-lg">✦</div>
              <div>
                <div className="text-[18px] font-semibold text-white">{p.v}</div>
                <div className="text-[12px] text-[#9a9a9d] mt-0.5">{p.l}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Final CTA ────────────────────────────────────────────────────
function CTASection() {
  return (
    <section className="section-base" id="contact">
      <div className="max-w-[1280px] mx-auto px-7 border-t border-white/[0.06] pt-28">
        <div className="text-center flex flex-col items-center gap-6 max-w-[700px] mx-auto">
          <span className="eyebrow">Get Started</span>
          <h2 className="text-[clamp(28px,3.5vw,44px)] font-semibold tracking-tight leading-[1.08]">
            Ready to stop losing customers to slow replies?
          </h2>
          <p className="text-[16px] text-[#9a9a9d]">
            Book a free demo and we&apos;ll show you exactly how Helios AI works for your type of business.
          </p>
          <div className="flex gap-3 flex-wrap justify-center">
            <Link
              href="/login"
              className="btn-primary"
              onClick={() => capture('landing_cta_clicked', { source: 'bottom_cta', cta: 'book_demo' })}
            >
              Book a Demo
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
            </Link>
            <a
              href="#how-it-works"
              className="btn-ghost"
              onClick={() => capture('landing_cta_clicked', { source: 'bottom_cta', cta: 'see_how_it_works' })}
            >
              See How It Works
            </a>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 justify-center mt-2">
            {['Built for local service businesses', 'No setup without guidance', 'Human handoff included'].map((t) => (
              <span key={t} className="flex items-center gap-2 text-[13px] text-[#9a9a9d]">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22d093" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="m4 12 5 5 11-12"/></svg>
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Composition ──────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <ProblemSection />
        <HowItWorksSection />
        <FeaturesSection />
        <TrustSafetySection />
        <SocialProofStrip />
        <PricingSection />
        <FAQSection />
        <CTASection />
      </main>
      <Footer />
    </>
  )
}
