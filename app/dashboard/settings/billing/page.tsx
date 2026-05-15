import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/dashboard/PageHeader'
import BillingDashboard from './BillingDashboard'
import { getBusinessPlan, getBusinessUsage } from '@/lib/billing/limits'
import { getPlanLimits, getPlan } from '@/lib/billing/plans'
import { isStripeConfigured } from '@/lib/stripe/client'
import type { Subscription } from '@/types'

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; cancelled?: string }>
}) {
  const params = await searchParams

  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) redirect('/login')

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return (
      <>
        <PageHeader eyebrow="Settings" title="Billing" />
        <div className="px-5 py-4 rounded-2xl border border-[#ff6a5a]/30 bg-[#ff6a5a]/[0.06] text-[13.5px] text-[#ff8a7a]">
          Server configuration incomplete. Add <code className="font-mono text-[12px]">SUPABASE_SERVICE_ROLE_KEY</code> to enable billing.
        </div>
      </>
    )
  }

  const db = createServiceRoleClient()

  const { data: membership } = await db
    .from('business_members')
    .select('business_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()
  if (!membership) redirect('/dashboard')

  const businessId = membership.business_id as string

  const [subscription, planId, usage] = await Promise.all([
    db.from('subscriptions').select('*').eq('business_id', businessId).single()
      .then((r: { data: unknown }) => r.data as Subscription | null),
    getBusinessPlan(db, businessId),
    getBusinessUsage(db, businessId),
  ])

  const planLimits   = getPlanLimits(planId)
  const stripeReady  = isStripeConfigured()

  return (
    <>
      <PageHeader eyebrow="Settings" title="Billing" description="Manage your subscription plan and usage." />

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
