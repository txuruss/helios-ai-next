'use client'

import Nav from './Nav'
import Hero from './Hero'
import PricingSection from './PricingSection'
import FAQSection from './FAQSection'
import Footer from './Footer'
import Link from 'next/link'
import { motion } from 'framer-motion'

// ─── Problem Section ──────────────────────────────────────────────
const PROBLEMS = [
  {
    n: '01', title: 'Missed Leads',
    copy: 'Customers message, call, or fill out forms — but slow replies push them to book somewhere else.',
    cost: 'A single unanswered inquiry can mean a $120 booking gone to a competitor who replies first.',
  },
  {
    n: '02', title: 'Slow Replies',
    copy: 'Owners burn hours checking availability, answering repeat questions, and confirming appointments by hand.',
    cost: 'Studies show inquiries are 7× more likely to convert when replied to within 5 minutes. Most local businesses take 60+.',
  },
  {
    n: '03', title: 'Manual Follow-Up',
    copy: 'Leads, bookings, notes, follow-ups, and client updates are scattered across too many apps.',
    cost: 'Without one system, 40% of warm leads never get a second touch — recurring revenue leaking every week.',
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
            <span className="text-[#ffae3c]">reply too late</span>.
          </h2>
          <p className="text-[16px] text-[#9a9a9d]">
            Every unanswered message is a potential customer choosing another business. Helios AI helps you
            respond instantly, capture the lead, and move them into a booking flow before they disappear.
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
                          overflow-hidden min-h-[280px] flex flex-col justify-between gap-4
                          cursor-default"
            >
              {/* Hover glow */}
              <div className="absolute inset-0 bg-[radial-gradient(400px_200px_at_50%_-10%,rgba(255,122,24,0.18),transparent_60%)]
                              opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              <div>
                <div className="font-mono text-[12px] text-[#ffae3c] flex items-center gap-2.5 mb-4">
                  <span className="w-6 h-px bg-[#ff7a18]" />{p.n}
                </div>
                <h3 className="text-[24px] font-semibold">{p.title}</h3>
                <p className="mt-3 text-[14.5px] text-[#9a9a9d] leading-relaxed">{p.copy}</p>
              </div>
              {/* Hover reveal */}
              <div className="border-t border-dashed border-white/[0.08] pt-3.5 opacity-0 group-hover:opacity-100
                              transition-opacity duration-300 flex flex-col gap-1.5">
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#ffae3c]">The cost</div>
                <p className="text-[13.5px] text-[#f3f3f3] leading-relaxed">{p.cost}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-9 p-8 rounded-[18px] bg-gradient-to-b from-[#ff7a18]/10 to-[#ff7a18]/[0.03]
                        border border-[#ff7a18]/25 flex items-center gap-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-[#ff8a2a] to-[#b34800]
                          flex items-center justify-center shrink-0 shadow-glow-orange-sm text-2xl">
            ✦
          </div>
          <p className="text-[19px] font-medium text-white leading-relaxed">
            Helios AI fixes this by building connected AI systems around the way your business already works —
            no template tools, no generic chatbots.
          </p>
        </div>
      </div>
    </section>
  )
}

// ─── Services Section ─────────────────────────────────────────────
const SERVICES = [
  { icon: '⊕', badge: 'Start Here',    popular: false, title: 'AI Opportunity Audit',          desc: 'We review your workflow, website, booking process, and lead flow to find the highest-value automation opportunities.',  best: 'Owners unsure where to start',        outcome: 'Find the highest-value automation opportunities before building anything.' },
  { icon: '◉', badge: 'Most Popular',  popular: true,  title: 'Website + AI Booking System',   desc: 'A premium website connected to an AI assistant that answers questions, captures leads, checks availability, and books.',     best: 'Appointment-based businesses',        outcome: 'Turn your website into a 24/7 booking engine.' },
  { icon: '◎', badge: 'Core Feature',  popular: false, title: 'Lead Capture + Qualification',  desc: 'Capture customer details, score leads, organize inquiries, and route prospects into your dashboard automatically.',          best: 'High-volume inbound traffic',         outcome: 'Capture, score, and organize every inquiry automatically.' },
  { icon: '◈', badge: 'Ops Ready',     popular: false, title: 'Client Onboarding System',      desc: 'Collect business info, service details, FAQs, pricing, approvals, and project assets without constant follow-up.',           best: 'Agencies & service teams',            outcome: 'Collect client information and approvals without chasing people.' },
  { icon: '⊞', badge: 'Enterprise',    popular: false, title: 'AI Agent Automation',           desc: 'Specialized AI agents handle lead qualification, proposals, onboarding, booking setup, reporting, and client follow-ups.',   best: 'Multi-location operations',           outcome: 'Let specialized agents handle repetitive sales, booking, and support tasks.' },
  { icon: '⊟', badge: 'Live Data',     popular: false, title: 'Operations Dashboard',          desc: 'A Mission Control dashboard for tracking leads, bookings, clients, AI agents, project delivery, and business analytics.',   best: 'Owners who want one view',            outcome: 'See leads, clients, bookings, agents, and performance in one place.' },
]

function ServicesSection() {
  return (
    <section className="section-base" id="services">
      <div className="max-w-[1280px] mx-auto px-7 border-t border-white/[0.06] pt-28">
        <div className="flex flex-col gap-3.5 mb-14 max-w-[760px]">
          <span className="eyebrow">What Helios AI Builds</span>
          <h2 className="text-[clamp(28px,3.5vw,44px)] font-semibold tracking-tight leading-[1.08]">
            Six systems. One outcome. A business that runs smarter.
          </h2>
          <p className="text-[16px] text-[#9a9a9d]">
            Pick a single system or stack them into a complete AI operations layer for your business.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {SERVICES.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.07 }}
              className={`group relative border rounded-[18px] p-7 flex flex-col gap-3.5
                          transition-all duration-300 hover:-translate-y-1
                          ${s.popular
                            ? 'border-[#ff7a18]/40 bg-[#0f1012]/60'
                            : 'border-white/10 bg-[#0f1012]/60 hover:border-[#ff7a18]/40'
                          }`}
            >
              <span className={`absolute top-4 right-4 text-[10.5px] font-medium px-2.5 py-1.5 rounded-full tracking-[0.04em]
                                ${s.popular
                                  ? 'bg-gradient-to-b from-[#ff8a2a] to-[#ee6a0c] text-[#1a0c00]'
                                  : 'bg-white/[0.06] border border-white/10 text-[#9a9a9d]'
                                }`}>
                {s.badge}
              </span>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl
                              bg-[#ff7a18]/[0.15] border border-[#ff7a18]/25 text-[#ffae3c]">
                {s.icon}
              </div>
              <h3 className="text-[22px] font-semibold mt-1.5">{s.title}</h3>
              <p className="text-[14.5px] text-[#9a9a9d] flex-1">{s.desc}</p>
              <div className="flex flex-col gap-2.5">
                <div className="p-2.5 rounded-[10px] bg-white/[0.025] border border-white/[0.06] flex flex-col gap-0.5">
                  <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#6a6a6e]">Best for</span>
                  <span className="text-[13px] text-[#f3f3f3]">{s.best}</span>
                </div>
                <div className="p-2.5 rounded-[10px] bg-[#ff7a18]/[0.08] border border-[#ff7a18]/20 flex flex-col gap-0.5">
                  <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#ffae3c]">Outcome</span>
                  <span className="text-[13px] text-[#f3f3f3]">{s.outcome}</span>
                </div>
              </div>
              <Link href="/login"
                className="flex items-center gap-2 text-[13px] text-[#9a9a9d] pt-2 border-t border-white/[0.06]
                           group-hover:text-[#ffae3c] transition-colors">
                Learn More
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Process Section ──────────────────────────────────────────────
const STEPS = [
  { n: '01', title: 'Audit',    copy: 'We review your website, lead flow, booking process, customer messages, and operational bottlenecks.' },
  { n: '02', title: 'Build',    copy: 'We create the AI assistant, booking flow, lead capture system, and dashboard around your actual business.' },
  { n: '03', title: 'Deploy',   copy: 'We connect your system to your website, forms, calendar, WhatsApp, notifications, and client workflow.' },
  { n: '04', title: 'Optimize', copy: 'We monitor results, improve prompts, fix missed questions, and send performance reports monthly.' },
]

function ProcessSection() {
  return (
    <section className="section-base" id="process">
      <div className="max-w-[1280px] mx-auto px-7 border-t border-white/[0.06] pt-28">
        <div className="flex flex-col gap-3.5 mb-14 max-w-[760px]">
          <span className="eyebrow">How Helios AI Works</span>
          <h2 className="text-[clamp(28px,3.5vw,44px)] font-semibold tracking-tight leading-[1.08]">
            Four steps from audit to live system.
          </h2>
          <p className="text-[16px] text-[#9a9a9d]">
            A predictable build process — most clients are live within 4 to 6 weeks.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0 relative">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              className="group px-5 flex flex-col gap-3.5 text-left"
            >
              <div className="w-[68px] h-[68px] rounded-full border border-white/10 bg-radial-gradient
                              flex items-center justify-center font-mono text-[20px] font-semibold text-[#6a6a6e]
                              transition-all duration-300 group-hover:border-[#ff7a18] group-hover:text-[#ffae3c]
                              group-hover:shadow-[0_0_28px_rgba(255,122,24,0.4)]
                              relative z-10"
                   style={{ background: 'radial-gradient(circle at 30% 30%, #1a1b1f, #0a0a0c)' }}>
                {s.n}
              </div>
              <h3 className="text-[19px] font-semibold text-[#9a9a9d] group-hover:text-white transition-colors">{s.title}</h3>
              <p className="text-[14px] text-[#6a6a6e]">{s.copy}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Social Proof Strip ───────────────────────────────────────────
const PROOF = [
  { v: '24/7',    l: 'AI replies'              },
  { v: '1',       l: 'Dashboard for all leads' },
  { v: '7-day',   l: 'Launch support'          },
  { v: 'Monthly', l: 'Optimization'            },
  { v: 'Built for', l: 'Service businesses'    },
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

// ─── CTA Section ──────────────────────────────────────────────────
function CTASection() {
  return (
    <section className="section-base" id="contact">
      <div className="max-w-[1280px] mx-auto px-7 border-t border-white/[0.06] pt-28">
        <div className="text-center flex flex-col items-center gap-6 max-w-[700px] mx-auto">
          <span className="eyebrow">Work With Us</span>
          <h2 className="text-[clamp(28px,3.5vw,44px)] font-semibold tracking-tight leading-[1.08]">
            Ready to turn missed leads into booked customers?
          </h2>
          <p className="text-[16px] text-[#9a9a9d]">
            Tell us about your business and we&apos;ll recommend the best AI system for your workflow.
            No obligation — just a clear picture of what&apos;s possible.
          </p>
          <div className="flex gap-3 flex-wrap justify-center">
            <Link href="/login" className="btn-primary">
              Book a Strategy Call
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
            </Link>
            <Link href="/signup" className="btn-ghost">
              Create Account
            </Link>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 justify-center mt-2">
            {['Built for local service businesses', 'No generic chatbot setup', 'Monthly optimization available'].map((t) => (
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
        <ServicesSection />
        <ProcessSection />
        <SocialProofStrip />
        <PricingSection />
        <FAQSection />
        <CTASection />
      </main>
      <Footer />
    </>
  )
}
