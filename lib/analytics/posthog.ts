// ── PostHog client helper — browser-only ─────────────────────────
// Never import this in server components or route handlers.
// PostHog is silently skipped when NEXT_PUBLIC_POSTHOG_KEY is absent.

import posthog from 'posthog-js'

export function initPostHog(): void {
  if (typeof window === 'undefined') return

  const key  = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.posthog.com'

  if (!key) return

  // Guard against double-init (HMR in development)
  if ((posthog as { __loaded?: boolean }).__loaded) return

  posthog.init(key, {
    api_host:          host,
    person_profiles:   'identified_only',  // create profiles only for identified users
    capture_pageview:  false,              // managed manually in PostHogProvider
    capture_pageleave: true,
    autocapture:       false,              // no automatic click/form capture (privacy)
    disable_session_recording: true,       // no session replay
  })
}

/** Safe capture — silent no-op when PostHog is not initialised. */
export function capture(
  event: string,
  properties: Record<string, unknown> = {},
): void {
  try {
    if (typeof window === 'undefined') return
    if (!(posthog as { __loaded?: boolean }).__loaded) return
    posthog.capture(event, properties)
  } catch {
    // Never block user flows
  }
}

/** Identify the authenticated user. Only sends safe fields — no email or phone. */
export function identify(userId: string, safeTraits: Record<string, unknown> = {}): void {
  try {
    if (typeof window === 'undefined') return
    if (!(posthog as { __loaded?: boolean }).__loaded) return
    posthog.identify(userId, safeTraits)
  } catch {
    // Silent fail
  }
}

/** Reset when user logs out. */
export function resetUser(): void {
  try {
    if (typeof window === 'undefined') return
    if ((posthog as { __loaded?: boolean }).__loaded) posthog.reset()
  } catch {
    // Silent fail
  }
}
