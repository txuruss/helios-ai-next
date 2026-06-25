import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/landing/Nav'
import Footer from '@/components/landing/Footer'

export const metadata: Metadata = {
  title: 'How It Works | Helios AI',
  description:
    'See how Helios AI installs an AI booking system for your business. From audit to launch in days, not months.',
}

const STAGES = [
  { n: '01', title: 'Free Business Audit',     desc: 'We analyze your website, booking flow, lead capture, and current conversation channels. You get a clear report with specific gaps and what we will fix.' },
  { n: '02', title: 'Choose Your Plan',        desc: 'Pick Starter, Booking OS, or Helios AIOS based on what your business needs today. We confirm scope before any work begins.' },
  { n: '03', title: 'Setup and Configuration', desc: 'We install the AI assistant on your website, configure WhatsApp, connect Cal.com, and load your services, hours, and FAQs.' },
  { n: '04', title: 'QA and Launch',           desc: 'Our delivery team runs full QA on the assistant, your booking flow, and your owner notifications before flipping it live.' },
  { n: '05', title: 'Monthly Optimization',    desc: 'You get monthly insights on what is converting, what to improve, and adjustments to the assistant prompts so results keep improving.' },
]

export default function HowItWorksPage() {
  return (
    <>
      <Nav />
      <main className="pt-32 pb-24">
        <section className="max-w-[1280px] mx-auto px-7 text-center flex flex-col gap-4">
          <span className="eyebrow mx-auto">How It Works</span>
          <h1 className="text-[clamp(34px,4vw,52px)] font-semibold tracking-tight leading-[1.05] max-w-[820px] mx-auto">
            From first message to booked appointment — automatically.
          </h1>
          <p className="text-[16px] text-[#9a9a9d] max-w-[640px] mx-auto">
            We install the entire system for you. You do not configure widgets or write prompts.
            You get a working assistant, a clean dashboard, and monthly improvements.
          </p>
        </section>

        <section className="max-w-[960px] mx-auto px-7 mt-16">
          <div className="flex flex-col">
            {STAGES.map((s, i) => (
              <div key={s.n} className="flex gap-6 py-7 border-b border-white/[0.06] last:border-b-0">
                <div className="flex flex-col items-center gap-2 shrink-0 w-12">
                  <div className="w-10 h-10 rounded-full border border-white/10 bg-[#0f1012]
                                  flex items-center justify-center font-mono text-[12px] text-[#ffae3c]">
                    {s.n}
                  </div>
                  {i < STAGES.length - 1 && <div className="w-px flex-1 bg-white/[0.06]" />}
                </div>
                <div className="flex flex-col gap-1 pt-1.5">
                  <h3 className="text-[20px] font-semibold">{s.title}</h3>
                  <p className="text-[14.5px] text-[#9a9a9d] leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 flex gap-3 flex-wrap justify-center">
            <Link href="/audit" className="btn-primary">Start Free Business Audit</Link>
            <Link href="/pricing" className="btn-ghost">View Pricing</Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
