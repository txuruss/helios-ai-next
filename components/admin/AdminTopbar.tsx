'use client'

import { useState } from 'react'
import { logout } from '@/lib/auth/actions'
import { Menu, ChevronDown, LogOut, ShieldAlert } from 'lucide-react'
import type { TeamSession } from '@/lib/auth/types'
import { adminRoleLabel } from '@/lib/auth/permissions'

interface Props {
  title:        string
  session:      TeamSession
  onMenuToggle: () => void
}

export default function AdminTopbar({ title, session, onMenuToggle }: Props) {
  const [open, setOpen] = useState(false)

  const roleLabel = adminRoleLabel(session.role)
  const initials = (session.fullName ?? session.email)
    .split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()

  return (
    <header className="h-[60px] shrink-0 flex items-center justify-between gap-4 px-5
                        bg-[#08090a]/95 border-b border-white/[0.06] sticky top-0 z-20
                        backdrop-blur-md">
      <div className="flex items-center gap-3 min-w-0">
        <button onClick={onMenuToggle}
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0
                     bg-white/[0.03] border border-white/[0.06] text-[#9a9a9d]
                     hover:bg-white/[0.06] hover:text-white transition-all lg:hidden">
          <Menu size={18} />
        </button>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[13px] text-[#6a6a6e] hidden sm:inline">Admin</span>
          <span className="text-[#6a6a6e] text-[12px] hidden sm:inline">/</span>
          <span className="text-[14px] font-semibold text-white truncate">{title}</span>
        </div>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        <div className="hidden sm:flex items-center gap-1.5 text-[11.5px] text-[#ffae3c]
                        px-2.5 py-1.5 rounded-full border border-[#ff7a18]/30 bg-[#ff7a18]/[0.08]">
          <ShieldAlert size={12} />
          {roleLabel}
        </div>

        <div className="relative">
          <button onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 px-1.5 pr-2.5 py-1 rounded-full
                       border border-white/10 bg-white/[0.025]
                       hover:bg-white/[0.04] transition-all">
            <div className="w-7 h-7 rounded-full bg-gradient-to-b from-[#ff8a2a] to-[#b34800]
                            flex items-center justify-center text-[10.5px] font-semibold text-white shrink-0">
              {initials}
            </div>
            <div className="hidden sm:flex flex-col items-start leading-none">
              <span className="text-[13px] font-medium text-white">{(session.fullName ?? session.email).split(' ')[0]}</span>
              <span className="text-[10.5px] text-[#6a6a6e]">{roleLabel}</span>
            </div>
            <ChevronDown size={12} className="text-[#6a6a6e]" />
          </button>

          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <div className="absolute right-0 top-[calc(100%+8px)] min-w-[220px] z-20
                              bg-[#101214] border border-white/10 rounded-2xl overflow-hidden
                              shadow-[0_20px_60px_rgba(0,0,0,0.7)]">
                <div className="font-mono text-[11.5px] text-[#6a6a6e] px-3.5 py-3 border-b border-white/[0.06] truncate">
                  {session.email}
                </div>
                <form action={logout}>
                  <button type="submit"
                    className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[13.5px]
                               text-[#9a9a9d] hover:bg-[#ff6a5a]/[0.08] hover:text-[#ff6a5a] transition-colors">
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
