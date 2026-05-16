'use client'

import { useState, useEffect, useTransition } from 'react'
import { capture } from '@/lib/analytics/posthog'
import {
  getOpsOverview, getOpsEvents, getOpsTasks, getOpsAlerts,
  getApprovalItems, getSystemHealthSummary, getClientSystemsSummary,
} from '@/lib/actions/ops'
import type {
  OpsOverviewMetrics, OpsEvent, OpsTask, OpsAlert,
  ApprovalItem, SystemHealthItem, ClientSystem,
} from '@/lib/actions/ops'
import OpsOverview       from './OpsOverview'
import OpsEventFeed      from './OpsEventFeed'
import OpsAlertPanel     from './OpsAlertPanel'
import OpsTaskBoard      from './OpsTaskBoard'
import ApprovalQueue     from './ApprovalQueue'
import SystemHealthPanel from './SystemHealthPanel'
import ClientSystemsPanel from './ClientSystemsPanel'

export type OpsTab = 'overview' | 'activity' | 'alerts' | 'tasks' | 'approvals' | 'health' | 'clients'

const TABS: Array<{ id: OpsTab; label: string }> = [
  { id: 'overview',   label: 'Overview'       },
  { id: 'activity',   label: 'Activity'       },
  { id: 'alerts',     label: 'Alerts'         },
  { id: 'tasks',      label: 'Tasks'          },
  { id: 'approvals',  label: 'Approvals'      },
  { id: 'health',     label: 'System Health'  },
  { id: 'clients',    label: 'Client Systems' },
]

interface Props {
  initialTab:      OpsTab
  initialMetrics:  OpsOverviewMetrics
  initialEvents:   OpsEvent[]
  initialAlerts:   OpsAlert[]
  initialTasks:    OpsTask[]
  initialApprovals: ApprovalItem[]
  initialHealth:   SystemHealthItem[]
  initialSystems:  ClientSystem[]
  businessId:      string | null
  plan:            string
}

export default function OpsCenterClient({
  initialTab, initialMetrics, initialEvents, initialAlerts, initialTasks,
  initialApprovals, initialHealth, initialSystems, businessId, plan,
}: Props) {
  const [tab,       setTab]       = useState<OpsTab>(initialTab)
  const [metrics,   setMetrics]   = useState(initialMetrics)
  const [events,    setEvents]    = useState(initialEvents)
  const [alerts,    setAlerts]    = useState(initialAlerts)
  const [tasks,     setTasks]     = useState(initialTasks)
  const [approvals, setApprovals] = useState(initialApprovals)
  const [health,    setHealth]    = useState(initialHealth)
  const [systems,   setSystems]   = useState(initialSystems)
  const [pending,   startTransition] = useTransition()

  useEffect(() => {
    capture('ops_center_viewed', { tab, plan })
  }, [tab, plan])

  const refresh = () => {
    startTransition(async () => {
      const [m, ev, al, tk, ap, he, sy] = await Promise.all([
        getOpsOverview(),
        getOpsEvents(30),
        getOpsAlerts(30),
        getOpsTasks(30),
        getApprovalItems(30),
        getSystemHealthSummary(),
        getClientSystemsSummary(),
      ])
      if (!m.error)  setMetrics(m.metrics)
      if (!ev.error) setEvents(ev.events)
      if (!al.error) setAlerts(al.alerts)
      if (!tk.error) setTasks(tk.tasks)
      if (!ap.error) setApprovals(ap.items)
      if (!he.error) setHealth(he.items)
      if (!sy.error) setSystems(sy.systems)
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6a6a6e] mb-1">Ops Center</p>
          <h1 className="text-[24px] font-semibold tracking-tight text-white">Operations</h1>
          <p className="text-[13px] text-[#6a6a6e] mt-1">
            Events, alerts, tasks, approvals, and system health across all integrations.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={refresh}
            disabled={pending}
            className="h-9 px-4 rounded-[10px] text-[13px] border border-white/[0.10] bg-white/[0.04]
                       text-[#9a9a9d] hover:bg-white/[0.08] transition-all disabled:opacity-40"
          >
            {pending ? 'Refreshing…' : '↻ Refresh'}
          </button>
          <a
            href="/dashboard"
            className="h-9 px-4 rounded-[10px] text-[13px] border border-[#ff7a18]/30 bg-[#ff7a18]/[0.08] text-[#ffae3c] hover:bg-[#ff7a18]/15 transition-all"
          >
            ← Mission Control
          </a>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-white/[0.06] overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-[13px] font-medium transition-all whitespace-nowrap border-b-2 -mb-px
                        ${tab === t.id
                          ? 'text-white border-[#ff7a18]'
                          : 'text-[#6a6a6e] border-transparent hover:text-[#9a9a9d]'}`}
          >
            {t.label}
            {t.id === 'alerts'    && alerts.filter((a) => a.status === 'active').length > 0 && (
              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-[#ff8a7a]/20 text-[#ff8a7a]">
                {alerts.filter((a) => a.status === 'active').length}
              </span>
            )}
            {t.id === 'approvals' && approvals.filter((a) => a.status === 'pending').length > 0 && (
              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-[#ffae3c]/20 text-[#ffae3c]">
                {approvals.filter((a) => a.status === 'pending').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview'  && <OpsOverview metrics={metrics} events={events.slice(0, 5)} alerts={alerts.slice(0, 5)} tasks={tasks.slice(0, 5)} />}
      {tab === 'activity'  && <OpsEventFeed events={events} onRefresh={refresh} />}
      {tab === 'alerts'    && <OpsAlertPanel alerts={alerts} onRefresh={refresh} />}
      {tab === 'tasks'     && <OpsTaskBoard tasks={tasks} onRefresh={refresh} />}
      {tab === 'approvals' && <ApprovalQueue items={approvals} onRefresh={refresh} />}
      {tab === 'health'    && <SystemHealthPanel items={health} />}
      {tab === 'clients'   && <ClientSystemsPanel systems={systems} />}
    </div>
  )
}
