import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/require-admin'
import { MOCK_ADMIN_NOTIFICATIONS } from '@/lib/data/mock-admin'
import { ArrowLeft, CircleAlert, AlertTriangle, CircleCheck } from 'lucide-react'

export const metadata = { title: 'Notifications — Mission Control' }

const LEVEL_ICON = {
  critical: CircleAlert,
  warning:  AlertTriangle,
  info:     CircleCheck,
}
const LEVEL_TONE = {
  critical: '#ff8a7a',
  warning:  '#ffae3c',
  info:     '#22d093',
}

export default async function AdminNotificationsPage() {
  await requireAdmin({ path: '/admin/notifications' })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/admin/mission-control" className="text-[12px] text-[#6a6a6e] hover:text-white flex items-center gap-1.5 mb-1">
          <ArrowLeft size={12} /> Back to Mission Control
        </Link>
        <h1 className="text-[22px] font-semibold">Notifications</h1>
        <p className="text-[13.5px] text-[#9a9a9d]">Founder-facing alerts across audits, leads, delivery, and Relevance AI.</p>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/60 overflow-hidden">
        <ul className="divide-y divide-white/[0.04]">
          {MOCK_ADMIN_NOTIFICATIONS.map((n) => {
            const Icon = LEVEL_ICON[n.level]
            const color = LEVEL_TONE[n.level]
            return (
              <li key={n.id} className="px-5 py-3.5 flex items-start gap-3">
                <Icon size={15} className="shrink-0 mt-0.5" style={{ color }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] text-white">{n.message}</div>
                  <div className="text-[11.5px] text-[#6a6a6e] mt-0.5 capitalize">{n.source} · {new Date(n.created_at).toLocaleString()}</div>
                </div>
                <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full border capitalize"
                  style={{ color, borderColor: `${color}40`, background: `${color}12` }}>
                  {n.level}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
