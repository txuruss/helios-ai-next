'use client'

import { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { runProductionReadinessCheck } from '@/lib/actions/production-readiness'
import type { ReadinessCheck } from '@/lib/actions/production-readiness'
import { capture } from '@/lib/analytics/posthog'

// ── Beta launch checklist items (client-side toggles) ─────────────

const PRODUCT_CHECKS = [
  { key: 'landing_reviewed',      label: 'Landing page reviewed',       href: '/',                             group: 'product' },
  { key: 'demo_reviewed',         label: 'Demo page reviewed',          href: '/demo',                         group: 'product' },
  { key: 'dashboard_loads',       label: 'Mission Control loads',       href: '/dashboard',                    group: 'product' },
  { key: 'inbox_loads',           label: 'Inbox loads',                 href: '/dashboard/inbox',              group: 'product' },
  { key: 'bookings_load',         label: 'Bookings load',               href: '/dashboard/bookings',           group: 'product' },
  { key: 'services_load',         label: 'Services and FAQs load',      href: '/dashboard/services',           group: 'product' },
  { key: 'widget_loads',          label: 'Widget page loads',           href: '/dashboard/widget',             group: 'product' },
  { key: 'templates_load',        label: 'Templates page loads',        href: '/dashboard/templates',          group: 'product' },
  { key: 'audits_load',           label: 'Audits page loads',           href: '/dashboard/audits',             group: 'product' },
  { key: 'onboarding_load',       label: 'Onboarding page loads',       href: '/dashboard/onboarding',         group: 'product' },
  { key: 'billing_loads',         label: 'Settings and billing load',   href: '/dashboard/settings/billing',   group: 'product' },
] as const

const CLIENT_CHECKS = [
  { key: 'profile_created',       label: 'Business profile created',    href: '/dashboard/business',           group: 'client' },
  { key: 'services_added',        label: 'Services added',              href: '/dashboard/services',           group: 'client' },
  { key: 'faqs_added',            label: 'FAQs added',                  href: '/dashboard/services',           group: 'client' },
  { key: 'owner_email_set',       label: 'Owner notification email set',href: '/dashboard/business',           group: 'client' },
  { key: 'widget_tested',         label: 'Widget installed and tested', href: '/dashboard/widget',             group: 'client' },
  { key: 'demo_chat_tested',      label: 'Demo chat tested',            href: '/demo/widget',                  group: 'client' },
  { key: 'booking_tested',        label: 'Booking request tested',      href: '/dashboard/bookings',           group: 'client' },
  { key: 'notification_tested',   label: 'Owner notification tested',   href: '/dashboard/ops?tab=sla',        group: 'client' },
  { key: 'handoff_tested',        label: 'Inbox handoff tested',        href: '/dashboard/inbox',              group: 'client' },
  { key: 'launch_approved',       label: 'Launch approved',             href: '/dashboard/setup',              group: 'client' },
] as const

const SECURITY_CHECKS = [
  { key: 'no_keys_exposed',       label: 'No private keys in UI',       href: '',   group: 'security' },
  { key: 'dashboard_protected',   label: 'Dashboard protected by auth', href: '',   group: 'security' },
  { key: 'public_routes_verified',label: 'Public routes load safely',   href: '/demo', group: 'security' },
  { key: 'rls_enabled',           label: 'RLS enabled in Supabase',     href: '',   group: 'security' },
  { key: 'safe_errors',           label: 'Safe error messages only',    href: '',   group: 'security' },
  { key: 'cron_protected',        label: 'Cron endpoints protected',    href: '/dashboard/ops?tab=sla', group: 'security' },
] as const

type CheckKey =
  typeof PRODUCT_CHECKS[number]['key'] |
  typeof CLIENT_CHECKS[number]['key'] |
  typeof SECURITY_CHECKS[number]['key']

const ALL_CHECKS = [...PRODUCT_CHECKS, ...CLIENT_CHECKS, ...SECURITY_CHECKS]
const REQUIRED_KEYS: CheckKey[] = ['profile_created', 'services_added', 'faqs_added', 'owner_email_set', 'widget_tested', 'demo_chat_tested']

const STATUS_DOT: Record<'configured' | 'missing' | 'optional' | 'warning', string> = {
  configured: 'bg-[#22d093]',
  missing:    'bg-[#ff8a7a]',
  optional:   'bg-[#6a6a6e]',
  warning:    'bg-[#ffae3c]',
}

export default function BetaLaunchChecklist() {
  const [checked,   setChecked]   = useState<Set<CheckKey>>(new Set())
  const [envChecks, setEnvChecks] = useState<ReadinessCheck[]>([])
  const [betaReady, setBetaReady] = useState(false)
  const [reqMissing, setReqMissing] = useState(0)
  const [expanded,  setExpanded]  = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [envLoading, startEnv]    = useTransition()

  useEffect(() => {
    // Load from localStorage for persistence
    try {
      const saved = localStorage.getItem('helios_beta_checklist')
      if (saved) setChecked(new Set(JSON.parse(saved) as CheckKey[]))
    } catch { /* non-fatal */ }
    capture('beta_launch_checklist_viewed', {})
  }, [])

  const toggle = (key: CheckKey) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      try { localStorage.setItem('helios_beta_checklist', JSON.stringify([...next])) } catch { /* non-fatal */ }
      capture('beta_launch_checklist_updated', { check_key: key, status: next.has(key) ? 'checked' : 'unchecked' })
      return next
    })
  }

  const runEnvCheck = () => {
    setError(null)
    startEnv(async () => {
      const result = await runProductionReadinessCheck()
      if (result.error) { setError(result.error); return }
      setEnvChecks(result.checks)
      setBetaReady(result.betaReady)
      setReqMissing(result.requiredMissing)
    })
  }

  const totalChecks   = ALL_CHECKS.length
  const doneChecks    = checked.size
  const percent       = Math.round((doneChecks / totalChecks) * 100)
  const allProductDone = PRODUCT_CHECKS.every((c) => checked.has(c.key))
  const allClientDone  = REQUIRED_KEYS.every((k) => checked.has(k))
  const isBetaReady    = allProductDone && allClientDone && betaReady

  const renderGroup = (
    title: string,
    items: readonly { key: CheckKey; label: string; href: string }[],
  ) => (
    <div className="border border-white/[0.07] rounded-2xl bg-[#0f1012] overflow-hidden">
      <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between">
        <p className="text-[12.5px] font-semibold text-white">{title}</p>
        <span className="text-[11px] text-[#6a6a6e]">
          {items.filter((c) => checked.has(c.key)).length}/{items.length}
        </span>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {items.map((item) => {
          const done = checked.has(item.key)
          return (
            <div key={item.key} className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.015] transition-colors">
              <button onClick={() => toggle(item.key)}
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                  done ? 'border-[#22d093] bg-[#22d093]' : 'border-white/[0.20] hover:border-white/40'
                }`}>
                {done && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="m4 12 5 5 11-12"/></svg>}
              </button>
              <p className={`text-[12.5px] flex-1 ${done ? 'text-[#6a6a6e] line-through' : 'text-white'}`}>{item.label}</p>
              {item.href && !done && (
                <a href={item.href} target={item.href.startsWith('/dashboard') ? '_self' : '_blank'} rel="noopener noreferrer"
                  className="text-[11px] text-[#6a6a6e] hover:text-white transition-colors shrink-0">
                  Check →
                </a>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-4 border-t border-white/[0.06] pt-6 mt-6">
      {/* Header */}
      <button onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between text-left hover:bg-white/[0.01] transition-colors rounded-lg -mx-1 px-1 py-1">
        <div>
          <p className="text-[13px] font-semibold text-white flex items-center gap-2">
            🚀 Beta Launch Readiness
            {isBetaReady && <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-[#22d093]/15 text-[#22d093] font-medium">Beta Ready</span>}
          </p>
          <div className="flex items-center gap-3 mt-1">
            <div className="w-32 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${percent}%`, background: isBetaReady ? '#22d093' : 'linear-gradient(90deg,#ff8a2a,#ffae3c)' }} />
            </div>
            <span className="text-[11px] text-[#6a6a6e]">{percent}% complete</span>
          </div>
        </div>
        <span className="text-[#6a6a6e] text-[12px] shrink-0">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="flex flex-col gap-4">
          {/* Progress */}
          <div className="grid grid-cols-3 gap-3 text-center text-[12px]">
            <div className="border border-white/[0.07] rounded-xl px-3 py-2.5 bg-[#0f1012]">
              <p className="text-[18px] font-semibold text-white">{doneChecks}/{totalChecks}</p>
              <p className="text-[#6a6a6e]">Checks done</p>
            </div>
            <div className={`border rounded-xl px-3 py-2.5 ${reqMissing > 0 ? 'border-[#ff8a7a]/20 bg-[#ff8a7a]/[0.04]' : 'border-white/[0.07] bg-[#0f1012]'}`}>
              <p className="text-[18px] font-semibold" style={{ color: reqMissing > 0 ? '#ff8a7a' : '#22d093' }}>{reqMissing}</p>
              <p className="text-[#6a6a6e]">Env missing</p>
            </div>
            <div className={`border rounded-xl px-3 py-2.5 ${isBetaReady ? 'border-[#22d093]/20 bg-[#22d093]/[0.04]' : 'border-white/[0.07] bg-[#0f1012]'}`}>
              <p className="text-[18px]">{isBetaReady ? '✅' : '⏳'}</p>
              <p className="text-[#6a6a6e]">{isBetaReady ? 'Beta Ready' : 'In Progress'}</p>
            </div>
          </div>

          {/* Environment check */}
          <div className="border border-white/[0.07] rounded-2xl bg-[#0f1012] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between">
              <p className="text-[12.5px] font-semibold text-white">Environment Variables</p>
              <button onClick={runEnvCheck} disabled={envLoading}
                className="h-7 px-3 rounded-lg text-[11.5px] border border-white/[0.10] text-[#9a9a9d] hover:bg-white/[0.04] hover:text-white transition-all disabled:opacity-40">
                {envLoading ? 'Checking…' : '↻ Run Check'}
              </button>
            </div>
            {error && <p className="px-5 py-3 text-[12px] text-[#ff8a7a]">{error}</p>}
            {envChecks.length === 0 && !envLoading && (
              <div className="px-5 py-4 text-center">
                <p className="text-[12.5px] text-[#6a6a6e]">Click "Run Check" to verify your environment variables.</p>
              </div>
            )}
            {envChecks.length > 0 && (
              <div className="divide-y divide-white/[0.04]">
                {envChecks.map((c) => (
                  <div key={c.key} className="flex items-center gap-3 px-5 py-2.5">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[c.status]}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] text-white">{c.label}</p>
                      <p className="text-[11px] text-[#6a6a6e] truncate">{c.description}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {c.required && <span className="text-[9.5px] text-[#ffae3c] uppercase font-semibold">Required</span>}
                      <span className={`text-[10px] font-medium capitalize ${
                        c.status === 'configured' ? 'text-[#22d093]' :
                        c.status === 'missing'    ? 'text-[#ff8a7a]' :
                        c.status === 'warning'    ? 'text-[#ffae3c]' :
                                                    'text-[#6a6a6e]'
                      }`}>{c.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {renderGroup('Product Readiness', PRODUCT_CHECKS)}
          {renderGroup('Client Readiness', CLIENT_CHECKS)}
          {renderGroup('Security Checklist', SECURITY_CHECKS)}

          {/* CTAs */}
          <div className="flex gap-2 flex-wrap pt-2">
            <a href="/demo" target="_blank" rel="noopener noreferrer"
              className="h-9 px-4 rounded-[10px] text-[13px] border border-[#ff7a18]/30 bg-[#ff7a18]/[0.08] text-[#ffae3c] hover:bg-[#ff7a18]/15 transition-all">
              View /demo →
            </a>
            <a href="/dashboard/onboarding"
              className="h-9 px-4 rounded-[10px] text-[13px] border border-white/[0.10] text-[#9a9a9d] hover:bg-white/[0.04] hover:text-white transition-all">
              Onboarding →
            </a>
            <a href="/dashboard/delivery"
              className="h-9 px-4 rounded-[10px] text-[13px] border border-white/[0.10] text-[#9a9a9d] hover:bg-white/[0.04] hover:text-white transition-all">
              Delivery Pipeline →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
