'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import ClientSidebar from './ClientSidebar'
import ClientTopbar from './ClientTopbar'
import { CLIENT_NAV } from './ClientNav'
import type { ClientSession } from '@/lib/auth/types'

interface Props {
  children: React.ReactNode
  session:  ClientSession
}

export default function ClientShell({ children, session }: Props) {
  const [sideOpen, setSideOpen] = useState(false)
  const pathname = usePathname()

  const current = CLIENT_NAV.find((n) => pathname === n.href || pathname.startsWith(n.href + '/'))

  return (
    <div className="flex h-screen overflow-hidden bg-[#070707]">
      <ClientSidebar
        open={sideOpen}
        onClose={() => setSideOpen(false)}
        plan={session.plan}
        businessName={session.businessName}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <ClientTopbar
          title={current?.label ?? 'Dashboard'}
          session={session}
          onMenuToggle={() => setSideOpen((o) => !o)}
        />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="max-w-[1200px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
