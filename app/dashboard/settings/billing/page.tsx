import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/dashboard/PageHeader'
import BillingDashboard from './BillingDashboard'
import { getBusinessPlan, getBusinessUsage } from '@/lib/billing/limits'
import { getPlanLimits } from '@/lib/billing/plans'
import { isStripeConfigured } from '@/lib/stripe/client'
import type { Subscription } from '@/types'

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; cancelled?: string }>
}) {
  const params = await searchParams

  // ── 1. Auth guard ─────────────────────────────────────────────────
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) redirect('/login')

  // ── 2. Service role guard (safe render, not crash) ────────────────
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return (
      <>
        <PageHeader eyebrow="Settings" title="Billing" />
        <div className="px-5 py-4 rounded-2xl border border-[#ff6a5a]/30 bg-[#ff6a5a]/[0.06] text-[13.5px] text-[#ff8a7a]">
          Server configuration incomplete. Add{' '}
          <code className="font-mono text-[12px]">SUPABASE_SERVICE_ROLE_KEY</code> to enable billing.
        </div>
      </>
    )
  }

  const db = createServiceRoleClient()

  // ── 3. Business membership — show setup state, never redirect ─────
  const { data: membership } = await db
    .from('business_members')
    .select('business_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!membership) {
    return (
      <>
        <PageHeader
          eyebrow="Settings"
          title="Billing"
          description="Manage your subscription plan and usage."
        />
        <div className="border border-[#ff7a18]/25 rounded-2xl p-8 bg-gradient-to-br from-[#ff7a18]/[0.06] to-transparent max-w-[560px]">
          <div className="w-10 h-10 rounded-2xl bg-[#ff7a18]/[0.18] border border-[#ff7a18]/25 flex items-center justify-center text-xl mb-4">
            🏢
          </div>
          <h3 className="text-[18px] font-semibold mb-2">Set up your business first</h3>
          <p className="text-[14px] text-[#9a9a9d] mb-5 leading-relaxed">
            Create your business profile to activate billing and plan limits. Your plan starts on Starter
            automatically — no payment required until you upgrade.
          </p>
          <Link
            href="/dashboard/business"
            className="inline-flex items-center gap-2 h-10 px-5 rounded-[10px] text-[13.5px] font-medium
                       bg-gradient-to-b from-[#ff8a2a] to-[#ee6a0c] text-[#1a0c00]
                       hover:opacity-90 transition-opacity"
          >
            Create Business Profile →
          </Link>
        </div>
      </>
    )
  }

  const businessId = membership.business_id as string

  // ── 4. Load billing data (never throw, always fallback safely) ────
  let subscription: Subscription | null = null
  let planId = 'starter'
  let usage  = { ai_conversations: 0, leads: 0, bookings: 0 }

  try {
    const [subResult, fetchedPlanId, fetchedUsage] = await Promise.all([
      db.from('subscriptions').select('*').eq('business_id', businessId).single()
        .then((r: { data: unknown }) => r.data as Subscription | null)
        .catch(() => null),
      getBusinessPlan(db, businessId).catch(() => 'starter'),
      getBusinessUsage(db, businessId).catch(() => ({ ai_conversations: 0, leads: 0, bookings: 0 })),
    ])
    subscription = subResult
    planId       = fetchedPlanId
    usage        = fetchedUsage
  } catch {
    // Render with defaults — do not redirect or crash
  }

  const planLimits  = getPlanLimits(planId)
  const stripeReady = isStripeConfigured()

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Billing"
        description="Manage your subscription plan and usage."
      />

      {params.success === '1' && (
        <div className="mb-5 px-5 py-4 rounded-2xl border border-[#22d093]/30 bg-[#22d093]/[0.06] text-[13.5px] text-[#22d093]">
          ✓ Subscription activated! Your plan has been upgraded.
        </div>
      )}
      {params.cancelled === '1' && (
        <div className="mb-5 px-5 py-4 rounded-2xl border border-white/10 bg-white/[0.02] text-[13.5px] text-[#9a9a9d]">
          Checkout cancelled — your plan was not changed.
        </div>
      )}

      {!stripeReady && (
        <div className="mb-5 px-5 py-4 rounded-2xl border border-[#ffae3c]/30 bg-[#ffae3c]/[0.06] text-[13.5px] text-[#ffae3c]">
          ⚠ Billing is not fully configured yet. Stripe environment variables are missing.
          Plan limits still apply — upgrades require Stripe to be connected.
        </div>
      )}

      <BillingDashboard
        subscription={subscription}
        usageSummary={usage}
        planLimits={planLimits}
        currentPlanId={planId}
        stripeReady={stripeReady}
      />
    </>
  )
}
