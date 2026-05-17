import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import Link from 'next/link'
import PageHeader from '@/components/dashboard/PageHeader'
import { getBusinessPlan, getBusinessUsage } from '@/lib/billing/limits'
import { getPlanLimits } from '@/lib/billing/plans'
import { getOpsOverview, getOpsEvents, getOpsAlerts, getOpsTasks, getSystemHealthSummary, getSlaDashboardSummary } from '@/lib/actions/ops'
import KpiCard                from './mission-control/KpiCard'
import AttentionRequiredPanel from './mission-control/AttentionRequiredPanel'
import LiveActivityFeed       from './mission-control/LiveActivityFeed'
import ClientSystemHealth     from './mission-control/ClientSystemHealth'
import AgentWorkforceSnapshot from './mission-control/AgentWorkforceSnapshot'
import PlanUsageCard          from './mission-control/PlanUsageCard'
import SetupProgressCard      from './mission-control/SetupProgressCard'
import DemoModeCard           from './mission-control/DemoModeCard'
import AiReviewCard           from './mission-control/AiReviewCard'
import LaunchReadinessCard    from './mission-control/LaunchReadinessCard'

export const metadata = { title: 'Mission Control — Helios AI' }

function monthStart(): string {
  const n = new Date()
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1)).toISOString()
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = user
    ? await supabase.from('business_members')
        .select('business_id').eq('user_id', user.id).limit(1).single()
    : { data: null }

  // ── No business profile → existing setup screen ───────────────────
  if (!membership) {
    return (
      <>
        <PageHeader
          eyebrow="Welcome to Helios AI"
          title="Set Up Your Business"
          description="Create your business profile to unlock Mission Control, AI Agents, Leads, Bookings, and more."
        />
        <div className="mt-2 grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 border border-[#ff7a18]/25 rounded-2xl p-8 bg-gradient-to-br from-[#ff7a18]/[0.06] to-transparent">
            <div className="w-12 h-12 rounded-2xl bg-[#ff7a18]/[0.18] border border-[#ff7a18]/25 flex items-center justify-center text-2xl mb-5">🏢</div>
            <h3 className="text-[20px] font-semibold mb-2">Create Your Business Profile</h3>
            <p className="text-[14px] text-[#9a9a9d] mb-6 leading-relaxed">
              Add your business name, type, operating hours, and contact details.
              This unlocks your AI assistant, lead capture, and booking system.
            </p>
            <Link
              href="/dashboard/business"
              className="inline-flex items-center gap-2 h-11 px-6 rounded-[11px] text-[14px] font-medium
                         bg-gradient-to-b from-[#ff8a2a] to-[#ee6a0c] text-[#1a0c00]
                         shadow-[0_0_20px_rgba(255,122,24,0.35)] hover:shadow-[0_0_28px_rgba(255,122,24,0.5)] transition-all"
            >
              Set Up Business Profile
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
            </Link>
          </div>
          <div className="border border-white/10 rounded-2xl p-6 flex flex-col gap-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6a6a6e]">Getting Started</div>
            {[
              { n: '1', label: 'Business Profile', href: '/dashboard/business' },
              { n: '2', label: 'Add Services',      href: '/dashboard/services' },
              { n: '3', label: 'Configure Widget',  href: '/dashboard/widget'   },
              { n: '4', label: 'Connect Cal.com',   href: '/dashboard/calcom'   },
            ].map((step) => (
              <Link key={step.n} href={step.href}
                className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 bg-[#ff7a18]/15 text-[#ffae3c] border border-[#ff7a18]/20">{step.n}</span>
                <span className="text-[13.5px] text-[#d0d0d3]">{step.label}</span>
                <svg className="ml-auto shrink-0 text-[#6a6a6e]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
              </Link>
            ))}
          </div>
        </div>
      </>
    )
  }

  // ── Business exists → Mission Control ────────────────────────────
  const businessId     = (membership as { business_id: string }).business_id
  const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY

  let usage      = { ai_conversations: 0, leads: 0, bookings: 0 }
  let planId     = 'starter'
  let planLimits = getPlanLimits('starter')
  let newLeads   = 0
  let bookings   = 0
  let waInbound  = 0
  let totalRuns  = 0
  let agentRuns: Array<{ id: string; run_type: string; status: string; input_summary: string | null; created_at: string }> = []
  let aiReviewCount   = 0
  let aiApprovalCount = 0

  if (hasServiceRole) {
    const db = createServiceRoleClient()
    const ms = monthStart()

    const [pln, usg, leadsRes, bookRes, waRes, runsRes, runsTotalRes] = await Promise.all([
      getBusinessPlan(db, businessId),
      getBusinessUsage(db, businessId),
      db.from('leads').select('*', { count: 'exact', head: true }).eq('business_id', businessId).gte('created_at', ms),
      db.from('bookings').select('*', { count: 'exact', head: true }).eq('business_id', businessId).gte('created_at', ms),
      db.from('whatsapp_messages').select('*', { count: 'exact', head: true })
        .eq('business_id', businessId).eq('direction', 'inbound').gte('created_at', ms),
      db.from('agent_runs').select('id,run_type,status,input_summary,created_at')
        .eq('business_id', businessId).order('created_at', { ascending: false }).limit(5),
      db.from('agent_runs').select('*', { count: 'exact', head: true }).eq('business_id', businessId),
    ])

    planId     = pln
    planLimits = getPlanLimits(pln)
    usage      = usg
    newLeads   = leadsRes.count ?? 0
    bookings   = bookRes.count  ?? 0
    waInbound  = waRes.count    ?? 0
    agentRuns  = (runsRes.data ?? []) as typeof agentRuns
    totalRuns  = runsTotalRes.count ?? 0

    // AI review counts
    const [reviewSessRes, reviewApprovalRes] = await Promise.all([
      db.from('chat_sessions').select('*', { count: 'exact', head: true })
        .eq('business_id', businessId).eq('ai_review_required', true),
      db.from('approval_items').select('*', { count: 'exact', head: true })
        .eq('business_id', businessId).eq('approval_type', 'ai_review').eq('status', 'pending'),
    ])
    aiReviewCount   = reviewSessRes.count   ?? 0
    aiApprovalCount = reviewApprovalRes.count ?? 0
  }

  const [
    { metrics },
    eventsResult,
    alertsResult,
    tasksResult,
    { items: healthItems },
    { summary: slaSummary },
  ] = await Promise.all([
    getOpsOverview(),
    getOpsEvents({ pageSize: 8 }),
    getOpsAlerts({ pageSize: 6 }),
    getOpsTasks({ pageSize: 6 }),
    getSystemHealthSummary(),
    getSlaDashboardSummary(),
  ])

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6a6a6e] mb-1">Mission Control</p>
          <h1 className="text-[24px] font-semibold tracking-tight text-white">Overview</h1>
          <p className="text-[13px] text-[#6a6a6e] mt-1">
            Monitor leads, bookings, conversations, agents, automations, and system health.
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11.5px] font-medium border
                            ${metrics.criticalCount > 0
                              ? 'bg-[#ff8a7a]/10 text-[#ff8a7a] border-[#ff8a7a]/20'
                              : 'bg-[#22d093]/10 text-[#22d093] border-[#22d093]/20'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${metrics.criticalCount > 0 ? 'bg-[#ff8a7a]' : 'bg-[#22d093]'}`} />
            {metrics.criticalCount > 0 ? `${metrics.criticalCount} critical` : 'Systems operational'}
          </span>
          <Link
            href="/dashboard/ops"
            className="h-9 px-4 rounded-[10px] text-[13px] border border-[#ff7a18]/30 bg-[#ff7a18]/[0.08] text-[#ffae3c] hover:bg-[#ff7a18]/15 transition-all"
          >
            Ops Center →
          </Link>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="New Leads"        value={newLeads}  sub="this month"  delta={newLeads > 0 ? '+new' : 'none yet'} deltaDir={newLeads > 0 ? 'up' : 'neutral'} icon="👤" />
        <KpiCard label="Bookings"         value={bookings}  sub="this month"  delta={bookings > 0 ? 'active' : 'none yet'} deltaDir={bookings > 0 ? 'up' : 'neutral'} icon="📅" />
        <KpiCard
          label="AI Conversations" value={usage.ai_conversations}
          sub={`of ${planLimits.ai_conversations_month.toLocaleString()}`}
          delta={usage.ai_conversations >= planLimits.ai_conversations_month * 0.9 ? 'Near limit' : undefined}
          deltaDir="warn"
          variant={usage.ai_conversations >= planLimits.ai_conversations_month ? 'danger' : 'default'}
          icon="💬"
        />
        <KpiCard label="WhatsApp Messages" value={waInbound}          sub="inbound this month" icon="✆" />
        <KpiCard label="Open Alerts"      value={metrics.activeAlerts}
          delta={metrics.criticalCount > 0 ? `${metrics.criticalCount} critical` : undefined}
          deltaDir="down" variant={metrics.criticalCount > 0 ? 'danger' : 'default'} icon="⚠" />
        <KpiCard label="Pending Approvals" value={metrics.pendingApprovals}
          delta={metrics.pendingApprovals > 0 ? 'needs review' : 'all clear'}
          deltaDir={metrics.pendingApprovals > 0 ? 'warn' : 'neutral'} icon="✅" />
        <KpiCard label="Agent Runs"       value={totalRuns}  sub="all time" icon="🤖" />
        <KpiCard
          label="SLA Breached" value={slaSummary.breached}
          delta={slaSummary.breached > 0 ? 'needs attention' : 'all on track'}
          deltaDir={slaSummary.breached > 0 ? 'down' : 'neutral'}
          variant={slaSummary.breached > 0 ? 'danger' : 'default'} icon="⏱" />
        <KpiCard
          label="Due Soon" value={slaSummary.due_soon}
          delta={slaSummary.due_soon > 0 ? 'within 1 hour' : 'none'}
          deltaDir={slaSummary.due_soon > 0 ? 'warn' : 'neutral'}
          variant={slaSummary.due_soon > 0 ? 'warn' : 'default'} icon="⏰" />
        <KpiCard
          label="Escalated" value={slaSummary.escalated}
          delta={slaSummary.escalated > 0 ? 'escalated' : 'none'}
          deltaDir={slaSummary.escalated > 0 ? 'down' : 'neutral'}
          variant={slaSummary.escalated > 0 ? 'danger' : 'default'} icon="🔺" />
        <KpiCard
          label="Plan" value={planId.charAt(0).toUpperCase() + planId.slice(1)}
          sub={`${planLimits.ai_conversations_month.toLocaleString()} convos/mo`}
          delta="active" deltaDir="up" variant="success" icon="💎"
        />
      </div>

      {/* Setup Progress + Demo Mode */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <SetupProgressCard />
        <DemoModeCard />
      </div>

      {/* AI Review Queue + Launch Readiness */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <AiReviewCard
          reviewRequiredCount={aiReviewCount}
          pendingApprovalCount={aiApprovalCount}
        />
        <LaunchReadinessCard />
      </div>

      {/* Attention + Plan Usage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <AttentionRequiredPanel alerts={alertsResult.rows} tasks={tasksResult.rows} />
        <PlanUsageCard plan={planId} conversations={usage.ai_conversations} leads={usage.leads} bookings={usage.bookings} limits={planLimits} />
      </div>

      {/* Activity + Agent Runs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <LiveActivityFeed events={eventsResult.rows} />
        <AgentWorkforceSnapshot recentRuns={agentRuns} totalRuns={totalRuns} />
      </div>

      {/* System Health */}
      <ClientSystemHealth items={healthItems} />
    </>
  )
}
