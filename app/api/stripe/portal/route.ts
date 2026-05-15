import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { getStripe, isStripeConfigured } from '@/lib/stripe/client'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://helios.ai'

// POST /api/stripe/portal
// Protected — requires authenticated Supabase session.
// Returns { url } pointing to Stripe billing portal.

export async function POST(request: NextRequest) {
  void request // satisfy Next.js route handler signature

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

  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Billing is not configured on this server.' }, { status: 503 })
  }

  const { data: sub } = await db
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('business_id', businessId)
    .single()

  const customerId = (sub as { stripe_customer_id: string | null } | null)?.stripe_customer_id
  if (!customerId) {
    return NextResponse.json(
      { error: 'No billing account found. Subscribe to a plan first.' },
      { status: 404 },
    )
  }

  try {
    const stripe   = getStripe()
    const session  = await stripe.billingPortal.sessions.create({
      customer:   customerId,
      return_url: `${APP_URL}/dashboard/settings/billing`,
    })
    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[stripe/portal] error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Could not open billing portal.' }, { status: 500 })
  }
}
