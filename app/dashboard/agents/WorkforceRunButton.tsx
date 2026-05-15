'use client'

import { useState, useTransition } from 'react'
import type { RelevanceWorkforce } from '@/types'

interface Props {
  workforce:      RelevanceWorkforce
  canRun:         boolean
  onRunStarted?:  (runId: string) => void
}

const HTTP_ERROR_LABELS: Record<number, string> = {
  401: 'Please sign in again to launch workforces.',
  402: 'Your current plan does not allow this workforce.',
  404: 'Create a business profile first to launch workforces.',
  503: 'Relevance AI is not configured on this server.',
  500: 'Workforce launch failed. Please try again.',
}

export default function WorkforceRunButton({ workforce, canRun, onRunStarted }: Props) {
  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const handleRun = () => {
    setError(null)
    setSuccess(null)

    startTransition(async () => {
      try {
        const res = await fetch('/api/relevance/run-workforce', {
          method:      'POST',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workforce_id:  workforce.id,
            input_summary: `Run ${workforce.name}`,
          }),
        })

        const data = await res.json().catch(() => ({})) as {
          ok?: boolean; run_id?: string; demo?: boolean
          error?: string; status?: string
        }

        if (!res.ok) {
          const friendly = HTTP_ERROR_LABELS[res.status] ?? (data.error ?? 'Workforce launch failed.')
          console.error('[WorkforceRunButton] run-workforce error:', res.status, data.error)
          setError(friendly)
          return
        }

        const label = data.demo
          ? `Demo run created — add RELEVANCE_API_KEY for real runs`
          : `${workforce.name} launched successfully`

        setSuccess(label)
        if (data.run_id && onRunStarted) onRunStarted(data.run_id)

      } catch {
        setError('Network error. Please check your connection and try again.')
      }
    })
  }

  return (
    <div className="flex flex-col gap-1.5 shrink-0">
      {error   && <p className="text-[11.5px] text-[#ff8a7a] max-w-[200px] leading-snug">{error}</p>}
      {success && <p className="text-[11.5px] text-[#22d093] max-w-[200px] leading-snug">{success}</p>}

      <button
        type="button"
        onClick={handleRun}
        disabled={pending || !canRun}
        className="flex items-center gap-1.5 h-9 px-4 rounded-[10px] text-[13px]
                   bg-gradient-to-b from-[#ff8a2a] to-[#ee6a0c] text-[#1a0c00] font-medium
                   hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
        {pending ? (
          <><span className="w-4 h-4 rounded-full border-2 border-[#1a0c00]/30 border-t-[#1a0c00] animate-spin" /> Launching…</>
        ) : (
          <>⚡ Launch Workforce</>
        )}
      </button>

      {!canRun && (
        <span className="text-[11px] text-[#6a6a6e]">Requires {workforce.required_plan}+ plan</span>
      )}
    </div>
  )
}
