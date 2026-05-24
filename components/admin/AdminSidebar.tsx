'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/lib/auth/actions'
import { ADMIN_NAV, ADMIN_NAV_GROUPS } from './AdminNav'
import { cn } from '@/components/ui/cn'
import {
  Compass, BarChart2, Users, Building2, Settings, LogOut, X,
} from 'lucide-react'

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Compass, BarChart2, Users, Building2, Settings,
}

interface Props {
  open:     boolean
  onClose:  () => void
  fullName: string | null
  email:    string
}

export default function AdminSidebar({ open, onClose, fullName, email }: Props) {
  const pathname = usePathname()

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-30 lg:hidden" onClick={onClose} />}

      <aside className={cn(
        'fixed top-0 left-0 bottom-0 w-[240px] z-40',
        'flex flex-col bg-gradient-to-b from-[#0c0d0f] to-[#080809]',
        'border-r border-white/[0.06]',
        'transition-transform duration-200 ease-in-out',
        'lg:relative lg:translate-x-0 lg:z-auto',
        open ? 'translate-x-0' : '-translate-x-full',
      )}>
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-white/[0.06] sticky top-0 bg-inherit z-10">
          <span
            className="w-7 h-7 rounded-[7px] bg-[#0a0a0c] bg-center bg-contain bg-no-repeat shrink-0"
            style={{ backgroundImage: 'url(/assets/helios-logo.png)', boxShadow: '0 0 18px rgba(255,122,24,0.45)' }}
          />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold truncate">Helios Admin</div>
            <div className="text-[10.5px] font-medium text-[#ffae3c] truncate">
              Founder · {fullName ?? email.split('@')[0]}
            </div>
          </div>
          <button onClick={onClose}
            className="lg:hidden w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center
                       text-[#6a6a6e] hover:text-white transition-colors">
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2 px-2.5">
          {ADMIN_NAV_GROUPS.filter((g) => g !== 'Admin').map((group) => {
            const items = ADMIN_NAV.filter((i) => i.group === group)
            if (!items.length) return null
            return (
              <div key={group} className="mb-1">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6a6a6e] px-2 py-2.5">
                  {group}
                </div>
                <nav className="flex flex-col gap-0.5">
                  {items.map((item) => {
                    const IconComp = ICONS[item.icon]
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                    return (
                      <Link key={item.id} href={item.href} onClick={onClose}
                        className={cn(
                          'flex items-center gap-2.5 px-2.5 py-2.5 rounded-[10px]',
                          'text-[13.5px] transition-all duration-150',
                          isActive
                            ? 'bg-gradient-to-r from-[#ff7a18]/14 to-[#ff7a18]/[0.04] text-white border border-[#ff7a18]/20'
                            : 'text-[#9a9a9d] hover:bg-white/[0.04] hover:text-white',
                        )}>
                        {IconComp && (
                          <span className={cn('w-5 h-5 flex items-center justify-center shrink-0',
                            isActive ? 'text-[#ffae3c]' : 'text-[#6a6a6e]')}>
                            <IconComp size={15} />
                          </span>
                        )}
                        <span className="flex-1">{item.label}</span>
                      </Link>
                    )
                  })}
                </nav>
              </div>
            )
          })}
        </div>

        <div className="px-2.5 pb-[max(1rem,env(safe-area-inset-bottom,1rem))] pt-2 border-t border-white/[0.06]">
          {ADMIN_NAV.filter((i) => i.group === 'Admin').map((item) => {
            const IconComp = ICONS[item.icon]
            const isActive = pathname.startsWith(item.href)
            return (
              <Link key={item.id} href={item.href} onClick={onClose}
                className={cn(
                  'flex items-center gap-2.5 px-2.5 py-2.5 rounded-[10px] mb-0.5',
                  'text-[13.5px] transition-all duration-150',
                  isActive
                    ? 'bg-gradient-to-r from-[#ff7a18]/14 to-[#ff7a18]/[0.04] text-white border border-[#ff7a18]/20'
                    : 'text-[#9a9a9d] hover:bg-white/[0.04] hover:text-white',
                )}>
                {IconComp && (
                  <span className={cn('w-5 h-5 flex items-center justify-center shrink-0',
                    isActive ? 'text-[#ffae3c]' : 'text-[#6a6a6e]')}>
                    <IconComp size={15} />
                  </span>
                )}
                <span className="flex-1">{item.label}</span>
              </Link>
            )
          })}

          <form action={logout}>
            <button type="submit"
              className="flex items-center gap-2.5 px-2.5 py-2.5 rounded-[10px] w-full text-left
                         text-[13.5px] text-[#9a9a9d] transition-all
                         hover:bg-[#ff6a5a]/[0.06] hover:text-[#ff6a5a]">
              <span className="w-5 h-5 flex items-center justify-center shrink-0 text-[#6a6a6e]">
                <LogOut size={15} />
              </span>
              Log Out
            </button>
          </form>
          <div className="text-[9.5px] text-[#6a6a6e]/60 px-2.5 mt-2.5 font-mono select-none">
            mission control / v1.0
          </div>
        </div>
      </aside>
    </>
  )
}
