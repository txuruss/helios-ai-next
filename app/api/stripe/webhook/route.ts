import { NextResponse, type NextRequest } from 'next/server'
import { getStripe } from '@/lib/stripe/client'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getPlanFromPriceId } from '@/lib/billing/plans'

const MAX_BODY_BYTES = 64 * 1024

// POST /api/stripe/webhook
// Verifies Stripe webhook signature and updates subscriptions table.

// Helper — safe period conversion for Stripe's epoch seconds or ISO strings
function toIso(val: unknown): string | null {
  if (!val) return null
  if (typeof val === 'number') return new Date(val * 1000).toISOString()
  if (typeof val === 'string') return val
  return null
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text().catch(() => '')
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large.' }, { status: 413 })
  }

  const sig    = request.headers.get('stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[stripe/webhook] STRIPE_WEBHOOK_SECRET not set — rejecting')
      return NextResponse.json({ error: 'Webhook not configured.' }, { status: 503 })
    }
    console.warn('[stripe/webhook] STRIPE_WEBHOOK_SECRET not set — skipping sig check (dev only)')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let event: Record<string, any>
  try {
    const stripe = getStripe()
    if (secret && sig) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      event = stripe.webhooks.constructEvent(rawBody, sig, secret) as any
    } else {
      event = JSON.parse(rawBody)
    }
  } catch (err) {
    console.error('[stripe/webhook] Signature failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Webhook signature verification failed.' }, { status: 400 })
  }

  const db = createServiceRoleClient()

  try {
    const type = event.type as string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj  = event.data?.object as Record<string, any>

    switch (type) {
      case 'checkout.session.completed': {
        if (obj.mode !== 'subscription') break
        const businessId = obj.metadata?.business_id as string | undefined
        const userId     = obj.metadata?.user_id     as string | undefined
        if (!businessId) { console.error('[stripe/webhook] No business_id in session metadata'); break }

        const customerId = obj.customer as string
        const subId      = obj.subscription as string

        const stripe    = getStripe()
        const stripeSub = await stripe.subscriptions.retrieve(subId)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subData   = stripeSub as unknown as Record<string, any>
        const priceId   = subData.items?.data?.[0]?.price?.id as string | null ?? null
        const plan      = getPlanFromPriceId(priceId)
        const status    = (subData.status as string) === 'active' ? 'active' : (subData.status as string)

        await db.from('subscriptions').upsert({
          business_id:            businessId,
          user_id:                userId ?? null,
          stripe_customer_id:     customerId,
          stripe_subscription_id: subId,
          stripe_price_id:        priceId,
          plan,
          status,
          current_period_start:   toIso(subData.current_period_start),
          current_period_end:     toIso(subData.current_period_end),
          cancel_at_period_end:   !!(subData.cancel_at_period_end),
        }, { onConflict: 'business_id' })

        await db.from('audit_logs').insert({
          business_id: businessId, user_id: userId ?? null,
          action: 'billing.subscription.activated',
          resource: 'subscriptions',
          new_values: { plan, status, stripe_subscription_id: subId },
        }).catch(() => undefined)
        break
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const subData = obj
        let businessId = subData.metadata?.business_id as string | undefined

        if (!businessId) {
          const { data } = await db
            .from('subscriptions')
            .select('business_id')
            .eq('stripe_customer_id', subData.customer as string)
            .single()
          businessId = (data as { business_id: string } | null)?.business_id
        }
        if (!businessId) { console.warn('[stripe/webhook] Cannot map subscription to business'); break }

        const priceId = subData.items?.data?.[0]?.price?.id as string | null ?? null
        const plan    = getPlanFromPriceId(priceId)

        await db.from('subscriptions').upsert({
          business_id:            businessId,
          stripe_customer_id:     subData.customer as string,
          stripe_subscription_id: subData.id as string,
          stripe_price_id:        priceId,
          plan,
          status:                 subData.status as string,
          current_period_start:   toIso(subData.current_period_start),
          current_period_end:     toIso(subData.current_period_end),
          cancel_at_period_end:   !!(subData.cancel_at_period_end),
        }, { onConflict: 'business_id' })

        await db.from('audit_logs').insert({
          business_id: businessId, user_id: null,
          action: `billing.subscription.${type.split('.')[2]}`,
          resource: 'subscriptions',
          new_values: { plan, status: subData.status },
        }).catch(() => undefined)
        break
      }

      case 'customer.subscription.deleted': {
        const subId = obj.id as string
        await db.from('subscriptions')
          .update({ status: 'cancelled', cancel_at_period_end: false })
          .eq('stripe_subscription_id', subId)
        break
      }

      case 'invoice.payment_succeeded': {
        const subId = (obj.subscription ?? obj.subscription_id) as string | null
        if (!subId) break
        await db.from('subscriptions').update({ status: 'active' }).eq('stripe_subscription_id', subId)
        break
      }

      case 'invoice.payment_failed': {
        const subId = (obj.subscription ?? obj.subscription_id) as string | null
        if (!subId) break
        await db.from('subscriptions').update({ status: 'past_due' }).eq('stripe_subscription_id', subId)
        break
      }

      default:
        break
    }
  } catch (err) {
    console.error('[stripe/webhook] handler error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
