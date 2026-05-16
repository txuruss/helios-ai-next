'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { capture } from '@/lib/analytics/posthog'
import {
  getOpsOverview, getOpsEvents, getOpsTasks, getOpsAlerts,
  getApprovalItems, getSystemHealthSummary, getClientSystemsSummary,
  getAutomationRules, getBusinessMembersForAssignment,
} from '@/lib/actions/ops'
import type {
  OpsOverviewMetrics, OpsEvent, OpsTask, OpsAlert,
  ApprovalItem, SystemHealthItem, ClientSystem,
  AutomationRule, BusinessMember,
} from '@/lib/actions/ops'
import OpsOverview        from './OpsOverview'
import OpsEventFeed       from './OpsEventFeed'
import OpsAlertPanel      from './OpsAlertPanel'
import OpsTaskBoard       from './OpsTaskBoard'
import ApprovalQueue      from './ApprovalQueue'
import SystemHealthPanel  from './SystemHealthPanel'
import ClientSystemsPanel from './ClientSystemsPanel'
import AutomationRulesPanel from './AutomationRulesPanel'

export type OpsTab = 'overview' | 'activity' | 'alerts' | 'tasks' | 'approvals' | 'health' | 'clients' | 'automation'

const TABS: Array<{ id: OpsTab; label: string }> = [
  { id: 'overview',    label: 'Overview'          },
  { id: 'activity',   label: 'Activity'           },
  { id: 'alerts',     label: 'Alerts'             },
  { id: 'tasks',      label: 'Tasks'              },
  { id: 'approvals',  label: 'Approvals'          },
  { id: 'health',     label: 'System Health'      },
  { id: 'clients',    label: 'Client Systems'     },
  { id: 'automation', label: 'Automation Rules'   },
]

interface Props {
  initialTab:       OpsTab
  initialMetrics:   OpsOverviewMetrics
  initialEvents:    OpsEvent[]
  initialAlerts:    OpsAlert[]
  initialTasks:     OpsTask[]
  initialApprovals: ApprovalItem[]
  initialHealth:    SystemHealthItem[]
  initialSystems:   ClientSystem[]
  initialRules:     AutomationRule[]
  businessId:       string | null
  plan:             string
}

export default function OpsCenterClient({
  initialTab, initialMetrics, initialEvents, initialAlerts, initialTasks,
  initialApprovals, initialHealth, initialSystems, initialRules, businessId, plan,
}: Props) {
  const [tab,       setTab]       = useState<OpsTab>(initialTab)
  const [metrics,   setMetrics]   = useState(initialMetrics)
  const [events,    setEvents]    = useState(initialEvents)
  const [alerts,    setAlerts]    = useState(initialAlerts)
  const [tasks,     setTasks]     = useState(initialTasks)
  const [approvals, setApprovals] = useState(initialApprovals)
  const [health,    setHealth]    = useState(initialHealth)
  const [systems,   setSystems]   = useState(initialSystems)
  const [rules,     setRules]     = useState(initialRules)
  const [members,   setMembers]   = useState<BusinessMember[]>([])
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
        setEvents((prev) => [newRow, ...prev].slice(0, 100))
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
        setAlerts((prev) => [newRow, ...prev].slice(0, 100))
        setMetrics((prev) => ({ ...prev, activeAlerts: prev.activeAlerts + 1 }))
        setLastLive(new Date().toLocaleTimeString())
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'ops_alerts',
        filter: `business_id=eq.${businessId}`,
      }, (payload) => {
        const updated = payload.new as OpsAlert
        setAlerts((prev) => prev.map((a) => a.id === updated.id ? updated : a))
      })
      .subscribe()

    const tasksChannel = supabase.channel(`ops-tasks-${businessId}`)
      .on('postgres_changes', {
        event:  'INSERT', schema: 'public', table: 'ops_tasks',
        filter: `business_id=eq.${businessId}`,
      }, (payload) => {
        const newRow = payload.new as OpsTask
        setTasks((prev) => [newRow, ...prev].slice(0, 100))
        setMetrics((prev) => ({ ...prev, activeTasks: prev.activeTasks + 1 }))
        setLastLive(new Date().toLocaleTimeString())
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'ops_tasks',
        filter: `business_id=eq.${businessId}`,
      }, (payload) => {
        const updated = payload.new as OpsTask
        setTasks((prev) => prev.map((t) => t.id === updated.id ? updated : t))
      })
      .subscribe()

    const approvalsChannel = supabase.channel(`ops-approvals-${businessId}`)
      .on('postgres_changes', {
        event:  'INSERT', schema: 'public', table: 'approval_items',
        filter: `business_id=eq.${businessId}`,
      }, (payload) => {
        const newRow = payload.new as ApprovalItem
        setApprovals((prev) => [newRow, ...prev].slice(0, 100))
        setMetrics((prev) => ({ ...prev, pendingApprovals: prev.pendingApprovals + 1 }))
        setLastLive(new Date().toLocaleTimeString())
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'approval_items',
        filter: `business_id=eq.${businessId}`,
      }, (payload) => {
        const updated = payload.new as ApprovalItem
        setApprovals((prev) => prev.map((a) => a.id === updated.id ? updated : a))
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
      const [m, ev, al, tk, ap, he, sy, ru] = await Promise.all([
        getOpsOverview(),
        getOpsEvents(50),
        getOpsAlerts(50),
        getOpsTasks(50),
        getApprovalItems(50),
        getSystemHealthSummary(),
        getClientSystemsSummary(),
        getAutomationRules(),
      ])
      if (!m.error)  setMetrics(m.metrics)
      if (!ev.error) setEvents(ev.events)
      if (!al.error) setAlerts(al.alerts)
      if (!tk.error) setTasks(tk.tasks)
      if (!ap.error) setApprovals(ap.items)
      if (!he.error) setHealth(he.items)
      if (!sy.error) setSystems(sy.systems)
      if (!ru.error) setRules(ru.rules)
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

  const activeAlertCount    = alerts.filter((a) => a.status === 'active').length
  const pendingApprovalCount = approvals.filter((a) => a.status === 'pending').length

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
      {tab === 'overview'   && <OpsOverview metrics={metrics} events={events.slice(0, 5)} alerts={alerts.slice(0, 5)} tasks={tasks.slice(0, 5)} />}
      {tab === 'activity'   && <OpsEventFeed events={events} members={members} businessId={businessId} onRefresh={refresh} />}
      {tab === 'alerts'     && <OpsAlertPanel alerts={alerts} members={members} businessId={businessId} onRefresh={refresh} />}
      {tab === 'tasks'      && <OpsTaskBoard tasks={tasks} members={members} businessId={businessId} onRefresh={refresh} />}
      {tab === 'approvals'  && <ApprovalQueue items={approvals} members={members} businessId={businessId} onRefresh={refresh} />}
      {tab === 'health'     && <SystemHealthPanel items={health} />}
      {tab === 'clients'    && <ClientSystemsPanel systems={systems} />}
      {tab === 'automation' && <AutomationRulesPanel rules={rules} onRefresh={refresh} />}
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
