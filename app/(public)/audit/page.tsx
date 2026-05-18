import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/landing/Nav'
import Footer from '@/components/landing/Footer'

export const metadata: Metadata = {
  title: 'Free Business Audit | Helios AI',
  description:
    'Get a free AI-powered audit of your booking flow, lead capture, and website. See exactly where you are losing customers.',
}

const WHAT_YOU_GET = [
  'Where customers drop off before booking',
  'Specific lead capture gaps in your current setup',
  'How your website chat and WhatsApp could capture more leads',
  'Estimated monthly booking lift after installing Helios AI',
  'Recommended plan based on your business profile',
]

export default function AuditPage() {
  return (
    <>
      <Nav />
      <main className="pt-32 pb-24">
        <section className="max-w-[920px] mx-auto px-7 text-center flex flex-col gap-4">
          <span className="eyebrow mx-auto">Free Business Audit</span>
          <h1 className="text-[clamp(34px,4vw,52px)] font-semibold tracking-tight leading-[1.05]">
            See exactly where your business is losing customers.
          </h1>
          <p className="text-[16px] text-[#9a9a9d] max-w-[640px] mx-auto">
            Our AI audit reviews your website, booking flow, and online presence, then sends you a clean report.
            No commitment. No payment required.
          </p>
        </section>

        <section className="max-w-[920px] mx-auto px-7 mt-12">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#0f1012]/80 to-[#0a0a0c]/80
                          p-8 flex flex-col gap-6">
            <div>
              <div className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#ffae3c] mb-2">
                What is included
              </div>
              <ul className="flex flex-col gap-2.5">
                {WHAT_YOU_GET.map((item) => (
                  <li key={item} className="flex gap-3 items-start text-[14.5px] text-[#f3f3f3]">
                    <span className="w-4 h-4 rounded-full border border-[#22d093]/40 bg-[#22d093]/[0.10]
                                     flex items-center justify-center shrink-0 mt-0.5">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#22d093" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m4 12 5 5 11-12"/>
                      </svg>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-white/[0.08] pt-5 flex flex-col gap-3">
              <div className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#9a9a9d]">
                How long it takes
              </div>
              <p className="text-[14.5px] text-[#f3f3f3]">
                You fill out a 3-minute form. Our team reviews your audit within one business day and sends you the report by email.
              </p>
            </div>

            <Link href="/register-business?from=audit"
              className="btn-primary justify-center text-center mt-4 self-stretch">
              Start My Free Business Audit
            </Link>

            <p className="text-[12px] text-[#6a6a6e] text-center">
              No credit card required. We only ask for what we need to build your report.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
