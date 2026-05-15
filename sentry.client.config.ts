import * as Sentry from '@sentry/nextjs'

// Only initialize if DSN is configured.
// App works normally without Sentry credentials.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,

    // Low trace rate — adjust upward for debugging
    tracesSampleRate:   process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    replaysOnErrorSampleRate: 0,
    replaysSessionSampleRate: 0,

    // Strip sensitive data before it leaves the browser
    beforeSend(event) {
      if (event.request) {
        // Never send auth or session headers
        if (event.request.headers) {
          const safe: Record<string, string> = {}
          for (const [k, v] of Object.entries(event.request.headers)) {
            const lower = k.toLowerCase()
            if (lower === 'authorization' || lower === 'cookie' || lower.includes('api-key')) continue
            safe[k] = v as string
          }
          event.request.headers = safe
        }
        // Never send request body (may contain customer messages or API payloads)
        delete event.request.data
        delete event.request.cookies
      }

      return event
    },
  })
}
