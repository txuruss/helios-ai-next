import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/landing/Nav'
import Footer from '@/components/landing/Footer'

export const metadata: Metadata = {
  title: 'Industries We Serve | Helios AI',
  description:
    'Helios AI is purpose-built for appointment-based local service businesses. Barbershops, salons, spas, clinics, auto repair, and more.',
}

const INDUSTRIES = [
  { name: 'Barbershops',          desc: 'Capture walk-in and DM inquiries 24/7. Book cuts, beard trims, and packages without manual replies.' },
  { name: 'Beauty Salons & Spas', desc: 'Reply to service inquiries instantly, recommend services, and confirm appointments through Cal.com.' },
  { name: 'Auto Repair Shops',    desc: 'Answer service questions, capture vehicle details, and queue estimate requests to the owner.' },
  { name: 'Dental & Medical Clinics', desc: 'Capture appointment requests, qualify inquiries, and route urgent messages to the right team.' },
  { name: 'Fitness Studios',      desc: 'Book trials, answer pricing questions, and follow up with cold leads who never replied.' },
  { name: 'Home Services',        desc: 'Capture quote requests from leads who message at 9pm. Notify you the moment a hot lead comes in.' },
  { name: 'Restaurants & Hospitality', desc: 'Take reservation requests, answer hours and menu questions, and route private event bookings.' },
  { name: 'Local Retail',         desc: 'Reply to product availability inquiries, capture leads, and recommend in-store appointments.' },
]

export default function IndustriesPage() {
  return (
    <>
      <Nav />
      <main className="pt-32 pb-24">
        <section className="max-w-[1280px] mx-auto px-7 text-center flex flex-col gap-4">
          <span className="eyebrow mx-auto">Industries</span>
          <h1 className="text-[clamp(34px,4vw,52px)] font-semibold tracking-tight leading-[1.05] max-w-[820px] mx-auto">
            Built for appointment-based local businesses.
          </h1>
          <p className="text-[16px] text-[#9a9a9d] max-w-[640px] mx-auto">
            Helios AI is purpose-built for the way local service businesses actually work — not generic enterprise software.
          </p>
        </section>

        <section className="max-w-[1280px] mx-auto px-7 mt-14">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {INDUSTRIES.map((ind) => (
              <div key={ind.name}
                className="border border-white/10 rounded-2xl p-6 bg-gradient-to-b from-white/[0.018] to-transparent
                           hover:border-[#ff7a18]/30 transition-colors">
                <h3 className="text-[17px] font-semibold mb-2">{ind.name}</h3>
                <p className="text-[14px] text-[#9a9a9d] leading-relaxed">{ind.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 flex gap-3 flex-wrap justify-center">
            <Link href="/audit" className="btn-primary">Start Free Business Audit</Link>
            <Link href="/how-it-works" className="btn-ghost">See How It Works</Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
