// ── Stripe server-only client ─────────────────────────────────────
// NEVER import this file in client components.
// STRIPE_SECRET_KEY must never be exposed to the browser.

import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error(
      '[stripe] STRIPE_SECRET_KEY is not configured. ' +
      'Add it to .env.local (server-side only, never NEXT_PUBLIC_).',
    )
  }
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-04-22.dahlia',
    })
  }
  return _stripe
}

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY
}
