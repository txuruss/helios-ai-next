import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/landing/Nav'
import Footer from '@/components/landing/Footer'

export const metadata: Metadata = {
  title: 'Registration Received | Helios AI',
  description: 'Your business audit is queued. We will review and send your report shortly.',
}

export default async function SubmittedPage({
  searchParams,
}: {
  searchParams: Promise<{ audit?: string }>
}) {
  const params = await searchParams
  return (
    <>
      <Nav />
      <main className="pt-32 pb-24">
        <section className="max-w-[680px] mx-auto px-7 text-center flex flex-col items-center gap-6">
          <div className="w-16 h-16 rounded-full border border-[#22d093]/30 bg-[#22d093]/[0.08] flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22d093" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m4 12 5 5 11-12"/></svg>
          </div>

          <h1 className="text-[clamp(28px,3.5vw,42px)] font-semibold tracking-tight leading-[1.05]">
            We have your registration.
          </h1>

          <p className="text-[15.5px] text-[#9a9a9d] max-w-[520px]">
            Your audit is queued. Our team is reviewing your business and we will email your report within one business day.
          </p>

          {params.audit && (
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-2.5 font-mono text-[12px] text-[#9a9a9d]">
              Audit reference: <span className="text-white">{params.audit}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-3 justify-center mt-4">
            <Link href="/" className="btn-ghost">Back to home</Link>
            <Link href="/how-it-works" className="btn-primary">See How It Works</Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
