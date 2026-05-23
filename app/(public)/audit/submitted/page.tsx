import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/landing/Nav'
import Footer from '@/components/landing/Footer'

export const metadata: Metadata = {
  title: 'Audit Received | Helios AI',
  description: 'Your audit request has been received. The next step is to schedule a call.',
}

export default async function AuditSubmittedPage({
  searchParams,
}: {
  searchParams: Promise<{ audit?: string }>
}) {
  const params = await searchParams
  const bookingLink = process.env.NEXT_PUBLIC_BOOKING_LINK

  return (
    <>
      <Nav />
      <main className="pt-32 pb-24">
        <section className="max-w-[680px] mx-auto px-7 text-center flex flex-col items-center gap-6">
          <div className="w-16 h-16 rounded-full border border-[#22d093]/30 bg-[#22d093]/[0.08] flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22d093" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m4 12 5 5 11-12"/>
            </svg>
          </div>

          <h1 className="text-[clamp(28px,3.5vw,42px)] font-semibold tracking-tight leading-[1.05]">
            Your audit request has been received.
          </h1>

          <div className="flex flex-col gap-3 text-[15.5px] text-[#9a9a9d] max-w-[520px]">
            <p>We will review your business, website, and automation opportunities.</p>
            <p>
              The next step is to schedule a call so we can understand your business
              and recommend the right system.
            </p>
          </div>

          {params.audit && (
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-2.5 font-mono text-[12px] text-[#9a9a9d]">
              Audit reference: <span className="text-white">{params.audit}</span>
            </div>
          )}

          <div className="flex flex-col gap-3 mt-4 w-full max-w-[360px]">
            {bookingLink ? (
              <a
                href={bookingLink}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary justify-center text-center"
              >
                Schedule Your Audit Call
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M5 12h14M13 5l7 7-7 7"/>
                </svg>
              </a>
            ) : (
              <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-5 py-4 text-[14px] text-[#9a9a9d] text-center leading-relaxed">
                Your audit has been submitted. We will contact you to schedule the next step.
              </div>
            )}
            <Link href="/" className="btn-ghost justify-center text-center">
              Back to home
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
