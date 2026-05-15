'use server'

import { createServiceRoleClient } from '@/lib/supabase/server'
import { getStripe, isStripeConfigured } from '@/lib/stripe/client'
import { getPriceIdForPlan, getPlanLimits, getPlan } from '@/lib/billing/plans'
import { getBusinessPlan, getBusinessUsage } from '@/lib/billing/limits'
import { checkoutSessionSchema } from '@/lib/validation/billing'
import { getAuthContext } from './_shared'
import type { ActionState } from '@/types'
import type { PlanId } from '@/lib/billing/plans'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://helios.ai'

// ── Get current subscription ──────────────────────────────────────

export async function getCurrentSubscription() {
  const { user, businessId } = await getAuthContext()
  if (!user || !businessId) return null

  const db = createServiceRoleClient()
  const { data } = await db
    .from('subscriptions')
    .select('*')
    .eq('business_id', businessId)
    .single()

  return data
}

// ── Get usage summary ─────────────────────────────────────────────

export async function getUsageSummary() {
  const { user, businessId } = await getAuthContext()
  if (!user || !businessId) return null

  const db = createServiceRoleClient()
  const [plan, usage] = await Promise.all([
    getBusinessPlan(db, businessId),
    getBusinessUsage(db, businessId),
  ])

  return { plan, usage, limits: getPlanLimits(plan), planDetails: getPlan(plan) }
}

// ── Get plan limit status ─────────────────────────────────────────

export async function getPlanLimitStatus() {
  const summary = await getUsageSummary()
  if (!summary) return null

  const { usage, limits } = summary
  return {
    ai_conversations: { used: usage.ai_conversations, limit: limits.ai_conversations_month },
    leads:            { used: usage.leads,            limit: limits.leads_month },
    bookings:         { used: usage.bookings,         limit: limits.bookings_month },
  }
}

// ── Create checkout session ───────────────────────────────────────

export async function createCheckoutSessionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState & { url?: string }> {
  const { user, businessId } = await getAuthContext()
  if (!user || !businessId) return { error: 'Not authenticated.' }

  if (!isStripeConfigured()) {
    return { error: 'Billing is not configured on this server. Contact support.' }
  }

  const parsed = checkoutSessionSchema.safeParse({ plan_id: formData.get('plan_id') })
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Invalid plan.' }

  const priceId = getPriceIdForPlan(parsed.data.plan_id as PlanId)
  if (!priceId) {
    return { error: `Stripe price ID for plan "${parsed.data.plan_id}" is not configured. Add it to environment variables.` }
  }

  try {
    const stripe = getStripe()
    const db     = createServiceRoleClient()

    // Find existing Stripe customer if one exists
    const { data: existing } = await db
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('business_id', businessId)
      .single()

    const existingCustomerId = (existing as { stripe_customer_id: string | null } | null)?.stripe_customer_id ?? undefined

    const session = await stripe.checkout.sessions.create({
      mode:           'subscription',
      line_items:     [{ price: priceId, quantity: 1 }],
      customer:       existingCustomerId,
      customer_email: existingCustomerId ? undefined : user.email,
      success_url:    `${APP_URL}/dashboard/settings/billing?success=1`,
      cancel_url:     `${APP_URL}/dashboard/settings/billing?cancelled=1`,
      metadata: {
        business_id: businessId,
        user_id:     user.id,
        plan_id:     parsed.data.plan_id,
      },
      subscription_data: {
        metadata: { business_id: businessId, user_id: user.id },
      },
    })

    await db.from('audit_logs').insert({
      business_id: businessId,
      user_id:     user.id,
      action:      'billing.checkout_session.created',
      resource:    'subscriptions',
      new_values:  { plan_id: parsed.data.plan_id, session_id: session.id },
    })

    return { success: 'Redirecting to checkout…', url: session.url! }
  } catch (err) {
    console.error('[billing] createCheckoutSession error:', err instanceof Error ? err.message : err)
    return { error: 'Could not create checkout session. Please try again.' }
  }
}

// ── Create customer portal session ───────────────────────────────

export async function createPortalSessionAction(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState & { url?: string }> {
  const { user, businessId } = await getAuthContext()
  if (!user || !businessId) return { error: 'Not authenticated.' }

  if (!isStripeConfigured()) {
    return { error: 'Billing is not configured on this server.' }
  }

  const db = createServiceRoleClient()
  const { data: sub } = await db
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('business_id', businessId)
    .single()

  const customerId = (sub as { stripe_customer_id: string | null } | null)?.stripe_customer_id
  if (!customerId) {
    return { error: 'No billing account found. Please subscribe to a plan first.' }
  }

  try {
    const stripe  = getStripe()
    const session = await stripe.billingPortal.sessions.create({
      customer:   customerId,
      return_url: `${APP_URL}/dashboard/settings/billing`,
    })
    return { success: 'Redirecting to billing portal…', url: session.url }
  } catch (err) {
    console.error('[billing] createPortalSession error:', err instanceof Error ? err.message : err)
    return { error: 'Could not open billing portal. Please try again.' }
  }
}
