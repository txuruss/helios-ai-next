'use client'

import { useState, useTransition } from 'react'
import type { HeliosAgent } from '@/types'

interface Props {
  agent:          HeliosAgent
  relevanceReady: boolean
  canRun:         boolean
  planRequired:   string
  currentPlan:    string
  onRunStarted?:  (runId: string) => void
}

const HTTP_ERROR_LABELS: Record<number, string> = {
  401: 'Please sign in again to run agents.',
  402: 'Your current plan does not allow this agent.',
  404: 'Create a business profile first to run agents.',
  503: 'Relevance AI is not configured on this server.',
  500: 'Agent run failed. Please try again.',
}

export default function AgentRunButton({
  agent, relevanceReady, canRun, planRequired, onRunStarted,
}: Props) {
  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const handleRun = () => {
    setError(null)
    setSuccess(null)

    startTransition(async () => {
      try {
        // Call the API route (same origin) with credentials: 'include'
        // so the Supabase session cookie is forwarded to the route handler.
        const res = await fetch('/api/relevance/run-agent', {
          method:      'POST',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agent_id:      agent.id,
            input_summary: `Run ${agent.name}`,
          }),
        })

        const data = await res.json().catch(() => ({})) as {
          ok?: boolean; run_id?: string; demo?: boolean
          error?: string; status?: string; job_id?: string
        }

        if (!res.ok) {
          const friendly = HTTP_ERROR_LABELS[res.status] ?? (data.error ?? 'Agent run failed.')
          console.error('[AgentRunButton] run-agent error:', res.status, data.error)
          setError(friendly)
          return
        }

        const label = data.demo
          ? `Demo run created — add RELEVANCE_API_KEY for real runs`
          : data.status === 'running'
            ? `${agent.name} started successfully`
            : `${agent.name} completed`

        setSuccess(label)
        if (data.run_id && onRunStarted) onRunStarted(data.run_id)

      } catch {
        setError('Network error. Please check your connection and try again.')
      }
    })
  }

  const disabled = pending || !canRun

  return (
    <div className="flex flex-col gap-1.5">
      {error   && <p className="text-[11.5px] text-[#ff8a7a] max-w-[180px] leading-snug">{error}</p>}
      {success && <p className="text-[11.5px] text-[#22d093] max-w-[180px] leading-snug">{success}</p>}

      <button
        type="button"
        onClick={handleRun}
        disabled={disabled}
        title={
          !relevanceReady   ? 'Configure RELEVANCE_API_KEY to enable real runs' :
          !canRun           ? `Requires ${planRequired}+ plan` :
          !agent.is_enabled ? 'Agent is disabled' : undefined
        }
        className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12.5px]
                   bg-[#ff7a18]/12 border border-[#ff7a18]/30 text-[#ffae3c]
                   hover:bg-[#ff7a18]/20 hover:border-[#ff7a18]/50 transition-all
                   disabled:opacity-40 disabled:cursor-not-allowed">
        {pending ? (
          <><span className="w-3.5 h-3.5 rounded-full border-2 border-[#ffae3c]/30 border-t-[#ffae3c] animate-spin" /> Running…</>
        ) : (
          <>▶ Run</>
        )}
      </button>

      {!canRun && (
        <span className="text-[10.5px] text-[#6a6a6e]">Needs {planRequired}+</span>
      )}
    </div>
  )
}
