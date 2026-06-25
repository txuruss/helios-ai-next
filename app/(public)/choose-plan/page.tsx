import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/landing/Nav'
import Footer from '@/components/landing/Footer'
import { PRICING_TIERS } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Choose Your Plan | Helios AI',
  description:
    'Pick the Helios AI plan that fits your business — Starter, Booking OS, or Helios AIOS. We install everything for you.',
}

export default function ChoosePlanPage() {
  return (
    <>
      <Nav />
      <main className="pt-32 pb-24">
        <section className="max-w-[1280px] mx-auto px-7 text-center flex flex-col gap-4">
          <span className="eyebrow mx-auto">Choose Your Plan</span>
          <h1 className="text-[clamp(34px,4vw,52px)] font-semibold tracking-tight leading-[1.05] max-w-[820px] mx-auto">
            Pick the system that fits your business.
          </h1>
          <p className="text-[16px] text-[#9a9a9d] max-w-[640px] mx-auto">
            All plans include a free business audit and complete installation by our team.
          </p>
        </section>

        <section className="max-w-[1280px] mx-auto px-7 mt-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
            {PRICING_TIERS.map((tier) => (
              <div key={tier.id}
                className={`relative rounded-3xl p-7 flex flex-col gap-5 border transition-all
                  ${tier.featured
                    ? 'border-[#ff7a18]/55 bg-gradient-to-b from-[#ff7a18]/13 to-[#0f1012]/85 shadow-[0_50px_100px_-30px_rgba(255,122,24,0.55)]'
                    : 'border-white/10 bg-[#0f1012]/60 hover:border-white/[0.14]'}`}>

                {'badge' in tier && tier.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[11px] font-semibold px-4 py-1.5 rounded-full
                                    bg-gradient-to-b from-[#ff8a2a] to-[#ee6a0c] text-[#1a0c00] tracking-[0.04em] whitespace-nowrap">
                    {tier.badge as string}
                  </span>
                )}

                <div>
                  <div className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#ffae3c]">
                    {tier.name}
                  </div>
                  <p className="text-[14px] text-[#9a9a9d] mt-1">{tier.tagline}</p>
                </div>

                <div className="border-y border-white/[0.06] py-3.5 flex flex-col gap-2">
                  <div className="flex justify-between text-[13px]">
                    <span className="text-[11px] uppercase tracking-[0.08em] text-[#6a6a6e]">Setup</span>
                    <span className="font-mono text-white">{tier.setupRange}</span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-[11px] uppercase tracking-[0.08em] text-[#6a6a6e]">Monthly</span>
                    <span className="font-mono text-[#ffae3c]">{tier.monthlyRange}</span>
                  </div>
                </div>

                <ul className="flex flex-col gap-2.5 flex-1">
                  {tier.features.slice(0, 6).map((f) => (
                    <li key={f} className="flex gap-2.5 items-start text-[13.5px] text-[#f3f3f3]">
                      <span className="w-3.5 h-3.5 rounded-full border border-[#ff7a18]/40
                                        bg-[#ff7a18]/15 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link href={`/register-business?plan=${tier.internalPlan}`}
                  className={`inline-flex items-center justify-center h-12 px-6 rounded-full font-semibold text-[14px] transition-all
                    ${tier.featured ? 'btn-primary' : 'btn-ghost'}`}>
                  Continue with {tier.name}
                </Link>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <p className="text-[13px] text-[#9a9a9d]">
              Not sure yet?{' '}
              <Link href="/audit" className="text-[#ffae3c] hover:underline">
                Start with a free audit
              </Link>
              {' '}— we will recommend the right plan.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
