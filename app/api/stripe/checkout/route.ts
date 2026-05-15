import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { getStripe, isStripeConfigured } from '@/lib/stripe/client'
import { getPriceIdForPlan } from '@/lib/billing/plans'
import { checkoutSessionSchema } from '@/lib/validation/billing'
import type { PlanId } from '@/lib/billing/plans'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://helios.ai'

// POST /api/stripe/checkout
// Protected — requires authenticated Supabase session.
// Accepts { plan_id } in the JSON body.
// Returns { url } pointing to Stripe checkout.

export async function POST(request: NextRequest) {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
  }

  const db = createServiceRoleClient()
  const { data: membership } = await db
    .from('business_members')
    .select('business_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()
  if (!membership) {
    return NextResponse.json({ error: 'No business found.' }, { status: 404 })
  }
  const businessId = membership.business_id as string

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const parsed = checkoutSessionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid plan.' }, { status: 400 })
  }

  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Billing is not configured on this server.' }, { status: 503 })
  }

  const priceId = getPriceIdForPlan(parsed.data.plan_id as PlanId)
  if (!priceId) {
    return NextResponse.json(
      { error: `Stripe price ID for plan "${parsed.data.plan_id}" is not configured.` },
      { status: 503 },
    )
  }

  try {
    const stripe = getStripe()

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
      metadata: { business_id: businessId, user_id: user.id, plan_id: parsed.data.plan_id },
      subscription_data: { metadata: { business_id: businessId } },
    })

    await db.from('audit_logs').insert({
      business_id: businessId, user_id: user.id,
      action: 'billing.checkout.started',
      resource: 'subscriptions',
      new_values: { plan_id: parsed.data.plan_id },
    }).catch(() => undefined)

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[stripe/checkout] error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Could not create checkout session.' }, { status: 500 })
  }
}
