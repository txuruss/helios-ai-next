import * as Sentry from '@sentry/nextjs'

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 1.0,

    beforeSend(event) {
      // Remove any accidental inclusion of env var values in error messages
      if (event.request) {
        delete event.request.data
        delete event.request.cookies
        if (event.request.headers) {
          const safe: Record<string, string> = {}
          for (const [k, v] of Object.entries(event.request.headers)) {
            const lower = k.toLowerCase()
            if (lower === 'authorization' || lower === 'cookie' || lower === 'x-api-key') continue
            safe[k] = v as string
          }
          event.request.headers = safe
        }
      }
      return event
    },
  })
}
