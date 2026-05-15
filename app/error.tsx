'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import Link from 'next/link'

export default function RouteError({
  error,
  reset,
}: {
  error:  Error & { digest?: string }
  reset:  () => void
}) {
  useEffect(() => {
    try {
      Sentry.captureException(error)
    } catch {
      // Never block if Sentry fails
    }
  }, [error])

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#ff6a5a]/10 border border-[#ff6a5a]/25
                      flex items-center justify-center text-3xl">
        ⚠
      </div>
      <div>
        <h2 className="text-[22px] font-semibold mb-2">Something went wrong</h2>
        <p className="text-[14px] text-[#9a9a9d] max-w-sm">
          An unexpected error occurred. Our team has been notified. Please try again.
        </p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="btn-primary btn-sm">
          Try Again
        </button>
        <Link href="/dashboard" className="h-9 px-5 rounded-[10px] text-[13px] border border-white/10
                                           bg-white/[0.025] text-[#9a9a9d] hover:text-white
                                           hover:border-white/20 transition-all flex items-center">
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}
