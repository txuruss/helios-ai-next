'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import AdminSidebar from './AdminSidebar'
import AdminTopbar from './AdminTopbar'
import { adminNavForRole } from './AdminNav'
import type { TeamSession } from '@/lib/auth/types'

interface Props {
  children: React.ReactNode
  session:  TeamSession
}

export default function AdminShell({ children, session }: Props) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Role-scoped nav: outreach_agent sees only their two tools.
  const nav = adminNavForRole(session.role)
  const current = nav.find((n) => pathname === n.href || pathname.startsWith(n.href + '/'))

  return (
    <div className="flex h-screen overflow-hidden bg-[#070707]">
      <AdminSidebar
        open={open}
        onClose={() => setOpen(false)}
        items={nav}
        role={session.role}
        fullName={session.fullName}
        email={session.email}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AdminTopbar
          title={current?.label ?? 'Mission Control'}
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
