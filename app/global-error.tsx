'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function GlobalError({
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
      // Silent fail
    }
  }, [error])

  return (
    <html lang="en">
      <body style={{
        background: '#070707',
        color: '#f3f3f3',
        fontFamily: 'system-ui, sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        margin: 0,
        textAlign: 'center',
        padding: '32px',
      }}>
        <div>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠</div>
          <h2 style={{ fontSize: '22px', fontWeight: 600, marginBottom: '8px' }}>
            Critical error
          </h2>
          <p style={{ color: '#9a9a9d', fontSize: '14px', marginBottom: '24px' }}>
            A critical error occurred. Please refresh the page.
          </p>
          <button
            onClick={reset}
            style={{
              padding: '10px 24px',
              background: 'linear-gradient(180deg, #ff8a2a, #ee6a0c)',
              color: '#1a0c00',
              border: 'none',
              borderRadius: '10px',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
            }}>
            Refresh
          </button>
        </div>
      </body>
    </html>
  )
}
