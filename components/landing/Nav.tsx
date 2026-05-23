'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@/components/ui/cn'
import { NAV_LINKS } from '@/lib/constants'

export default function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav className="fixed top-3.5 left-0 right-0 z-50 flex justify-center px-4">
      <div
        className={cn(
          'flex items-center gap-7 h-[60px] pl-5 pr-3.5',
          'border border-white/10 rounded-full',
          'transition-all duration-200',
          scrolled
            ? 'bg-[#08080a]/85 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)]'
            : 'bg-[#0c0c0e]/70 backdrop-blur-lg shadow-[0_10px_40px_rgba(0,0,0,0.35)]',
        )}
      >
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 font-semibold text-[15px] shrink-0">
          <span
            className="w-[30px] h-[30px] rounded-[8px] bg-[#0a0a0c] bg-center bg-contain bg-no-repeat"
            style={{
              backgroundImage: 'url(/assets/helios-logo.png)',
              boxShadow: '0 0 22px rgba(255,122,24,0.5)',
            }}
          />
          Helios AI
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex gap-1">
          {NAV_LINKS.filter((link) => link.href !== '/audit').map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[13.5px] text-[#9a9a9d] px-3.5 py-2 rounded-full
                         transition-colors duration-150 hover:text-white hover:bg-white/[0.04]"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* CTA */}
        <Link href="/audit" className="btn-primary btn-sm ml-auto shrink-0">
          Get Free Audit
        </Link>
      </div>

      {/* Mobile menu — simplified */}
      {menuOpen && (
        <div className="absolute top-[72px] left-4 right-4 rounded-2xl border border-white/10
                        bg-[#0c0c0e]/95 backdrop-blur-xl p-4 flex flex-col gap-1 md:hidden">
          {NAV_LINKS.filter((link) => link.href !== '/audit').map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[14px] text-[#9a9a9d] px-4 py-2.5 rounded-xl
                         transition-colors hover:text-white hover:bg-white/[0.04]"
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <Link href="/audit" className="btn-primary btn-sm mt-2 w-full justify-center">
            Get Free Audit
          </Link>
        </div>
      )}
    </nav>
  )
}
