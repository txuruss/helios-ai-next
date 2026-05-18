import type { Metadata } from 'next'
import Nav from '@/components/landing/Nav'
import Footer from '@/components/landing/Footer'
import RegistrationForm from './RegistrationForm'

export const metadata: Metadata = {
  title: 'Register Your Business | Helios AI',
  description:
    'Tell us about your business and we will run a free AI-powered audit to show where you are losing leads and bookings.',
}

export default async function RegisterBusinessPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; from?: string }>
}) {
  const params = await searchParams
  const planParam = params.plan === 'starter' || params.plan === 'pro' || params.plan === 'scale'
    ? params.plan
    : 'pro'

  return (
    <>
      <Nav />
      <main className="pt-32 pb-24">
        <section className="max-w-[760px] mx-auto px-7 text-center flex flex-col gap-3">
          <span className="eyebrow mx-auto">Business Registration</span>
          <h1 className="text-[clamp(28px,3.5vw,44px)] font-semibold tracking-tight leading-[1.05]">
            Tell us about your business
          </h1>
          <p className="text-[15px] text-[#9a9a9d]">
            Takes about 3 minutes. Our team reviews and sends your audit by email within one business day.
          </p>
        </section>

        <section className="max-w-[760px] mx-auto px-7 mt-10">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#0f1012]/85 to-[#0a0a0c]/85 p-7 sm:p-10">
            <RegistrationForm defaultPlan={planParam} />
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
