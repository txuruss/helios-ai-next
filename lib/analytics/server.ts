// ── Server-side PostHog capture — server-only ─────────────────────
// Uses PostHog's HTTP capture endpoint directly — no client SDK needed.
// Silent no-op when NEXT_PUBLIC_POSTHOG_KEY is absent.
// Never sends PII: no phone numbers, emails, message content, or API keys.

import 'server-only'

const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.posthog.com'

/**
 * Capture a server-side analytics event.
 * Uses the business_id (truncated) as the distinct_id so events are
 * associated with the business, not the individual customer.
 *
 * Safe properties only — no phone numbers, emails, or message content.
 */
export async function captureServerEvent(
  event:      string,
  properties: Record<string, unknown> = {},
  distinctId?: string,
): Promise<void> {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) return

  const id = distinctId ?? `server_${Date.now()}`

  try {
    await fetch(`${POSTHOG_HOST}/capture/`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        api_key:     key,
        event,
        distinct_id: id,
        properties: {
          $lib:    'helios-server',
          ...properties,
        },
        timestamp: new Date().toISOString(),
      }),
      // fire-and-forget: short timeout so it never blocks
      signal: AbortSignal.timeout(3000),
    })
  } catch {
    // Analytics failures must never block the application
  }
}
