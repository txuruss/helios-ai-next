'use client'

import { useState, useTransition } from 'react'
import {
  seedDefaultSlaPoliciesAction,
  seedDefaultNotificationRulesAction,
  runSlaCheckNow,
  getSlaDashboardSummary,
  getSlaPolicies,
  getNotificationRules,
  getOpsAuditTrailAction,
} from '@/lib/actions/ops'
import type {
  SlaPolicy, NotificationRule, AuditTrailRow, SlaSummary, BusinessMember,
} from '@/lib/actions/ops'
import { capture } from '@/lib/analytics/posthog'
import SlaSummaryCards       from './SlaSummaryCards'
import SlaPolicyTable        from './SlaPolicyTable'
import NotificationRulesTable from './NotificationRulesTable'
import OpsAuditTrail         from './OpsAuditTrail'
import OpsCronHistoryPanel   from './OpsCronHistoryPanel'

interface Props {
  initialPolicies:  SlaPolicy[]
  initialRules:     NotificationRule[]
  initialAudit:     AuditTrailRow[]
  initialSummary:   SlaSummary
  members:          BusinessMember[]
  onRefresh:        () => void
}

export default function SlaRoutingPanel({
  initialPolicies, initialRules, initialAudit, initialSummary, members, onRefresh,
}: Props) {
  const [policies,  setPolicies]  = useState(initialPolicies)
  const [rules,     setRules]     = useState(initialRules)
  const [audit,     setAudit]     = useState(initialAudit)
  const [summary,   setSummary]   = useState(initialSummary)
  const [slaMsg,    setSlaMsg]    = useState<string | null>(null)
  const [notifMsg,  setNotifMsg]  = useState<string | null>(null)
  const [checkMsg,  setCheckMsg]  = useState<string | null>(null)
  const [error,     setError]     = useState<string | null>(null)

  const [slaPending,   startSla]   = useTransition()
  const [notifPending, startNotif] = useTransition()
  const [checkPending, startCheck] = useTransition()
  const [refreshPending, startRefresh] = useTransition()

  const handleRefresh = () => {
    capture('ops_audit_viewed', {})
    startRefresh(async () => {
      const [p, r, a, s] = await Promise.all([
        getSlaPolicies(),
        getNotificationRules(),
        getOpsAuditTrailAction({ limit: 30 }),
        getSlaDashboardSummary(),
      ])
      if (!p.error) setPolicies(p.policies)
      if (!r.error) setRules(r.rules)
      if (!a.error) setAudit(a.rows)
      if (!s.error) setSummary(s.summary)
      onRefresh()
    })
  }

  const handleSeedSla = () => {
    setSlaMsg(null); setError(null)
    startSla(async () => {
      const result = await seedDefaultSlaPoliciesAction()
      if (result.error) { setError(result.error); return }
      setSlaMsg(`Seeded ${result.seeded} SLA polic${result.seeded !== 1 ? 'ies' : 'y'}.`)
      capture('ops_sla_policy_seeded', { count: result.seeded })
      handleRefresh()
    })
  }

  const handleSeedNotif = () => {
    setNotifMsg(null); setError(null)
    startNotif(async () => {
      const result = await seedDefaultNotificationRulesAction()
      if (result.error) { setError(result.error); return }
      setNotifMsg(`Seeded ${result.seeded} notification rule${result.seeded !== 1 ? 's' : ''}.`)
      capture('ops_notification_rule_seeded', { count: result.seeded })
      handleRefresh()
    })
  }

  const handleSlaCheck = () => {
    setCheckMsg(null); setError(null)
    startCheck(async () => {
      const result = await runSlaCheckNow()
      if (result.error) { setError(result.error); return }
      setCheckMsg(`Checked ${result.checked} items · ${result.breached} breached · ${result.escalated} escalated.`)
      capture('ops_sla_check_run', { checked: result.checked, breached: result.breached })
      handleRefresh()
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Controls */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <button onClick={handleSeedSla} disabled={slaPending}
          className="h-9 px-4 rounded-[10px] text-[13px] border border-[#ff7a18]/30 bg-[#ff7a18]/[0.08] text-[#ffae3c] hover:bg-[#ff7a18]/15 transition-all disabled:opacity-40">
          {slaPending ? 'Seeding…' : '⏱ Seed Default SLA Policies'}
        </button>
        <button onClick={handleSeedNotif} disabled={notifPending}
          className="h-9 px-4 rounded-[10px] text-[13px] border border-[#3b9eff]/30 bg-[#3b9eff]/[0.08] text-[#3b9eff] hover:bg-[#3b9eff]/15 transition-all disabled:opacity-40">
          {notifPending ? 'Seeding…' : '🔔 Seed Default Notifications'}
        </button>
        <button onClick={handleSlaCheck} disabled={checkPending}
          className="h-9 px-4 rounded-[10px] text-[13px] border border-white/[0.10] bg-white/[0.04] text-[#9a9a9d] hover:bg-white/[0.08] transition-all disabled:opacity-40">
          {checkPending ? 'Running…' : '▶ Run SLA Check Now'}
        </button>
        <button onClick={handleRefresh} disabled={refreshPending}
          className="h-9 px-4 rounded-[10px] text-[13px] border border-white/[0.10] bg-white/[0.04] text-[#9a9a9d] hover:bg-white/[0.08] transition-all disabled:opacity-40">
          {refreshPending ? '…' : '↻'}
        </button>
      </div>

      {slaMsg   && <p className="text-[12px] text-[#22d093]">{slaMsg}</p>}
      {notifMsg && <p className="text-[12px] text-[#22d093]">{notifMsg}</p>}
      {checkMsg && <p className="text-[12px] text-[#22d093]">{checkMsg}</p>}
      {error    && <p className="text-[12px] text-[#ff8a7a]">{error}</p>}

      {/* SLA summary */}
      <div>
        <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#6a6a6e] mb-3">SLA Summary</h3>
        <SlaSummaryCards summary={summary} />
      </div>

      {/* SLA policies */}
      <SlaPolicyTable policies={policies} onRefresh={handleRefresh} />

      {/* Notification rules */}
      <NotificationRulesTable rules={rules} members={members} onRefresh={handleRefresh} />

      {/* Audit trail */}
      <div>
        <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#6a6a6e] mb-3">Recent Audit Trail</h3>
        <OpsAuditTrail initialRows={audit} initialTotal={audit.length} />
        <OpsCronHistoryPanel />
      </div>
    </div>
  )
}
