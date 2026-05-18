# Helios AI — Deployment Guide

> Deploy Helios AI to Vercel and connect all required services.

---

## Required Environment Variables

Set these in Vercel → Project → Settings → Environment Variables.

### Core (required — app will not work without these)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL (e.g. `https://xxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — **server-side only, never prefix with NEXT_PUBLIC_** |
| `ANTHROPIC_API_KEY` | Powers the AI chat assistant |
| `NEXT_PUBLIC_APP_URL` | Your deployment URL (e.g. `https://helios.yourdomain.com`) |
| `CRON_SECRET` | Protects SLA and booking expiry cron endpoints. Vercel injects this automatically for Vercel Cron. |

### Notifications (recommended for beta)

| Variable | Description |
|----------|-------------|
| `RESEND_API_KEY` | Owner email notifications and booking confirmations |

### Billing (optional for beta — can use manual invoicing)

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Stripe secret key for checkout sessions |
| `STRIPE_WEBHOOK_SECRET` | Verifies Stripe webhook events |
| `NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID` | Stripe price ID for Starter plan |
| `NEXT_PUBLIC_STRIPE_PRO_PRICE_ID` | Stripe price ID for Booking OS plan |
| `NEXT_PUBLIC_STRIPE_SCALE_PRICE_ID` | Stripe price ID for Ops Center plan |

### Cal.com (optional — needed for live booking)

| Variable | Description |
|----------|-------------|
| `CALCOM_API_KEY` | Cal.com API key |
| `CALCOM_WEBHOOK_SECRET` | Verifies Cal.com webhook events |

### WhatsApp (optional — needed for WhatsApp channel)

| Variable | Description |
|----------|-------------|
| `META_ACCESS_TOKEN` | Meta Cloud API access token |
| `META_APP_SECRET` | Verifies webhook signatures |
| `WHATSAPP_VERIFY_TOKEN` | Used during webhook setup verification |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta phone number ID (if using single number) |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Meta business account ID |

### Relevance AI (optional)

| Variable | Description |
|----------|-------------|
| `RELEVANCE_API_KEY` | Relevance AI API key |
| `RELEVANCE_PROJECT_ID` | Relevance project ID |
| `RELEVANCE_WEBHOOK_SECRET` | Verifies Relevance webhook callbacks |

### Observability (recommended)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry project DSN |
| `SENTRY_AUTH_TOKEN` | Sentry auth token for source maps |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog project API key |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog host (default: https://app.posthog.com) |

### Rate limiting (optional)

| Variable | Description |
|----------|-------------|
| `UPSTASH_REDIS_REST_URL` | Upstash Redis URL for rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis token |

---

## Supabase Migration Order

Apply in order in Supabase → SQL Editor:

1. `db/initial-schema.sql` (or from Supabase Studio if starting fresh)
2. `db/add-ops-phase-17-fields.sql`
3. `db/add-ops-phase-18-fields.sql`
4. `db/add-phase-21-trust-demo-fields.sql`
5. `db/add-phase-22-booking-review-fields.sql`
6. `db/add-phase-23-booking-reliability-fields.sql`
7. `db/add-client-onboarding-pipeline.sql`
8. `db/add-deployment-score-audit-engine.sql`
9. `db/add-niche-template-system.sql`
10. `db/add-client-setup-progress.sql`

All migrations are idempotent — safe to re-run.

---

## Vercel Build Settings

Build Command: `npm run build` (default)  
Output Directory: `.next` (default)  
Install Command: `npm install`

---

## Vercel Cron Configuration

`vercel.json` includes:
```json
{
  "crons": [
    { "path": "/api/cron/ops/sla", "schedule": "*/10 * * * *" },
    { "path": "/api/cron/bookings/expire-confirmations", "schedule": "*/15 * * * *" }
  ]
}
```

Vercel automatically injects `CRON_SECRET` and sends `Authorization: Bearer ${CRON_SECRET}` with each cron request.

---

## Webhook URL Setup

After deploying, configure webhooks in each provider:

### WhatsApp (Meta)
1. Go to Meta Developers → Your App → WhatsApp → Webhook
2. Set Callback URL: `https://yourdomain.com/api/webhooks/whatsapp`
3. Set Verify Token: value of `WHATSAPP_VERIFY_TOKEN`
4. Subscribe to: `messages`

### Stripe
1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://yourdomain.com/api/stripe/webhook`
3. Events to listen: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
4. Copy signing secret → set as `STRIPE_WEBHOOK_SECRET`

### Cal.com
1. Go to Cal.com → Settings → Developer → Webhooks
2. Add webhook: `https://yourdomain.com/api/webhooks/calcom`
3. Events: `BOOKING_CREATED`, `BOOKING_CANCELLED`, `BOOKING_RESCHEDULED`
4. Set payload secret → `CALCOM_WEBHOOK_SECRET`

### Relevance AI
1. Go to Relevance AI → Settings → Webhooks
2. Add webhook: `https://yourdomain.com/api/relevance/webhook`
3. Copy secret → `RELEVANCE_WEBHOOK_SECRET`

---

## Post-Deploy Smoke Test

Run after deploying to production:

- [ ] Visit `/` — landing page loads
- [ ] Visit `/demo` — demo page loads
- [ ] Visit `/booking/test` — shows branded invalid token page
- [ ] Visit `/login` — auth page loads
- [ ] Log in and visit `/dashboard` — Mission Control loads
- [ ] Visit `/dashboard/settings/billing` — billing loads (no redirect)
- [ ] Visit `/dashboard/setup` — setup, QA, and beta checklist load
- [ ] Run Production Readiness Check in `/dashboard/setup`
- [ ] Run Deployment Score audit in `/dashboard/audits`
- [ ] Test `/api/chat` with a sample message
- [ ] Trigger a test cron: `POST /api/cron/ops/sla` with `Authorization: Bearer YOUR_CRON_SECRET`

---

## Security Notes

- Never commit `.env.local` — it is in `.gitignore`
- Never prefix secret keys with `NEXT_PUBLIC_` — they would be exposed to the browser
- All Meta/Stripe/Anthropic/Cal.com/Relevance calls happen server-side only
- RLS is enabled on all sensitive tables
- Booking portal tokens are 64-character hex — never raw IDs
- Cron endpoints require Bearer token authentication
- Webhook routes verify signatures before processing
