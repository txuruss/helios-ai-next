'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { capture } from '@/lib/analytics/posthog'
import {
  getOpsOverview, getOpsEvents, getOpsTasks, getOpsAlerts,
  getApprovalItems, getSystemHealthSummary, getClientSystemsSummary,
  getAutomationRules, getBusinessMembersForAssignment,
  getSlaPolicies, getNotificationRules, getOpsAuditTrailAction, getSlaDashboardSummary,
  getOpsExports,
} from '@/lib/actions/ops'
import type {
  OpsOverviewMetrics, OpsEvent, OpsTask, OpsAlert,
  ApprovalItem, SystemHealthItem, ClientSystem,
  AutomationRule, BusinessMember,
  SlaPolicy, NotificationRule, AuditTrailRow, SlaSummary, OpsExportRow,
  PaginatedOpsResult,
} from '@/lib/actions/ops'
import ExportHistoryPanel from './ExportHistoryPanel'
import OpsOverview        from './OpsOverview'
import OpsEventFeed       from './OpsEventFeed'
import OpsAlertPanel      from './OpsAlertPanel'
import OpsTaskBoard       from './OpsTaskBoard'
import ApprovalQueue      from './ApprovalQueue'
import SystemHealthPanel  from './SystemHealthPanel'
import ClientSystemsPanel from './ClientSystemsPanel'
import AutomationRulesPanel from './AutomationRulesPanel'
import SlaRoutingPanel      from './SlaRoutingPanel'

export type OpsTab = 'overview' | 'activity' | 'alerts' | 'tasks' | 'approvals' | 'health' | 'clients' | 'automation' | 'sla'

const TABS: Array<{ id: OpsTab; label: string }> = [
  { id: 'overview',    label: 'Overview'          },
  { id: 'activity',   label: 'Activity'           },
  { id: 'alerts',     label: 'Alerts'             },
  { id: 'tasks',      label: 'Tasks'              },
  { id: 'approvals',  label: 'Approvals'          },
  { id: 'health',     label: 'System Health'      },
  { id: 'clients',    label: 'Client Systems'     },
  { id: 'automation', label: 'Automation Rules'   },
  { id: 'sla',        label: 'SLA & Routing'      },
]

interface Props {
  initialTab:        OpsTab
  initialMetrics:    OpsOverviewMetrics
  initialEvents:     PaginatedOpsResult<OpsEvent>
  initialAlerts:     PaginatedOpsResult<OpsAlert>
  initialTasks:      PaginatedOpsResult<OpsTask>
  initialApprovals:  PaginatedOpsResult<ApprovalItem>
  initialHealth:     SystemHealthItem[]
  initialSystems:    ClientSystem[]
  initialRules:      AutomationRule[]
  initialPolicies:   SlaPolicy[]
  initialNotifRules: NotificationRule[]
  initialAudit:      AuditTrailRow[]
  initialAuditTotal: number
  initialSlaSummary: SlaSummary
  initialExports:    OpsExportRow[]
  businessId:        string | null
  plan:              string
}

export default function OpsCenterClient({
  initialTab, initialMetrics, initialEvents, initialAlerts, initialTasks,
  initialApprovals, initialHealth, initialSystems, initialRules,
  initialPolicies, initialNotifRules, initialAudit, initialAuditTotal, initialSlaSummary, initialExports,
  businessId, plan,
}: Props) {
  const [tab,       setTab]       = useState<OpsTab>(initialTab)
  const [metrics,   setMetrics]   = useState(initialMetrics)
  const [events,    setEvents]    = useState(initialEvents)
  const [alerts,    setAlerts]    = useState(initialAlerts)
  const [tasks,     setTasks]     = useState(initialTasks)
  const [approvals, setApprovals] = useState(initialApprovals)
  const [health,    setHealth]    = useState(initialHealth)
  const [systems,   setSystems]   = useState(initialSystems)
  const [auditTotal, setAuditTotal] = useState(initialAuditTotal)
  const [rules,       setRules]      = useState(initialRules)
  const [policies,    setPolicies]   = useState(initialPolicies)
  const [notifRules,  setNotifRules] = useState(initialNotifRules)
  const [audit,       setAudit]      = useState(initialAudit)
  const [slaSummary,  setSlaSummary] = useState(initialSlaSummary)
  const [opsExports,  setOpsExports] = useState(initialExports)
  const [members,     setMembers]    = useState<BusinessMember[]>([])
  const [rtConnected, setRtConnected] = useState(false)
  const [lastLive,    setLastLive]    = useState<string | null>(null)

  const [pending, startTransition] = useTransition()

  // ── Analytics ─────────────────────────────────────────────────────
  useEffect(() => {
    capture('ops_center_viewed', { tab, plan })
  }, [tab, plan])

  // ── Load business members once ─────────────────────────────────────
  useEffect(() => {
    getBusinessMembersForAssignment().then((r) => {
      if (!r.error) setMembers(r.members)
    })
  }, [])

  // ── Supabase Realtime subscriptions ───────────────────────────────
  useEffect(() => {
    if (!businessId) return

    const supabase = createClient()

    const eventsChannel = supabase.channel(`ops-events-${businessId}`)
      .on('postgres_changes', {
        event:  'INSERT', schema: 'public', table: 'ops_events',
        filter: `business_id=eq.${businessId}`,
      }, (payload) => {
        const newRow = payload.new as OpsEvent
        setEvents((prev) => ({ ...prev, rows: [newRow, ...prev.rows].slice(0, 100), total_count: prev.total_count + 1 }))
        setMetrics((prev) => ({ ...prev, openEvents: prev.openEvents + 1 }))
        setLastLive(new Date().toLocaleTimeString())
        capture('ops_event_received_live', { source: newRow.source, severity: newRow.severity })
      })
      .subscribe((status) => {
        setRtConnected(status === 'SUBSCRIBED')
        if (status === 'SUBSCRIBED') capture('ops_realtime_connected', { plan })
      })

    const alertsChannel = supabase.channel(`ops-alerts-${businessId}`)
      .on('postgres_changes', {
        event:  'INSERT', schema: 'public', table: 'ops_alerts',
        filter: `business_id=eq.${businessId}`,
      }, (payload) => {
        const newRow = payload.new as OpsAlert
        setAlerts((prev) => ({ ...prev, rows: [newRow, ...prev.rows].slice(0, 100), total_count: prev.total_count + 1 }))
        setMetrics((prev) => ({ ...prev, activeAlerts: prev.activeAlerts + 1 }))
        setLastLive(new Date().toLocaleTimeString())
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'ops_alerts',
        filter: `business_id=eq.${businessId}`,
      }, (payload) => {
        const updated = payload.new as OpsAlert
        setAlerts((prev) => ({ ...prev, rows: prev.rows.map((a) => a.id === updated.id ? updated : a) }))
      })
      .subscribe()

    const tasksChannel = supabase.channel(`ops-tasks-${businessId}`)
      .on('postgres_changes', {
        event:  'INSERT', schema: 'public', table: 'ops_tasks',
        filter: `business_id=eq.${businessId}`,
      }, (payload) => {
        const newRow = payload.new as OpsTask
        setTasks((prev) => ({ ...prev, rows: [newRow, ...prev.rows].slice(0, 100), total_count: prev.total_count + 1 }))
        setMetrics((prev) => ({ ...prev, activeTasks: prev.activeTasks + 1 }))
        setLastLive(new Date().toLocaleTimeString())
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'ops_tasks',
        filter: `business_id=eq.${businessId}`,
      }, (payload) => {
        const updated = payload.new as OpsTask
        setTasks((prev) => ({ ...prev, rows: prev.rows.map((t) => t.id === updated.id ? updated : t) }))
      })
      .subscribe()

    const approvalsChannel = supabase.channel(`ops-approvals-${businessId}`)
      .on('postgres_changes', {
        event:  'INSERT', schema: 'public', table: 'approval_items',
        filter: `business_id=eq.${businessId}`,
      }, (payload) => {
        const newRow = payload.new as ApprovalItem
        setApprovals((prev) => ({ ...prev, rows: [newRow, ...prev.rows].slice(0, 100), total_count: prev.total_count + 1 }))
        setMetrics((prev) => ({ ...prev, pendingApprovals: prev.pendingApprovals + 1 }))
        setLastLive(new Date().toLocaleTimeString())
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'approval_items',
        filter: `business_id=eq.${businessId}`,
      }, (payload) => {
        const updated = payload.new as ApprovalItem
        setApprovals((prev) => ({ ...prev, rows: prev.rows.map((a) => a.id === updated.id ? updated : a) }))
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(eventsChannel)
      void supabase.removeChannel(alertsChannel)
      void supabase.removeChannel(tasksChannel)
      void supabase.removeChannel(approvalsChannel)
    }
  }, [businessId, plan])

  // ── Full refresh ──────────────────────────────────────────────────
  const refresh = useCallback(() => {
    startTransition(async () => {
      const [m, ev, al, tk, ap, he, sy, ru, po, nr, aud, sla, exp] = await Promise.all([
        getOpsOverview(),
        getOpsEvents({ pageSize: 50 }),
        getOpsAlerts({ pageSize: 50 }),
        getOpsTasks({ pageSize: 50 }),
        getApprovalItems({ pageSize: 50 }),
        getSystemHealthSummary(),
        getClientSystemsSummary(),
        getAutomationRules(),
        getSlaPolicies(),
        getNotificationRules(),
        getOpsAuditTrailAction({ limit: 30 }),
        getSlaDashboardSummary(),
        getOpsExports({ limit: 20 }),
      ])
      if (!m.error)   setMetrics(m.metrics)
      if (!ev.error)  setEvents(ev)
      if (!al.error)  setAlerts(al)
      if (!tk.error)  setTasks(tk)
      if (!ap.error)  setApprovals({ ...ap, rows: ap.rows })
      if (!he.error)  setHealth(he.items)
      if (!sy.error)  setSystems(sy.systems)
      if (!ru.error)  setRules(ru.rules)
      if (!po.error)  setPolicies(po.policies)
      if (!nr.error)  setNotifRules(nr.rules)
      if (!aud.error) { setAudit(aud.rows); setAuditTotal(aud.total_count) }
      if (!sla.error) setSlaSummary(sla.summary)
      if (!exp.error) setOpsExports(exp.exports)
    })
  }, [])

  // ── Export helper ─────────────────────────────────────────────────
  const handleExport = (format: 'csv' | 'json') => {
    const typeMap: Record<OpsTab, string> = {
      activity:   'ops_events',
      alerts:     'ops_alerts',
      tasks:      'ops_tasks',
      approvals:  'approvals',
      overview:   'ops_events',
      health:     'ops_events',
      clients:    'ops_events',
      automation: 'ops_events',
      sla:        'ops_events',
    }
    const exportType = typeMap[tab] ?? 'ops_events'
    capture('ops_export_created', { export_type: exportType, format })

    fetch('/api/ops/export', {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify({ export_type: exportType, format, limit: 500 }),
    })
    .then(async (res) => {
      if (!res.ok) return
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `${exportType}_${new Date().toISOString().slice(0, 10)}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    })
    .catch(() => undefined)
  }

  const activeAlertCount     = alerts.rows.filter((a) => a.status === 'active').length
  const pendingApprovalCount = approvals.rows.filter((a) => a.status === 'pending').length

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6a6a6e] mb-1">Ops Center</p>
          <h1 className="text-[24px] font-semibold tracking-tight text-white">Operations</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-[13px] text-[#6a6a6e]">Events, alerts, tasks, approvals, and system health.</p>
            <div className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${rtConnected ? 'bg-[#22d093] animate-pulse' : 'bg-[#6a6a6e]'}`} />
              <span className="text-[10.5px] text-[#6a6a6e]">{rtConnected ? 'Live' : 'Offline'}</span>
            </div>
            {lastLive && <span className="text-[10.5px] text-[#6a6a6e]">Updated {lastLive}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Export */}
          {['activity','alerts','tasks','approvals'].includes(tab) && (
            <div className="flex items-center gap-1">
              <button onClick={() => handleExport('csv')}
                className="h-9 px-3 rounded-l-[10px] text-[12.5px] border border-white/[0.10] bg-white/[0.04] text-[#9a9a9d] hover:bg-white/[0.08] transition-all">
                ↓ CSV
              </button>
              <button onClick={() => handleExport('json')}
                className="h-9 px-3 rounded-r-[10px] text-[12.5px] border border-white/[0.10] bg-white/[0.04] text-[#9a9a9d] hover:bg-white/[0.08] transition-all border-l-0">
                ↓ JSON
              </button>
            </div>
          )}
          <button onClick={refresh} disabled={pending}
            className="h-9 px-4 rounded-[10px] text-[13px] border border-white/[0.10] bg-white/[0.04] text-[#9a9a9d] hover:bg-white/[0.08] transition-all disabled:opacity-40">
            {pending ? 'Refreshing…' : '↻ Refresh'}
          </button>
          <a href="/dashboard"
            className="h-9 px-4 rounded-[10px] text-[13px] border border-[#ff7a18]/30 bg-[#ff7a18]/[0.08] text-[#ffae3c] hover:bg-[#ff7a18]/15 transition-all">
            ← Mission Control
          </a>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-white/[0.06] overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-[13px] font-medium transition-all whitespace-nowrap border-b-2 -mb-px
                        ${tab === t.id ? 'text-white border-[#ff7a18]' : 'text-[#6a6a6e] border-transparent hover:text-[#9a9a9d]'}`}>
            {t.label}
            {t.id === 'alerts'     && activeAlertCount     > 0 && <BadgePill count={activeAlertCount}     color="bg-[#ff8a7a]/20 text-[#ff8a7a]" />}
            {t.id === 'approvals'  && pendingApprovalCount > 0 && <BadgePill count={pendingApprovalCount} color="bg-[#ffae3c]/20 text-[#ffae3c]" />}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview'   && <OpsOverview metrics={metrics} events={events.rows.slice(0, 5)} alerts={alerts.rows.slice(0, 5)} tasks={tasks.rows.slice(0, 5)} />}
      {tab === 'activity'   && (
        <>
          <OpsEventFeed initialData={events} members={members} businessId={businessId} onRefresh={refresh} />
          <ExportHistoryPanel exports={opsExports} onRefresh={refresh} />
        </>
      )}
      {tab === 'alerts'     && <OpsAlertPanel initialData={alerts} members={members} businessId={businessId} onRefresh={refresh} />}
      {tab === 'tasks'      && <OpsTaskBoard initialData={tasks} members={members} businessId={businessId} onRefresh={refresh} />}
      {tab === 'approvals'  && <ApprovalQueue initialData={approvals} members={members} businessId={businessId} onRefresh={refresh} />}
      {tab === 'health'     && <SystemHealthPanel items={health} />}
      {tab === 'clients'    && <ClientSystemsPanel systems={systems} />}
      {tab === 'automation' && <AutomationRulesPanel rules={rules} onRefresh={refresh} />}
      {tab === 'sla'        && (
        <SlaRoutingPanel
          initialPolicies={policies}
          initialRules={notifRules}
          initialAudit={audit}
          initialSummary={slaSummary}
          members={members}
          onRefresh={refresh}
        />
      )}
    </div>
  )
}

function BadgePill({ count, color }: { count: number; color: string }) {
  return (
    <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${color}`}>
      {count > 99 ? '99+' : count}
    </span>
  )
}
