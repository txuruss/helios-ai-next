import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import Link from 'next/link'
import PageHeader from '@/components/dashboard/PageHeader'
import StatCard from '@/components/dashboard/StatCard'
import { getBusinessPlan, getBusinessUsage } from '@/lib/billing/limits'
import { getPlanLimits } from '@/lib/billing/plans'

const MOCK_ACTIVITY = [
  { color: 'green',  title: 'Booking confirmed',           desc: 'Signature Facial · Island Glow · Sat 1:30 PM',    time: '2 min ago' },
  { color: 'cyan',   title: 'New lead qualified',          desc: 'Marcus Thompson · Score 92 · Barbershop',          time: '5 min ago' },
  { color: 'orange', title: 'Client Qualifier Agent ran',  desc: '5 leads scored · 1 flagged for follow-up',         time: '14 min ago' },
  { color: 'green',  title: 'WhatsApp reply sent',         desc: "Dane's Barber · pricing question answered",        time: '20 min ago' },
  { color: 'amber',  title: 'Sales Offer Builder degraded',desc: '1.4% error rate · review recommended',             time: '3 hr ago'   },
]

const MOCK_BOOKINGS = [
  { client: 'Island Glow Beauty Studio', service: 'Signature Facial',    date: 'Sat, May 17 · 1:30 PM',  status: 'confirmed' },
  { client: "Dane's Barber Shop",        service: 'Beard Trim + Lineup', date: 'Sat, May 17 · 10:00 AM', status: 'confirmed' },
  { client: 'Ocho Rios Auto Spa',        service: 'Full Detail Package', date: 'Sun, May 18 · 9:00 AM',  status: 'pending'   },
]

const STATUS_PILL: Record<string, string> = {
  confirmed: 'pill pill-green',
  pending:   'pill pill-amber',
  cancelled: 'pill pill-red',
}
const ACT_COLOR: Record<string, string> = {
  green: 'bg-[#22d093]', cyan: 'bg-[#5be3c5]',
  orange: 'bg-[#ffae3c]', amber: 'bg-[#ffb547]',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = user
    ? await supabase
        .from('business_members')
        .select('business_id')
        .eq('user_id', user.id)
        .limit(1)
        .single()
    : { data: null }

  // Real usage data for the stats section
  let liveUsage: { ai_conversations: number; leads: number; bookings: number } | null = null
  let planId = 'starter'
  let planLimits = getPlanLimits('starter')

  if (membership?.business_id && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const db = createServiceRoleClient()
    const [plan, usage] = await Promise.all([
      getBusinessPlan(db, membership.business_id as string),
      getBusinessUsage(db, membership.business_id as string),
    ])
    planId    = plan
    planLimits = getPlanLimits(plan)
    liveUsage  = usage
  }

  if (!membership) {
    return (
      <>
        <PageHeader
          eyebrow="Welcome to Helios AI"
          title="Set Up Your Business"
          description="Create your business profile to unlock Mission Control, AI Agents, Leads, Bookings, and more."
        />

        <div className="mt-2 grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Main CTA */}
          <div className="lg:col-span-2 border border-[#ff7a18]/25 rounded-2xl p-8
                          bg-gradient-to-br from-[#ff7a18]/[0.06] to-transparent">
            <div className="w-12 h-12 rounded-2xl bg-[#ff7a18]/[0.18] border border-[#ff7a18]/25
                            flex items-center justify-center text-2xl mb-5">
              🏢
            </div>
            <h3 className="text-[20px] font-semibold mb-2">Create Your Business Profile</h3>
            <p className="text-[14px] text-[#9a9a9d] mb-6 leading-relaxed">
              Add your business name, type, operating hours, and contact details.
              This unlocks your AI assistant, lead capture, and booking system.
            </p>
            <Link
              href="/dashboard/business"
              className="inline-flex items-center gap-2 h-11 px-6 rounded-[11px] text-[14px] font-medium
                         bg-gradient-to-b from-[#ff8a2a] to-[#ee6a0c] text-[#1a0c00]
                         shadow-[0_0_20px_rgba(255,122,24,0.35)] hover:shadow-[0_0_28px_rgba(255,122,24,0.5)]
                         transition-all duration-200"
            >
              Set Up Business Profile
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
            </Link>
          </div>

          {/* Steps */}
          <div className="border border-white/10 rounded-2xl p-6 flex flex-col gap-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6a6a6e]">
              Getting Started
            </div>
            {[
              { n: '1', label: 'Business Profile',   href: '/dashboard/business',  done: false },
              { n: '2', label: 'Add Services',        href: '/dashboard/services',  done: false },
              { n: '3', label: 'Configure Widget',    href: '/dashboard/widget',    done: false },
              { n: '4', label: 'Connect Cal.com',     href: '/dashboard/calcom',    done: false },
            ].map((step) => (
              <Link
                key={step.n}
                href={step.href}
                className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.06]
                           bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all"
              >
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0
                                  bg-[#ff7a18]/15 text-[#ffae3c] border border-[#ff7a18]/20">
                  {step.n}
                </span>
                <span className="text-[13.5px] text-[#d0d0d3]">{step.label}</span>
                <svg className="ml-auto shrink-0 text-[#6a6a6e]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
              </Link>
            ))}
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="Mission Control"
        title="Overview"
        description="Real-time view of leads, bookings, agents, and system health."
      />

      {/* KPI grid — live usage data when available */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="AI Conversations"
          value={liveUsage ? String(liveUsage.ai_conversations) : '—'}
          delta={liveUsage ? `${planLimits.ai_conversations_month} limit` : '—'}
          deltaDir={liveUsage && liveUsage.ai_conversations >= planLimits.ai_conversations_month * 0.9 ? 'warn' : 'neutral'}
          sub="this month"
          variant={liveUsage && liveUsage.ai_conversations >= planLimits.ai_conversations_month ? 'danger' : 'default'}
        />
        <StatCard
          label="Leads Captured"
          value={liveUsage ? String(liveUsage.leads) : '—'}
          delta={liveUsage ? `${planLimits.leads_month} limit` : '—'}
          deltaDir={liveUsage && liveUsage.leads >= planLimits.leads_month * 0.9 ? 'warn' : 'neutral'}
          sub="this month"
          variant={liveUsage && liveUsage.leads >= planLimits.leads_month ? 'danger' : 'default'}
        />
        <StatCard
          label="Bookings"
          value={liveUsage ? String(liveUsage.bookings) : '—'}
          delta={liveUsage ? `${planLimits.bookings_month} limit` : '—'}
          deltaDir={liveUsage && liveUsage.bookings >= planLimits.bookings_month * 0.9 ? 'warn' : 'neutral'}
          sub="this month"
          variant={liveUsage && liveUsage.bookings >= planLimits.bookings_month ? 'danger' : 'default'}
        />
        <StatCard
          label="Current Plan"
          value={planId.charAt(0).toUpperCase() + planId.slice(1)}
          delta="active"
          deltaDir="up"
          sub={`${planLimits.ai_conversations_month.toLocaleString()} convos/mo`}
        />
        <StatCard label="Active AI Agents"   value="7"  delta="1 degraded" deltaDir="warn" sub="of 8 total" variant="warn" />
        <StatCard label="Widget Messages"    value={liveUsage ? '—' : '—'} delta="this month" deltaDir="neutral" sub="tracked in usage" />
      </div>

      {/* Quick Actions */}
      <div className="mb-8 border border-white/10 rounded-2xl p-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6a6a6e] mb-3">Quick Actions</div>
        <div className="flex gap-2.5 flex-wrap">
          {['Run All Agents', 'Export Leads', 'Generate Report', 'View Analytics'].map((a) => (
            <button
              key={a}
              className="h-9 px-4 rounded-[10px] text-[13px] border border-white/10
                         bg-white/[0.025] text-[#f3f3f3] transition-all
                         hover:border-[#ff7a18]/35 hover:bg-[#ff7a18]/[0.06] hover:text-white"
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* Two-column bottom */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Bookings */}
        <div className="border border-white/10 rounded-2xl p-5">
          <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#6a6a6e]
                          border-b border-white/[0.06] pb-3 mb-4">
            Recent Bookings
          </div>
          <div className="flex flex-col gap-3">
            {MOCK_BOOKINGS.map((b, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full shrink-0 ${
                  b.status === 'confirmed' ? 'bg-[#22d093]' : 'bg-[#ffb547]'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-medium text-white truncate">{b.client}</div>
                  <div className="text-[11.5px] text-[#6a6a6e] truncate">{b.service} · {b.date}</div>
                </div>
                <span className={STATUS_PILL[b.status] ?? 'pill pill-mute'}>{b.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="border border-white/10 rounded-2xl p-5">
          <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#6a6a6e]
                          border-b border-white/[0.06] pb-3 mb-4">
            Latest Activity
          </div>
          <div className="flex flex-col gap-3">
            {MOCK_ACTIVITY.map((a, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${ACT_COLOR[a.color] ?? 'bg-[#9a9a9d]'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-medium text-white">{a.title}</div>
                  <div className="text-[11.5px] text-[#9a9a9d] truncate">{a.desc}</div>
                </div>
                <span className="text-[11px] text-[#6a6a6e] font-mono shrink-0">{a.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
