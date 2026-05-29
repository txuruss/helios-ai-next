import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
         style={{ background: '#070707' }}>
      {/* Ambient glows */}
      <div className="absolute -top-[20%] -left-[10%] w-[600px] h-[600px] rounded-full pointer-events-none"
           style={{ background: 'radial-gradient(circle, rgba(255,122,24,0.18), transparent 70%)' }} />
      <div className="absolute -bottom-[15%] -right-[5%] w-[400px] h-[400px] rounded-full pointer-events-none"
           style={{ background: 'radial-gradient(circle, rgba(255,174,60,0.10), transparent 70%)' }} />

      <div className="relative z-10 w-full max-w-[440px] px-4 py-8 flex flex-col items-center gap-4">
        {children}

        <Link href="/" className="text-[13px] text-[#6a6a6e] hover:text-white transition-colors
                                   flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Back to Helios AI
        </Link>
      </div>
    </div>
  )
}
