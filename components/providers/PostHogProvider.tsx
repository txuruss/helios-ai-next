'use client'

import { Suspense, useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { initPostHog } from '@/lib/analytics/posthog'

// Page-view tracker — must be inside Suspense because of useSearchParams()
function PageViewTracker() {
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    try {
      if ((posthog as { __loaded?: boolean }).__loaded) {
        posthog.capture('$pageview', { $current_url: window.location.href })
      }
    } catch {
      // Silent fail
    }
  }, [pathname, searchParams])

  return null
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY

  useEffect(() => {
    initPostHog()
  }, [])

  // When PostHog is not configured, render children directly
  if (!key) return <>{children}</>

  return (
    <PHProvider client={posthog}>
      {children}
      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>
    </PHProvider>
  )
}
