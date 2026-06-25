import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/landing/Nav'
import Footer from '@/components/landing/Footer'
import PricingSection from '@/components/landing/PricingSection'

export const metadata: Metadata = {
  title: 'Pricing | Helios AI',
  description:
    'Helios AI installs AI booking systems for local businesses. Choose Starter, Booking OS, or Helios AIOS — flat setup plus monthly retainer.',
}

export default function PricingPage() {
  return (
    <>
      <Nav />
      <main className="pt-32">
        <section className="max-w-[1280px] mx-auto px-7 pb-10 text-center flex flex-col gap-4">
          <span className="eyebrow mx-auto">Pricing</span>
          <h1 className="text-[clamp(34px,4vw,52px)] font-semibold tracking-tight leading-[1.05] max-w-[820px] mx-auto">
            Built and installed for you. No DIY setup.
          </h1>
          <p className="text-[16px] text-[#9a9a9d] max-w-[640px] mx-auto">
            Every plan includes a free business audit, complete setup, and monthly optimization.
            Choose the system that fits your business today — upgrade any time.
          </p>
          <div className="flex gap-3 flex-wrap justify-center mt-2">
            <Link href="/audit" className="btn-primary">Start Free Business Audit</Link>
            <Link href="/choose-plan" className="btn-ghost">Choose Your Plan</Link>
          </div>
        </section>

        <PricingSection />
      </main>
      <Footer />
    </>
  )
}
