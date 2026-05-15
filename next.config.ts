import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Add Supabase storage domain when connected:
      // { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  // Prevent accidental exposure of server env vars to the browser
  env: {},
}

// Sentry source map upload — only active when SENTRY_AUTH_TOKEN is set.
// Build succeeds normally without Sentry credentials.
export default process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(nextConfig, {
      org:       process.env.SENTRY_ORG,
      project:   process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent:    true,
    })
  : nextConfig
