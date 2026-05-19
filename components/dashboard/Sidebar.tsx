'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/lib/auth/actions'
import { DASHBOARD_NAV, NAV_GROUPS } from '@/lib/constants'
import { cn } from '@/components/ui/cn'
import {
  LayoutDashboard, Inbox, Users, Calendar, Briefcase,
  Building2, Settings, LogOut, X,
} from 'lucide-react'
import InboxUnreadBadge from '@/app/dashboard/inbox/InboxUnreadBadge'

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  LayoutDashboard, Inbox, Users, Calendar, Briefcase, Building2, Settings,
}

const GROUP_LABELS: Record<string, string> = {
  Core:   'Core',
  Setup:  'Setup',
  System: 'System',
}

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname()

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/55 backdrop-blur-sm z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 bottom-0 w-[240px] z-40',
          'flex flex-col bg-gradient-to-b from-[#0c0d0f] to-[#080809]',
          'border-r border-white/[0.06]',
          'transition-transform duration-200 ease-in-out',
          'lg:relative lg:translate-x-0 lg:z-auto',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-white/[0.06]
                        font-semibold text-[14.5px] sticky top-0 bg-inherit z-10">
          <span
            className="w-7 h-7 rounded-[7px] bg-[#0a0a0c] bg-center bg-contain bg-no-repeat shrink-0"
            style={{ backgroundImage: 'url(/assets/helios-logo.png)', boxShadow: '0 0 18px rgba(255,122,24,0.45)' }}
          />
          <span className="flex-1">Helios AI</span>
          <button
            onClick={onClose}
            className="lg:hidden w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center
                       text-[#6a6a6e] hover:text-white transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Nav — grouped */}
        <div className="flex-1 overflow-y-auto py-2 px-2.5">
          {NAV_GROUPS.filter((g) => g !== 'System').map((group) => {
            const items = DASHBOARD_NAV.filter((item) => item.group === group)
            if (!items.length) return null
            return (
              <div key={group} className="mb-1">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6a6a6e] px-2 py-2.5">
                  {GROUP_LABELS[group]}
                </div>
                <nav className="flex flex-col gap-0.5">
                  {items.map((item) => {
                    const IconComponent = ICON_MAP[item.icon]
                    const isActive =
                      item.href === '/dashboard'
                        ? pathname === '/dashboard'
                        : pathname.startsWith(item.href)

                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        onClick={onClose}
                        className={cn(
                          'flex items-center gap-2.5 px-2.5 py-2.5 rounded-[10px]',
                          'text-[13.5px] transition-all duration-150',
                          isActive
                            ? 'bg-gradient-to-r from-[#ff7a18]/14 to-[#ff7a18]/[0.04] text-white border border-[#ff7a18]/20'
                            : 'text-[#9a9a9d] hover:bg-white/[0.04] hover:text-white',
                        )}
                      >
                        {IconComponent && (
                          <span className={cn(
                            'w-5 h-5 flex items-center justify-center shrink-0 transition-colors',
                            isActive ? 'text-[#ffae3c]' : 'text-[#6a6a6e]',
                          )}>
                            <IconComponent size={15} />
                          </span>
                        )}
                        <span className="flex-1">{item.label}</span>
                        {item.id === 'inbox' && <InboxUnreadBadge />}
                      </Link>
                    )
                  })}
                </nav>
              </div>
            )
          })}
        </div>

        {/* Settings + logout */}
        <div className="px-2.5 pb-4 pt-2 border-t border-white/[0.06]">
          {/* Settings link */}
          {(() => {
            const settings = DASHBOARD_NAV.find((i) => i.id === 'settings')
            if (!settings) return null
            const IconComponent = ICON_MAP[settings.icon]
            const isActive = pathname.startsWith(settings.href)
            return (
              <Link
                href={settings.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-2.5 px-2.5 py-2.5 rounded-[10px] mb-0.5',
                  'text-[13.5px] transition-all duration-150',
                  isActive
                    ? 'bg-gradient-to-r from-[#ff7a18]/14 to-[#ff7a18]/[0.04] text-white border border-[#ff7a18]/20'
                    : 'text-[#9a9a9d] hover:bg-white/[0.04] hover:text-white',
                )}
              >
                {IconComponent && (
                  <span className={cn('w-5 h-5 flex items-center justify-center shrink-0', isActive ? 'text-[#ffae3c]' : 'text-[#6a6a6e]')}>
                    <IconComponent size={15} />
                  </span>
                )}
                <span className="flex-1">{settings.label}</span>
              </Link>
            )
          })()}

          <form action={logout}>
            <button
              type="submit"
              className="flex items-center gap-2.5 px-2.5 py-2.5 rounded-[10px] w-full text-left
                         text-[13.5px] text-[#9a9a9d] transition-all
                         hover:bg-[#ff6a5a]/[0.06] hover:text-[#ff6a5a]"
            >
              <span className="w-5 h-5 flex items-center justify-center shrink-0 text-[#6a6a6e]">
                <LogOut size={15} />
              </span>
              Log Out
            </button>
          </form>
          <div className="text-[10px] text-[#6a6a6e] px-2.5 mt-2 font-mono">
            helios.mc / v1.0
          </div>
        </div>
      </aside>
    </>
  )
}
