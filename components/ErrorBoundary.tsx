'use client'

import { Component, type ReactNode } from 'react'
import * as Sentry from '@sentry/nextjs'

interface Props {
  children:  ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  errorId:  string | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, errorId: null }

  static getDerivedStateFromError(): State {
    return { hasError: true, errorId: null }
  }

  componentDidCatch(error: Error): void {
    try {
      const id = Sentry.captureException(error)
      this.setState({ errorId: id ?? null })
    } catch {
      // Never block if Sentry fails
    }
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children

    return this.props.fallback ?? (
      <div className="border border-[#ff6a5a]/30 rounded-2xl p-6 text-center bg-[#ff6a5a]/[0.04]">
        <div className="text-2xl mb-2">⚠</div>
        <h3 className="text-[16px] font-semibold text-white mb-1">Something went wrong</h3>
        <p className="text-[13.5px] text-[#9a9a9d] mb-4">
          This section encountered an error. Please refresh the page.
        </p>
        <button
          onClick={() => this.setState({ hasError: false, errorId: null })}
          className="h-9 px-5 rounded-[10px] text-[13px] border border-white/10 bg-white/[0.04]
                     text-[#9a9a9d] hover:text-white hover:border-white/20 transition-all">
          Try Again
        </button>
      </div>
    )
  }
}
