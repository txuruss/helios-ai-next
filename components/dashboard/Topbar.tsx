'use client'

import { useState } from 'react'
import Link from 'next/link'
import { logout } from '@/lib/auth/actions'
import { Menu, Bell, ChevronDown, Settings, LogOut } from 'lucide-react'
import type { Profile } from '@/types'

interface TopbarProps {
  title: string
  user: Profile | null
  onMenuToggle: () => void
}

export default function Topbar({ title, user, onMenuToggle }: TopbarProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const initials = (user?.full_name ?? user?.email ?? 'U')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <header className="h-[60px] shrink-0 flex items-center justify-between gap-4 px-5
                        bg-[#08090a]/95 border-b border-white/[0.06] sticky top-0 z-20
                        backdrop-blur-md">
      {/* Left */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuToggle}
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0
                     bg-white/[0.03] border border-white/[0.06] text-[#9a9a9d]
                     hover:bg-white/[0.06] hover:text-white transition-all lg:hidden"
          aria-label="Toggle sidebar"
        >
          <Menu size={18} />
        </button>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[13px] text-[#6a6a6e] hidden sm:inline whitespace-nowrap">Helios AI</span>
          <span className="text-[#6a6a6e] text-[12px] hidden sm:inline">/</span>
          <span className="text-[14px] font-semibold text-white truncate">{title}</span>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Status */}
        <div className="hidden sm:flex items-center gap-1.5 text-[11.5px] text-[#9a9a9d]
                        px-2.5 py-1.5 rounded-full border border-white/[0.06] bg-white/[0.02]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#22d093] animate-pulse-green" />
          All systems operational
        </div>

        {/* Notifications */}
        <button className="relative w-[34px] h-[34px] rounded-lg flex items-center justify-center
                           bg-white/[0.02] border border-white/[0.06] text-[#9a9a9d]
                           hover:text-white hover:bg-white/[0.05] transition-all">
          <Bell size={16} />
          <span className="absolute top-[7px] right-[7px] w-1.5 h-1.5 rounded-full bg-[#ff7a18]
                           shadow-[0_0_6px_#ff7a18]" />
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen((o) => !o)}
            className="flex items-center gap-2 px-1.5 pr-2.5 py-1 rounded-full
                       border border-white/10 bg-white/[0.025]
                       hover:bg-white/[0.04] transition-all"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-b from-[#ff8a2a] to-[#b34800]
                            flex items-center justify-center text-[10.5px] font-semibold text-white shrink-0">
              {initials}
            </div>
            <div className="hidden sm:flex flex-col items-start leading-none">
              <span className="text-[13px] font-medium text-white">{user?.full_name?.split(' ')[0] ?? 'Admin'}</span>
              <span className="text-[10.5px] text-[#6a6a6e]">{user?.role ?? 'Admin'}</span>
            </div>
            <ChevronDown size={12} className="text-[#6a6a6e]" />
          </button>

          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
              <div className="absolute right-0 top-[calc(100%+8px)] min-w-[200px] z-20
                              bg-[#101214] border border-white/10 rounded-2xl
                              shadow-[0_20px_60px_rgba(0,0,0,0.7)] overflow-hidden
                              animate-drop-in">
                <div className="font-mono text-[11.5px] text-[#6a6a6e] px-3.5 py-3 border-b border-white/[0.06] truncate">
                  {user?.email}
                </div>
                <Link
                  href="/dashboard/settings"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[13.5px]
                             text-[#9a9a9d] hover:bg-white/[0.04] hover:text-white transition-colors"
                >
                  <Settings size={13} />Settings
                </Link>
                <form action={logout}>
                  <button
                    type="submit"
                    className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[13.5px]
                               text-[#9a9a9d] hover:bg-[#ff6a5a]/[0.08] hover:text-[#ff6a5a] transition-colors"
                  >
                    <LogOut size={13} />Log Out
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
