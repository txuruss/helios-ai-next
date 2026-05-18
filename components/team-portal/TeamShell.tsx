'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import TeamSidebar from './TeamSidebar'
import TeamTopbar from './TeamTopbar'
import { TEAM_NAV } from './TeamNav'
import type { TeamSession } from '@/lib/auth/types'

interface Props {
  children: React.ReactNode
  session:  TeamSession
}

export default function TeamShell({ children, session }: Props) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const current = TEAM_NAV.find((n) => pathname === n.href || pathname.startsWith(n.href + '/'))

  return (
    <div className="flex h-screen overflow-hidden bg-[#070707]">
      <TeamSidebar
        open={open}
        onClose={() => setOpen(false)}
        role={session.role}
        fullName={session.fullName}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TeamTopbar
          title={current?.label ?? 'Team Ops'}
          session={session}
          onMenuToggle={() => setOpen((o) => !o)}
        />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="max-w-[1280px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
