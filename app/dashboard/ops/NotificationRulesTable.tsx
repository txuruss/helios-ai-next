'use client'

import { useState, useTransition } from 'react'
import { toggleNotificationRule, deleteNotificationRule } from '@/lib/actions/ops'
import type { NotificationRule, BusinessMember } from '@/lib/actions/ops'
import { capture } from '@/lib/analytics/posthog'
import NotificationRuleDrawer from './NotificationRuleDrawer'

interface Props {
  rules:     NotificationRule[]
  members:   BusinessMember[]
  onRefresh: () => void
}

const CHANNEL_ICON: Record<string, string> = { email: '📧', dashboard: '🔔', none: '🔕' }
const RECIPIENT_LABEL: Record<string, string> = {
  owner: 'Owner', assigned_user: 'Assigned', all_admins: 'All Admins', custom_email: 'Custom',
}

function relTime(ts: string | null): string {
  if (!ts) return '—'
  const d = Date.now() - new Date(ts).getTime()
  const m = Math.floor(d / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}

export default function NotificationRulesTable({ rules, members, onRefresh }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editRule,   setEditRule]   = useState<NotificationRule | null>(null)
  const [testMsg,    setTestMsg]    = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const [togglePending, startToggle] = useTransition()
  const [delPending,    startDel]    = useTransition()
  const [testPending,   startTest]   = useTransition()

  const openCreate  = () => { setEditRule(null); setDrawerOpen(true) }
  const openEdit    = (r: NotificationRule) => { setEditRule(r); setDrawerOpen(true) }
  const closeDrawer = () => { setDrawerOpen(false); setEditRule(null) }

  const handleToggle = (id: string, current: boolean) => {
    startToggle(async () => {
      await toggleNotificationRule(id, !current)
      capture('ops_notification_rule_toggled', { enabled: !current })
      onRefresh()
    })
  }

  const handleDelete = (id: string) => {
    if (!confirm('Delete this notification rule?')) return
    setError(null)
    startDel(async () => {
      const result = await deleteNotificationRule(id)
      if (result.error) { setError(result.error); return }
      capture('ops_notification_rule_deleted', {})
      onRefresh()
    })
  }

  const handleTest = (ruleId: string) => {
    setTestMsg((prev) => ({ ...prev, [ruleId]: '' }))
    startTest(async () => {
      try {
        const res = await fetch('/api/ops/notifications/test', {
          method:      'POST',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          body:        JSON.stringify({ rule_id: ruleId }),
        })
        const data = await res.json() as { ok?: boolean; error?: string; sent_to?: string }
        if (!res.ok) {
          setTestMsg((prev) => ({ ...prev, [ruleId]: `Error: ${data.error ?? 'Failed'}` }))
          return
        }
        capture('ops_notification_test_sent', {})
        setTestMsg((prev) => ({ ...prev, [ruleId]: `✓ Sent to ${data.sent_to}` }))
        onRefresh()
      } catch {
        setTestMsg((prev) => ({ ...prev, [ruleId]: 'Network error.' }))
      }
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-semibold text-[#6a6a6e] uppercase tracking-[0.12em]">Notification Rules</p>
        <button onClick={openCreate}
          className="h-8 px-3 rounded-lg text-[12px] bg-gradient-to-b from-[#ff8a2a] to-[#ee6a0c] text-[#1a0c00] font-medium hover:opacity-90 transition-opacity">
          + Create Rule
        </button>
      </div>

      {error && <p className="text-[12px] text-[#ff8a7a]">{error}</p>}

      {rules.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center rounded-2xl border border-white/[0.07] bg-[#0f1012]">
          <span className="text-[22px]">🔔</span>
          <p className="text-[13px] font-medium text-white">No notification rules</p>
          <p className="text-[12px] text-[#6a6a6e]">Create a rule or seed defaults.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.07] bg-[#0f1012] overflow-hidden">
          <div className="divide-y divide-white/[0.04]">
            {rules.map((r) => {
              const lastTestedRule = r as { last_tested_at?: string | null; last_test_status?: string | null }
              return (
                <div key={r.id} className="px-5 py-3.5">
                  <div className="flex items-center gap-4">
                    <button onClick={() => handleToggle(r.id, r.is_enabled)} disabled={togglePending}
                      className={`w-9 h-5 rounded-full transition-colors shrink-0 relative disabled:opacity-40 ${r.is_enabled ? 'bg-[#22d093]' : 'bg-white/[0.12]'}`}>
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${r.is_enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] font-medium ${r.is_enabled ? 'text-white' : 'text-[#6a6a6e]'}`}>{r.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10.5px] text-[#6a6a6e] capitalize">{r.trigger_type.replace(/_/g,' ')}</span>
                        {r.source   && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-[#9a9a9d]">{r.source}</span>}
                        {r.severity && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-[#9a9a9d]">{r.severity}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[14px]">{CHANNEL_ICON[r.channel] ?? '🔔'}</span>
                      <div className="text-right">
                        <p className="text-[11px] text-[#9a9a9d] capitalize">{r.channel}</p>
                        <p className="text-[10px] text-[#6a6a6e]">{RECIPIENT_LABEL[r.recipient_type]}</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      {r.channel === 'email' && (
                        <button onClick={() => handleTest(r.id)} disabled={testPending}
                          className="h-7 px-2.5 rounded-lg text-[11px] border border-[#3b9eff]/30 text-[#3b9eff] hover:bg-[#3b9eff]/10 transition-all disabled:opacity-40">
                          Test
                        </button>
                      )}
                      <button onClick={() => openEdit(r)}
                        className="h-7 px-2.5 rounded-lg text-[11px] border border-white/[0.10] text-[#9a9a9d] hover:bg-white/[0.06] transition-all">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(r.id)} disabled={delPending}
                        className="h-7 px-2.5 rounded-lg text-[11px] border border-[#ff8a7a]/20 text-[#ff8a7a] hover:bg-[#ff8a7a]/10 transition-all disabled:opacity-40">
                        Del
                      </button>
                    </div>
                  </div>

                  {/* Test status */}
                  {testMsg[r.id] && (
                    <p className={`text-[11px] mt-1.5 ml-14 ${testMsg[r.id].startsWith('✓') ? 'text-[#22d093]' : 'text-[#ff8a7a]'}`}>
                      {testMsg[r.id]}
                    </p>
                  )}
                  {lastTestedRule.last_tested_at && !testMsg[r.id] && (
                    <p className="text-[10.5px] mt-1 ml-14 text-[#6a6a6e]">
                      Last tested: {relTime(lastTestedRule.last_tested_at)}
                      {lastTestedRule.last_test_status === 'failed' && <span className="text-[#ff8a7a] ml-1">failed</span>}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {drawerOpen && (
        <NotificationRuleDrawer rule={editRule} members={members} onClose={closeDrawer} onSaved={() => { onRefresh(); closeDrawer() }} />
      )}
    </div>
  )
}
