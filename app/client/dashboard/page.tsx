import { requireClient } from '@/lib/auth/require-client'
import { clientPlanLabel } from '@/lib/plans/plan-access'
import Link from 'next/link'
import { ArrowRight, MessageSquare, Users, Calendar, Bot } from 'lucide-react'

export default async function ClientDashboardPage() {
  const session = await requireClient({ redirectFrom: '/client/dashboard' })

  const stats = [
    { label: 'Conversations (7d)', value: '0', icon: MessageSquare },
    { label: 'New leads (7d)',     value: '0', icon: Users          },
    { label: 'Bookings (7d)',      value: '0', icon: Calendar       },
    { label: 'AI status',          value: 'Active', icon: Bot       },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Welcome */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#ff7a18]/[0.08] to-transparent p-6">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-[0.14em] text-[#ffae3c]">Welcome back</span>
          <h1 className="text-[24px] font-semibold">{session.businessName}</h1>
          <p className="text-[13.5px] text-[#9a9a9d]">
            You are on the {clientPlanLabel(session.plan)} plan. Here is what is happening today.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <div key={s.label} className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/60 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl border border-[#ff7a18]/25 bg-[#ff7a18]/[0.10] flex items-center justify-center text-[#ffae3c]">
                <Icon size={17} />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] text-[#6a6a6e] uppercase tracking-[0.08em]">{s.label}</span>
                <span className="text-[20px] font-semibold text-white">{s.value}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <QuickLinkCard
          title="Manage your AI assistant"
          desc="Check status, pause replies, and review what your AI has been saying to customers."
          href="/client/ai-assistant"
        />
        <QuickLinkCard
          title="Update your business profile"
          desc="Keep your services, hours, and contact details up to date so the AI gives correct answers."
          href="/client/business-profile"
        />
        <QuickLinkCard
          title="See your latest leads"
          desc="Every customer who messages your business shows up here. Reach out before they choose a competitor."
          href="/client/leads"
        />
        <QuickLinkCard
          title="View your reports"
          desc="Track conversations, bookings, and growth over time."
          href="/client/reports"
        />
      </div>
    </div>
  )
}

function QuickLinkCard({ title, desc, href }: { title: string; desc: string; href: string }) {
  return (
    <Link href={href}
      className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/60 p-5 flex flex-col gap-2
                 hover:border-[#ff7a18]/30 hover:bg-[#ff7a18]/[0.03] transition-all group">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold">{title}</h3>
        <ArrowRight size={15} className="text-[#6a6a6e] group-hover:text-[#ffae3c] group-hover:translate-x-0.5 transition-all" />
      </div>
      <p className="text-[13px] text-[#9a9a9d] leading-relaxed">{desc}</p>
    </Link>
  )
}
