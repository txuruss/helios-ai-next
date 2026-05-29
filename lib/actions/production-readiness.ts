'use server'

import { createClient } from '@/lib/supabase/server'
import { captureApiError } from '@/lib/logging/api'
import { capture } from '@/lib/analytics/posthog'

export interface ReadinessCheck {
  key:         string
  label:       string
  status:      'configured' | 'missing' | 'optional' | 'warning'
  required:    boolean
  description: string
  fixHint:     string
}

// ── Run production readiness check ────────────────────────────────
// Returns status labels ONLY — never actual env values.

export async function runProductionReadinessCheck(): Promise<{
  checks:          ReadinessCheck[]
  requiredMissing: number
  allRequired:     boolean
  betaReady:       boolean
  error?:          string
}> {
  try {
    // Verify user is authenticated before running
    const authClient = await createClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return { checks: [], requiredMissing: 0, allRequired: false, betaReady: false, error: 'Not authenticated.' }

    const checks: ReadinessCheck[] = [
      // Required — core infrastructure
      {
        key: 'supabase_url',
        label: 'Supabase URL',
        status: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'configured' : 'missing',
        required: true,
        description: 'Database and authentication URL.',
        fixHint: 'Set NEXT_PUBLIC_SUPABASE_URL in Vercel environment variables.',
      },
      {
        key: 'supabase_anon_key',
        label: 'Supabase Anon Key',
        status: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'configured' : 'missing',
        required: true,
        description: 'Public Supabase key for client-side auth.',
        fixHint: 'Set NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel environment variables.',
      },
      {
        key: 'supabase_service_role',
        label: 'Supabase Service Role Key',
        status: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'configured' : 'missing',
        required: true,
        description: 'Server-side key for RLS bypass. Never exposed to the browser.',
        fixHint: 'Set SUPABASE_SERVICE_ROLE_KEY in Vercel environment variables (non-NEXT_PUBLIC).',
      },
      {
        key: 'anthropic',
        label: 'Anthropic API Key',
        status: process.env.ANTHROPIC_API_KEY ? 'configured' : 'missing',
        required: true,
        description: 'Powers the AI chat assistant. Required for /api/chat.',
        fixHint: 'Set ANTHROPIC_API_KEY in Vercel environment variables.',
      },
      {
        key: 'app_url',
        label: 'App URL',
        status: process.env.NEXT_PUBLIC_APP_URL ? 'configured' : 'warning',
        required: true,
        description: 'Public app URL used in booking portal links and notifications.',
        fixHint: 'Set NEXT_PUBLIC_APP_URL to your Vercel deployment URL (e.g. https://helios.yourdomain.com).',
      },
      {
        key: 'cron_secret',
        label: 'Cron Secret',
        status: (process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET || process.env.OPS_CRON_SECRET) ? 'configured' : 'warning',
        required: true,
        description: 'Protects the SLA and booking expiry cron endpoints.',
        fixHint: 'Set CRON_SECRET in Vercel environment variables. Vercel will inject this automatically for Vercel Cron.',
      },

      // Recommended — core features
      {
        key: 'resend',
        label: 'Resend API Key',
        status: process.env.RESEND_API_KEY ? 'configured' : 'missing',
        required: false,
        description: 'Required for owner notifications and booking confirmation emails.',
        fixHint: 'Get an API key at resend.com and set RESEND_API_KEY.',
      },
      {
        key: 'paypal_client_id',
        label: 'PayPal Client ID',
        status: process.env.PAYPAL_CLIENT_ID ? 'configured' : 'optional',
        required: false,
        description: 'Primary payment provider. Required for PayPal payments and billing.',
        fixHint: 'Set PAYPAL_CLIENT_ID (and PAYPAL_ENVIRONMENT=sandbox|live). Not needed for beta if billing is manual.',
      },
      {
        key: 'paypal_client_secret',
        label: 'PayPal Client Secret',
        status: process.env.PAYPAL_CLIENT_SECRET ? 'configured' : 'optional',
        required: false,
        description: 'Server-side PayPal secret used to authenticate API calls.',
        fixHint: 'Set PAYPAL_CLIENT_SECRET from your PayPal app credentials. Configuring it does not by itself verify any payment.',
      },

      // Optional — channel integrations
      {
        key: 'calcom',
        label: 'Cal.com API Key',
        status: process.env.CALCOM_API_KEY ? 'configured' : 'optional',
        required: false,
        description: 'Required for live booking availability and confirmation.',
        fixHint: 'Get an API key at cal.com/settings/developer and set CALCOM_API_KEY.',
      },
      {
        key: 'meta_token',
        label: 'Meta Access Token (WhatsApp)',
        status: process.env.META_ACCESS_TOKEN ? 'configured' : 'optional',
        required: false,
        description: 'Required for WhatsApp Business messaging.',
        fixHint: 'Set META_ACCESS_TOKEN from Meta Business Manager.',
      },
      {
        key: 'meta_app_secret',
        label: 'Meta App Secret',
        status: process.env.META_APP_SECRET ? 'configured' : 'optional',
        required: false,
        description: 'Verifies WhatsApp webhook signatures.',
        fixHint: 'Set META_APP_SECRET from Meta App dashboard.',
      },
      {
        key: 'whatsapp_verify_token',
        label: 'WhatsApp Verify Token',
        status: process.env.WHATSAPP_VERIFY_TOKEN ? 'configured' : 'optional',
        required: false,
        description: 'Used for the Meta webhook verification challenge.',
        fixHint: 'Set WHATSAPP_VERIFY_TOKEN to any secure random string.',
      },

      // Observability
      {
        key: 'sentry',
        label: 'Sentry DSN',
        status: process.env.NEXT_PUBLIC_SENTRY_DSN ? 'configured' : 'optional',
        required: false,
        description: 'Error tracking and monitoring.',
        fixHint: 'Create a Sentry project and set NEXT_PUBLIC_SENTRY_DSN.',
      },
      {
        key: 'posthog',
        label: 'PostHog Key',
        status: process.env.NEXT_PUBLIC_POSTHOG_KEY ? 'configured' : 'optional',
        required: false,
        description: 'Product analytics and event tracking.',
        fixHint: 'Set NEXT_PUBLIC_POSTHOG_KEY from your PostHog project settings.',
      },
    ]

    const requiredMissing = checks.filter((c) => c.required && c.status === 'missing').length
    const allRequired     = requiredMissing === 0
    const betaReady       = allRequired && checks.filter((c) => c.required && c.status === 'warning').length === 0

    capture('production_readiness_check_run', {
      missing_count:          checks.filter((c) => c.status === 'missing').length,
      required_missing_count: requiredMissing,
      beta_ready:             betaReady,
    })

    if (requiredMissing > 0) {
      capture('production_readiness_missing_required', { required_missing_count: requiredMissing })
    }

    return { checks, requiredMissing, allRequired, betaReady }
  } catch (err) {
    captureApiError(err, { route: 'actions/production-readiness', error_type: 'readiness_check_error' })
    return { checks: [], requiredMissing: 0, allRequired: false, betaReady: false, error: 'Could not complete readiness check.' }
  }
}
