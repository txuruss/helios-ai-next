import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="pt-20 pb-10 border-t border-white/[0.06] bg-[#050505]">
      <div className="max-w-[1280px] mx-auto px-7">
        {/* Tagline */}
        <div className="text-[clamp(36px,4.5vw,54px)] font-semibold tracking-tight leading-none mb-14 gradient-text">
          Turn messages<br />into bookings.
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          {/* Brand */}
          <div className="flex flex-col gap-3.5 max-w-[340px]">
            <Link href="/" className="flex items-center gap-2.5 font-semibold text-[15px]">
              <span
                className="w-[28px] h-[28px] rounded-[7px] bg-[#0a0a0c] bg-center bg-contain bg-no-repeat shrink-0"
                style={{
                  backgroundImage: 'url(/assets/helios-logo.png)',
                  boxShadow: '0 0 18px rgba(255,122,24,0.45)',
                }}
              />
              Helios AI
            </Link>
            <p className="text-[14px] text-[#9a9a9d] leading-relaxed">
              Practical AI systems for local service businesses — lead capture, AI booking, WhatsApp automation, and operations dashboards.
            </p>
            <Link href="/login" className="btn-primary btn-sm self-start mt-2">
              Book a Strategy Call
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
            </Link>
          </div>

          {/* Services */}
          <div>
            <h5 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ffae3c] mb-4">Services</h5>
            <ul className="flex flex-col gap-2.5">
              {['AI Opportunity Audit', 'Website + AI Booking', 'Lead Capture', 'Client Onboarding', 'AI Agent Automation', 'Operations Dashboard'].map((s) => (
                <li key={s}>
                  <a href="#services" className="text-[13.5px] text-[#9a9a9d] hover:text-white transition-colors">{s}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Platform */}
          <div>
            <h5 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ffae3c] mb-4">Platform</h5>
            <ul className="flex flex-col gap-2.5">
              {['Mission Control', 'Ops Center', 'AI Agent Hub', 'Product / AI Build', 'Clients', 'Analytics'].map((s) => (
                <li key={s}>
                  <Link href="/dashboard" className="text-[13.5px] text-[#9a9a9d] hover:text-white transition-colors">{s}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h5 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ffae3c] mb-4">Company</h5>
            <ul className="flex flex-col gap-2.5">
              {[
                { label: 'Case Studies', href: '#results' },
                { label: 'Process',     href: '#process' },
                { label: 'Pricing',     href: '#pricing' },
                { label: 'Contact',     href: '#contact' },
                { label: 'Sign In',     href: '/login'   },
              ].map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="text-[13.5px] text-[#9a9a9d] hover:text-white transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <a href="mailto:hello@helios.ai" className="text-[13.5px] text-[#9a9a9d] hover:text-white transition-colors">
                  hello@helios.ai
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/[0.06] pt-7 flex justify-between items-center flex-wrap gap-4">
          <span className="text-[12.5px] text-[#6a6a6e]">© 2026 Helios AI · Built in Jamaica</span>
          <span className="font-mono text-[12px] text-[#6a6a6e]">helios.ai / v2.0</span>
        </div>
      </div>
    </footer>
  )
}
