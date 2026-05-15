// ── Relevance AI server-only client ──────────────────────────────
// NEVER import this in client components.
// All credentials stay server-side only.

import { captureApiError } from '@/lib/logging/api'

function getConfig(): { baseUrl: string; authHeader: string } | null {
  const apiKey    = process.env.RELEVANCE_API_KEY
  const projectId = process.env.RELEVANCE_PROJECT_ID
  const region    = process.env.RELEVANCE_REGION ?? 'us-east-1'

  if (!apiKey || !projectId) return null

  return {
    baseUrl:    `https://${region}-relevance-ai.b8.workers.dev`,
    authHeader: `Key ${projectId}:${apiKey}`,
  }
}

export function isRelevanceConfigured(): boolean {
  return !!(process.env.RELEVANCE_API_KEY && process.env.RELEVANCE_PROJECT_ID)
}

// ── Typed result wrapper ─────────────────────────────────────────

export type RelevanceResult<T> =
  | { ok: true;  data: T }
  | { ok: false; error: string }

// ── Internal fetch helper ────────────────────────────────────────

async function relevanceFetch<T>(
  path:    string,
  options?: RequestInit,
): Promise<RelevanceResult<T>> {
  const cfg = getConfig()
  if (!cfg) return { ok: false, error: 'RELEVANCE_API_KEY or RELEVANCE_PROJECT_ID not configured.' }

  const url = `${cfg.baseUrl}${path}`
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization:  cfg.authHeader,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })

    const raw = await res.json().catch(() => ({}))

    if (!res.ok) {
      const msg = (raw as { message?: string })?.message ?? `HTTP ${res.status}`
      console.error('[relevance]', options?.method ?? 'GET', url, res.status, msg)
      return { ok: false, error: 'Relevance AI request failed.' }
    }

    return { ok: true, data: raw as T }
  } catch (err) {
    console.error('[relevance] fetch error:', err instanceof Error ? err.message : err)
    captureApiError(err, { route: url, error_type: 'relevance_fetch_error' })
    return { ok: false, error: 'Unable to reach Relevance AI.' }
  }
}

// ── Domain types ─────────────────────────────────────────────────

export interface RelevanceAgent {
  studio_id:   string
  name:        string
  description: string | null
  metadata?:   Record<string, unknown>
}

export interface RelevanceWorkforceItem {
  workforce_id: string
  name:         string
  description:  string | null
}

export interface RelevanceRunResult {
  job_id:    string
  status:    'pending' | 'running' | 'complete' | 'failed'
  output?:   Record<string, unknown>
  error?:    string
}

// ── listAgents ───────────────────────────────────────────────────

export async function listAgents(): Promise<RelevanceResult<RelevanceAgent[]>> {
  const result = await relevanceFetch<{ results?: RelevanceAgent[] }>('/latest/studios/list')
  if (!result.ok) return result
  const agents = (result.data.results ?? []) as RelevanceAgent[]
  return { ok: true, data: agents }
}

// ── listWorkforces ───────────────────────────────────────────────

export async function listWorkforces(): Promise<RelevanceResult<RelevanceWorkforceItem[]>> {
  const result = await relevanceFetch<{ results?: RelevanceWorkforceItem[] }>('/latest/workforces/list')
  if (!result.ok) return result
  return { ok: true, data: result.data.results ?? [] }
}

// ── runAgent ─────────────────────────────────────────────────────

export interface RunAgentParams {
  agentId:      string
  message:      string
  maxSteps?:    number
  context?:     Record<string, string>
}

export async function runAgent(params: RunAgentParams): Promise<RelevanceResult<{ job_id: string }>> {
  const body = {
    message:   { role: 'human', content: params.message },
    max_steps: params.maxSteps ?? 10,
    ...(params.context ? { context: params.context } : {}),
  }
  return relevanceFetch<{ job_id: string }>(
    `/latest/studios/${params.agentId}/trigger_async`,
    { method: 'POST', body: JSON.stringify(body) },
  )
}

// ── runWorkforce ─────────────────────────────────────────────────

export interface RunWorkforceParams {
  workforceId: string
  message:     string
  context?:    Record<string, string>
}

export async function runWorkforce(params: RunWorkforceParams): Promise<RelevanceResult<{ job_id: string }>> {
  const body = {
    message: { role: 'human', content: params.message },
    ...(params.context ? { context: params.context } : {}),
  }
  return relevanceFetch<{ job_id: string }>(
    `/latest/workforces/${params.workforceId}/trigger_async`,
    { method: 'POST', body: JSON.stringify(body) },
  )
}

// ── getRunStatus ─────────────────────────────────────────────────

export async function getRunStatus(
  agentId: string,
  jobId:   string,
): Promise<RelevanceResult<RelevanceRunResult>> {
  return relevanceFetch<RelevanceRunResult>(
    `/latest/studios/${agentId}/async_poll/${jobId}`,
    { method: 'POST', body: '{}' },
  )
}

// ── cancelRun ────────────────────────────────────────────────────

export async function cancelRun(agentId: string, jobId: string): Promise<RelevanceResult<{ ok: true }>> {
  return relevanceFetch<{ ok: true }>(
    `/latest/studios/${agentId}/tasks/${jobId}/cancel`,
    { method: 'POST', body: '{}' },
  )
}
