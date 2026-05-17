'use client'

import { useActionState, useEffect, useTransition } from 'react'
import { createCheckoutSessionAction, createPortalSessionAction } from '@/lib/actions/billing'
import { ALL_PLANS, getPlanDisplayName } from '@/lib/billing/plans'
import { trackBillingPageViewed, trackCheckoutStarted, trackPortalOpened } from '@/lib/analytics/events'
import type { Plan, PlanLimits } from '@/lib/billing/plans'
import type { Subscription } from '@/types'

interface UsageSummary { ai_conversations: number; leads: number; bookings: number }

interface Props {
  subscription:   Subscription | null
  usageSummary:   UsageSummary
  planLimits:     PlanLimits
  currentPlanId:  string
  stripeReady:    boolean
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct  = limit > 0 ? Math.min((used / limit) * 100, 100) : 0
  const over = used >= limit
  return (
    <div>
      <div className="flex justify-between mb-1.5">
        <span className="text-[12.5px] text-[#9a9a9d]">{label}</span>
        <span className={`text-[12px] font-mono ${over ? 'text-[#ff8a7a]' : 'text-[#9a9a9d]'}`}>
          {used.toLocaleString()} / {limit.toLocaleString()}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: over ? '#ff6a5a' : pct > 80 ? '#ffb547' : '#22d093' }}
        />
      </div>
    </div>
  )
}

function PlanCard({
  plan, isCurrent, stripeReady,
}: {
  plan: Plan; isCurrent: boolean; stripeReady: boolean
}) {
  const [state, formAction, pending] = useActionState(createCheckoutSessionAction, {})

  if (state.url && typeof window !== 'undefined') {
    window.location.href = state.url
  }

  const isRecommended = plan.recommended

  return (
    <div className={`relative border rounded-2xl p-6 flex flex-col gap-4 transition-all ${
      isRecommended
        ? 'border-[#ff7a18]/40 bg-gradient-to-b from-[#ff7a18]/[0.06] to-transparent'
        : 'border-white/10 bg-[#0f1012]/60'
    }`}>
      {isRecommended && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10.5px] font-semibold px-3 py-1 rounded-full
                         bg-gradient-to-b from-[#ff8a2a] to-[#ee6a0c] text-[#1a0c00] tracking-[0.04em]">
          Recommended
        </span>
      )}

      {/* Name */}
      <div>
        <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ffae3c] mb-1">
          {plan.displayName}
        </div>
        <p className="text-[13px] text-[#6a6a6e]">{plan.bestFor}</p>
      </div>

      {/* Price ranges */}
      <div className="border-y border-white/[0.06] py-3.5 flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#6a6a6e]">Setup</span>
          <span className="font-mono text-[13px] text-white font-medium">{plan.setupFeeRange}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#6a6a6e]">Monthly</span>
          <span className="font-mono text-[13px] text-[#ffae3c] font-medium">{plan.monthlyRange}</span>
        </div>
      </div>

      {/* Features */}
      <ul className="flex flex-col gap-2 flex-1">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-[13px] text-[#9a9a9d]">
            <svg className="mt-0.5 shrink-0 text-[#22d093]" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"><path d="m4 12 5 5 11-12"/></svg>
            {f}
          </li>
        ))}
      </ul>

      {/* Usage limit hint */}
      <p className="text-[11px] text-[#6a6a6e]">
        {plan.limits.ai_conversations_month.toLocaleString()} AI convos ·{' '}
        {plan.limits.leads_month.toLocaleString()} leads ·{' '}
        {plan.limits.bookings_month.toLocaleString()} bookings / mo
      </p>

      {state.error && (
        <p className="text-[12px] text-[#ff8a7a]">{state.error}</p>
      )}

      {isCurrent ? (
        <div className="h-10 rounded-[10px] flex items-center justify-center text-[13px]
                        border border-[#22d093]/30 text-[#22d093] bg-[#22d093]/[0.06]">
          Current Plan
        </div>
      ) : (
        <form action={formAction}>
          <input type="hidden" name="plan_id" value={plan.id} />
          <button
            type="submit"
            disabled={pending || !stripeReady}
            className={`w-full h-10 rounded-[10px] text-[13.5px] font-medium transition-all disabled:opacity-50 ${
              isRecommended
                ? 'bg-gradient-to-b from-[#ff8a2a] to-[#ee6a0c] text-[#1a0c00]'
                : 'border border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]'
            }`}>
            {pending ? 'Redirecting…' : !stripeReady ? 'Contact to Upgrade' : plan.cta}
          </button>
        </form>
      )}
    </div>
  )
}

export default function BillingDashboard({
  subscription, usageSummary, planLimits, currentPlanId, stripeReady,
}: Props) {
  const [portalState, portalAction, portalPending] = useActionState(createPortalSessionAction, {})
  const [, startNav] = useTransition()

  useEffect(() => { trackBillingPageViewed('', currentPlanId) }, [currentPlanId])

  if (portalState.url && typeof window !== 'undefined') {
    startNav(() => { window.location.href = portalState.url! })
  }

  const displayName = getPlanDisplayName(currentPlanId)
  const status      = subscription?.status
  const nextRenewal = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <div className="flex flex-col gap-8">
      {/* Current plan card */}
      <div className="border border-white/10 rounded-2xl p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#6a6a6e] mb-1">Current Plan</div>
            <div className="text-[22px] font-semibold">{displayName}</div>
            {status && (
              <span className={`pill text-[11px] mt-1 ${
                status === 'active'    ? 'pill-green'
                : status === 'trialing'  ? 'pill-cyan'
                : status === 'past_due'  ? 'pill-amber'
                : 'pill-mute'
              }`}>{status.replace('_', ' ')}</span>
            )}
            {!subscription && (
              <p className="text-[12.5px] text-[#6a6a6e] mt-1.5">No active subscription — on free tier.</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            {nextRenewal && (
              <div className="text-[12px] text-[#6a6a6e]">Renews {nextRenewal}</div>
            )}
            {subscription?.cancel_at_period_end && (
              <div className="text-[12px] text-[#ff8a7a]">Cancels at period end</div>
            )}
            {subscription?.stripe_customer_id && (
              <form action={portalAction}>
                <button type="submit" disabled={portalPending}
                  className="btn-ghost btn-sm disabled:opacity-50">
                  {portalPending ? 'Opening…' : 'Manage Billing'}
                </button>
              </form>
            )}
          </div>
        </div>

        {portalState.error && (
          <p className="text-[12.5px] text-[#ff8a7a] mb-3">{portalState.error}</p>
        )}

        {/* Usage bars */}
        <div className="flex flex-col gap-3">
          <UsageBar label="AI Conversations" used={usageSummary.ai_conversations} limit={planLimits.ai_conversations_month} />
          <UsageBar label="Leads"            used={usageSummary.leads}            limit={planLimits.leads_month}            />
          <UsageBar label="Bookings"         used={usageSummary.bookings}         limit={planLimits.bookings_month}         />
        </div>
      </div>

      {/* Stripe not configured warning */}
      {!stripeReady && (
        <div className="flex items-start gap-3 px-5 py-4 rounded-xl border border-[#ffae3c]/30 bg-[#ffae3c]/[0.05]
                        text-[13.5px] text-[#ffae3c]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="shrink-0 mt-0.5">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span>
            Billing is not fully configured yet. Stripe environment variables are missing — upgrades require a Stripe connection.
            Contact your account manager to upgrade your plan.
          </span>
        </div>
      )}

      {/* Stripe configured but uses legacy subscription prices */}
      {stripeReady && (
        <div className="flex items-start gap-3 px-5 py-4 rounded-xl border border-[#3b9eff]/20 bg-[#3b9eff]/[0.04]
                        text-[12.5px] text-[#9a9a9d]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b9eff" strokeWidth="2.2" strokeLinecap="round" className="shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          <span>
            Online checkout is currently configured for subscription billing. Setup fee collection may require a manual invoice
            until Stripe products are updated to match the current offer pricing.
          </span>
        </div>
      )}

      {/* Plan comparison */}
      <div>
        <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#6a6a6e] mb-4">
          All Plans
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {ALL_PLANS.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrent={plan.id === currentPlanId}
              stripeReady={stripeReady}
            />
          ))}
        </div>

        {/* Stripe / pricing note */}
        <p className="mt-5 text-[12.5px] text-[#6a6a6e] leading-relaxed">
          Flat public pricing keeps setup simple. Online checkout may need updated Stripe products before live payments
          match the current offer pricing. Monthly plans cover hosting, AI operations, monitoring, and support.
        </p>
      </div>
    </div>
  )
}
