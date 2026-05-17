'use client'

import { useState, useTransition, useEffect } from 'react'
import {
  createBusinessAudit,
  runBusinessAudit,
  getBusinessAuditById,
  archiveBusinessAudit,
} from '@/lib/actions/audits'
import type { BusinessAudit, AuditFinding, AuditRecommendation } from '@/lib/actions/audits'
import { getScoreLabel, getScoreColor } from '@/lib/validation/audits'
import AuditScoreCard           from './AuditScoreCard'
import AuditFindingsList        from './AuditFindingsList'
import AuditRecommendationCard  from './AuditRecommendationCard'
import AuditReportPanel         from './AuditReportPanel'
import { capture }              from '@/lib/analytics/posthog'

interface Props {
  initialAudits: BusinessAudit[]
  loadError:     string | null
}

function relTime(ts: string): string {
  const d = Date.now() - new Date(ts).getTime()
  const m = Math.floor(d / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
}

const PLAN_LABEL: Record<string, string> = { starter: 'Starter', pro: 'Booking OS', scale: 'Ops Center' }

export default function AuditDashboardClient({ initialAudits, loadError }: Props) {
  const [audits,    setAudits]    = useState(initialAudits)
  const [active,    setActive]    = useState<BusinessAudit | null>(initialAudits.find((a) => a.status === 'completed') ?? null)
  const [findings,  setFindings]  = useState<AuditFinding[]>([])
  const [rec,       setRec]       = useState<AuditRecommendation | null>(null)
  const [error,     setError]     = useState<string | null>(loadError)
  const [running,   startRun]     = useTransition()
  const [loading,   startLoad]    = useTransition()
  const [tab,       setTab]       = useState<'score'|'findings'|'recommendation'|'report'>('score')

  useEffect(() => {
    capture('audit_page_viewed', {})
  }, [])

  // Load findings when active audit changes
  useEffect(() => {
    if (!active || active.status !== 'completed') return
    startLoad(async () => {
      const result = await getBusinessAuditById(active.id)
      if (!result.error) {
        setFindings(result.findings)
        setRec(result.recommendation)
      }
    })
  }, [active?.id])

  const handleRunNew = () => {
    setError(null)
    startRun(async () => {
      // Create + run in sequence
      const created = await createBusinessAudit({ audit_name: `Audit ${new Date().toLocaleDateString()}` })
      if (created.error) { setError(created.error); return }

      const auditId = created.id!
      setAudits((prev) => [{
        id: auditId, business_id: '', audit_name: `Audit ${new Date().toLocaleDateString()}`,
        business_name: null, business_type: null, city: null,
        status: 'running', overall_score: 0, response_score: 0, booking_score: 0,
        lead_capture_score: 0, trust_score: 0, automation_score: 0,
        recommended_plan: null, estimated_revenue_risk: null, summary: null,
        completed_at: null, created_at: new Date().toISOString(), metadata: {},
      }, ...prev])

      const runResult = await runBusinessAudit(auditId)
      if (runResult.error) { setError(runResult.error); return }

      // Reload the completed audit
      const res = await getBusinessAuditById(auditId)
      if (res.audit) {
        setAudits((prev) => prev.map((a) => a.id === auditId ? res.audit! : a))
        setActive(res.audit)
        setFindings(res.findings)
        setRec(res.recommendation)
        setTab('score')
      }
    })
  }

  const handleSelect = (audit: BusinessAudit) => {
    setActive(audit)
    setTab('score')
    if (audit.status !== 'completed') return
    startLoad(async () => {
      const res = await getBusinessAuditById(audit.id)
      if (!res.error) { setFindings(res.findings); setRec(res.recommendation) }
    })
  }

  const handleArchive = (id: string) => {
    startLoad(async () => {
      await archiveBusinessAudit(id)
      setAudits((prev) => prev.filter((a) => a.id !== id))
      if (active?.id === id) { setActive(null); setFindings([]); setRec(null) }
    })
  }

  const TABS = [
    { id: 'score',          label: 'Score' },
    { id: 'findings',       label: `Findings${findings.length > 0 ? ` (${findings.length})` : ''}` },
    { id: 'recommendation', label: 'Package' },
    { id: 'report',         label: 'Report' },
  ] as const

  return (
    <div className="flex flex-col gap-6">
      {error && <p className="text-[12.5px] text-[#ff8a7a]">{error}</p>}

      {/* Run audit button */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={handleRunNew} disabled={running}
          className="h-10 px-5 rounded-[10px] text-[13.5px] font-medium bg-gradient-to-b from-[#ff8a2a] to-[#ee6a0c] text-[#1a0c00] hover:opacity-90 transition-opacity disabled:opacity-40">
          {running ? '⋯ Running audit…' : '▶ Run New Audit'}
        </button>
        {running && <p className="text-[12.5px] text-[#6a6a6e]">Checking your system… this takes a few seconds.</p>}
      </div>

      {audits.length === 0 && !running ? (
        <div className="border border-white/[0.07] rounded-2xl p-12 text-center bg-[#0f1012]">
          <div className="text-[40px] mb-4">📊</div>
          <h3 className="text-[18px] font-semibold text-white mb-2">No audits yet</h3>
          <p className="text-[14px] text-[#9a9a9d] mb-5 max-w-[400px] mx-auto">
            Run your first audit to see your booking readiness score, gaps, and recommended Helios AI package.
          </p>
          <button onClick={handleRunNew} disabled={running}
            className="h-10 px-6 rounded-[10px] text-[13.5px] font-medium bg-gradient-to-b from-[#ff8a2a] to-[#ee6a0c] text-[#1a0c00] hover:opacity-90 disabled:opacity-40">
            Run Deployment Audit
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
          {/* Left: history */}
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6a6a6e] px-1">Audit History</p>
            {audits.map((a) => {
              const scoreColor = getScoreColor(a.overall_score)
              const isActive   = active?.id === a.id
              return (
                <div key={a.id}
                  onClick={() => handleSelect(a)}
                  className={`border rounded-2xl p-4 cursor-pointer transition-all ${
                    isActive
                      ? 'border-[#ff7a18]/30 bg-[#ff7a18]/[0.06]'
                      : 'border-white/[0.07] bg-[#0f1012] hover:border-white/[0.12]'
                  }`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[12.5px] font-medium text-white truncate">{a.audit_name}</p>
                    {a.status === 'completed' && (
                      <span className="text-[13px] font-semibold shrink-0 ml-2" style={{ color: scoreColor }}>
                        {a.overall_score}
                      </span>
                    )}
                    {a.status === 'running' && (
                      <span className="w-3 h-3 rounded-full border-2 border-[#ffae3c] border-t-transparent animate-spin shrink-0 ml-2" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {a.status === 'completed' && (
                      <span className="text-[10.5px]" style={{ color: scoreColor }}>
                        {getScoreLabel(a.overall_score)}
                      </span>
                    )}
                    {a.recommended_plan && (
                      <span className="text-[10px] text-[#ffae3c]">{PLAN_LABEL[a.recommended_plan] ?? a.recommended_plan}</span>
                    )}
                    <span className="text-[10px] text-[#6a6a6e]">{relTime(a.created_at)}</span>
                  </div>
                  {isActive && a.status === 'completed' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleArchive(a.id) }}
                      className="mt-2 text-[10.5px] text-[#6a6a6e] hover:text-[#ff8a7a] transition-colors">
                      Archive
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Right: detail */}
          {active && active.status === 'completed' && (
            <div className="flex flex-col gap-4">
              {/* Tabs */}
              <div className="flex gap-1.5 flex-wrap">
                {TABS.map((t) => (
                  <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
                    className={`h-8 px-3.5 rounded-lg text-[12.5px] transition-all ${
                      tab === t.id
                        ? 'bg-[#ff7a18]/[0.15] border border-[#ff7a18]/30 text-[#ffae3c]'
                        : 'border border-white/[0.08] text-[#9a9a9d] hover:bg-white/[0.04] hover:text-white'
                    }`}>
                    {t.label}
                  </button>
                ))}
              </div>

              {tab === 'score'          && <AuditScoreCard audit={active} />}
              {tab === 'findings'       && <AuditFindingsList findings={findings} />}
              {tab === 'recommendation' && rec && <AuditRecommendationCard recommendation={rec} />}
              {tab === 'recommendation' && !rec && <p className="text-[13px] text-[#6a6a6e]">No recommendation generated.</p>}
              {tab === 'report'         && <AuditReportPanel auditId={active.id} />}
            </div>
          )}

          {active && active.status === 'running' && (
            <div className="border border-white/[0.07] rounded-2xl p-12 text-center bg-[#0f1012]">
              <div className="w-10 h-10 rounded-full border-4 border-[#ffae3c] border-t-transparent animate-spin mx-auto mb-4" />
              <p className="text-[14px] font-semibold text-white">Running audit…</p>
              <p className="text-[12.5px] text-[#9a9a9d] mt-1">Checking services, bookings, leads, and system configuration.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
