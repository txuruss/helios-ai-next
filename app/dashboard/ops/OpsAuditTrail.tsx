'use client'

import { useState, useTransition, useEffect, useCallback } from 'react'
import { getOpsAuditTrailAction } from '@/lib/actions/ops'
import type { AuditTrailRow } from '@/lib/ops/audit'
import SearchPaginationBar from './SearchPaginationBar'

const PAGE_SIZE = 20

interface Props {
  initialRows:  AuditTrailRow[]
  initialTotal: number
}

function relTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const m    = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
}

const ACTION_ICON: Record<string, string> = {
  status_changed: '🔄', assigned: '👤', unassigned: '👤',
  'bulk.resolve': '✓', 'bulk.complete': '✓', 'bulk.acknowledge': '✓',
  'bulk.approve': '✅', 'bulk.reject': '❌', 'bulk.assigned': '👥',
  automation_rule_created: '⚙', automation_rule_updated: '⚙', automation_rule_deleted: '🗑',
  sla_policy_created: '⏱', sla_policy_updated: '⏱', sla_policy_deleted: '🗑',
  notification_rule_created: '🔔', notification_rule_updated: '🔔', notification_rule_deleted: '🗑',
  notification_test_sent: '📧', item_snoozed: '💤', item_unsnoozed: '🔔',
}

export default function OpsAuditTrail({ initialRows, initialTotal }: Props) {
  const [rows,       setRows]       = useState(initialRows)
  const [totalCount, setTotalCount] = useState(initialTotal)
  const [search,     setSearch]     = useState('')
  const [page,       setPage]       = useState(1)
  const [expanded,   setExpanded]   = useState<Set<string>>(new Set())

  const [searchPending, startSearch] = useTransition()

  useEffect(() => {
    setRows(initialRows); setTotalCount(initialTotal); setPage(1)
  }, [initialRows, initialTotal])

  const loadPage = useCallback((p: number, s: string) => {
    startSearch(async () => {
      const result = await getOpsAuditTrailAction({ search: s || undefined, page: p, pageSize: PAGE_SIZE })
      setRows(result.rows); setTotalCount(result.total_count)
    })
  }, [])

  const handleSearch = (s: string) => { setSearch(s); setPage(1); loadPage(1, s) }
  const handlePage   = (p: number) => { setPage(p); loadPage(p, search) }
  const totalPages   = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const toggleExpand = (id: string) => {
    setExpanded((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  if (rows.length === 0 && !search) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center rounded-2xl border border-white/[0.07] bg-[#0f1012]">
        <span className="text-[22px]">📋</span>
        <p className="text-[13px] font-medium text-white">No audit trail yet</p>
        <p className="text-[12px] text-[#6a6a6e]">Actions on Ops items will appear here.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <SearchPaginationBar search={search} onSearch={handleSearch} page={page} totalPages={totalPages} total={totalCount} pageSize={PAGE_SIZE} onPage={handlePage} placeholder="Search audit trail…" loading={searchPending} />

      <div className="rounded-2xl border border-white/[0.07] bg-[#0f1012] overflow-hidden">
        {rows.length === 0 ? (
          <div className="px-5 py-6 text-center text-[12px] text-[#6a6a6e]">No results for "{search}"</div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {rows.map((row) => {
              const icon      = ACTION_ICON[row.action.split('.')[0]] ?? ACTION_ICON[row.action] ?? '•'
              const action    = row.action.replace(/_/g, ' ').replace(/\./g, ' › ')
              const isExpanded = expanded.has(row.id)
              const hasDiff   = !!(row.before_state || row.after_state)

              return (
                <div key={row.id} className="px-5 py-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 text-[14px] shrink-0">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-medium text-white capitalize">{action}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10.5px] text-[#6a6a6e] font-mono">{row.target_table}</span>
                        {row.actor_label && <span className="text-[10.5px] text-[#6a6a6e]">by {row.actor_label}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10.5px] text-[#6a6a6e] font-mono">{relTime(row.created_at)}</span>
                      {hasDiff && (
                        <button onClick={() => toggleExpand(row.id)} className="text-[10.5px] text-[#6a6a6e] hover:text-[#9a9a9d] transition-colors">
                          {isExpanded ? '▲' : '▼'}
                        </button>
                      )}
                    </div>
                  </div>
                  {isExpanded && hasDiff && (
                    <div className="mt-2 ml-8 text-[10.5px] text-[#6a6a6e] font-mono flex gap-4 flex-wrap">
                      {row.before_state && <span>before: {JSON.stringify(row.before_state).slice(0, 80)}</span>}
                      {row.after_state  && <span className="text-[#22d093]">after: {JSON.stringify(row.after_state).slice(0, 80)}</span>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
