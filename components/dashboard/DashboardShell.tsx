'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { DASHBOARD_NAV } from '@/lib/constants'
import type { Profile } from '@/types'

interface Props {
  children: React.ReactNode
  user: Profile
}

export default function DashboardShell({ children, user }: Props) {
  const [sideOpen, setSideOpen] = useState(false)
  const pathname = usePathname()

  const currentNav = DASHBOARD_NAV.find((n) =>
    n.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(n.href),
  )

  return (
    <div className="flex h-screen overflow-hidden bg-[#070707]">
      <Sidebar open={sideOpen} onClose={() => setSideOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar
          title={currentNav?.label ?? 'Dashboard'}
          user={user}
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
