// ── Founder-only reads: cross-client suggestion rollups ────────────
//
// Computes deterministic next-action suggestions for clients using REAL
// admin_clients + admin_client_tasks data. Read-only — never writes.
//
// RESILIENCE: if the tasks table is missing, task-based suggestions are
// simply skipped (payment/status suggestions still compute). Missing
// clients table → empty. Never crashes.

import 'server-only'

import { requireAdmin } from '@/lib/auth/require-admin'
import { createServiceRoleClient } from '@/lib/supabase/server'
import {
  getPrimaryClientSuggestion, getSuggestionActionLabel, suggestionSeverityRank,
  type SuggestionTask, type SuggestionSeverity, type SuggestionActionType,
} from '@/lib/admin/client-suggestions'

export interface ClientSuggestionSummary {
  label:      string
  title:      string
  severity:   SuggestionSeverity
  actionType: SuggestionActionType
}

export interface TopClientSuggestion {
  client_id:         string
  business_name:     string
  title:             string
  recommendedAction: string
  severity:          SuggestionSeverity
  actionType:        SuggestionActionType
}

export interface TopClientSuggestionsResult {
  items:           TopClientSuggestion[]
  total:           number   // clients with at least one suggestion
  migrationNeeded: boolean
  error:           string | null
}

function isMissingTable(e: { code?: string; message?: string } | null): boolean {
  if (!e) return false
  if (e.code === '42P01') return true
  const m = (e.message ?? '').toLowerCase()
  return m.includes('relation') && m.includes('does not exist')
}

interface ClientRow {
  id: string; business_name: string; status: string | null
  onboarding_stage: string | null; payment_status: string | null
  payment_method: string | null; next_payment_due: string | null
}

const CLIENT_COLS = 'id, business_name, status, onboarding_stage, payment_status, payment_method, next_payment_due'

// Fetches non-archived clients + their tasks grouped by client. Tasks
// table missing → empty task map (task-based suggestions skipped).
async function loadClientsAndTasks(
  db: ReturnType<typeof createServiceRoleClient>,
): Promise<{ clients: ClientRow[]; taskMap: Map<string, SuggestionTask[]>; migrationNeeded: boolean } | null> {
  const clientsRes = await db.from('admin_clients').select(CLIENT_COLS).neq('status', 'archived')
  if (clientsRes.error) {
    if (isMissingTable(clientsRes.error)) return null
    throw clientsRes.error
  }
  const clients = (clientsRes.data ?? []) as ClientRow[]

  const taskMap = new Map<string, SuggestionTask[]>()
  let migrationNeeded = false

  const tasksRes = await db.from('admin_client_tasks').select('client_id, status, priority, due_date')
  if (tasksRes.error) {
    if (isMissingTable(tasksRes.error)) migrationNeeded = true
    else throw tasksRes.error
  } else {
    for (const r of (tasksRes.data ?? []) as Record<string, unknown>[]) {
      const cid = String(r.client_id ?? '')
      const arr = taskMap.get(cid) ?? []
      arr.push({
        status:   typeof r.status === 'string' ? r.status : 'todo',
        priority: typeof r.priority === 'string' ? r.priority : null,
        due_date: typeof r.due_date === 'string' ? r.due_date.slice(0, 10) : null,
      })
      taskMap.set(cid, arr)
    }
  }
  return { clients, taskMap, migrationNeeded }
}

// Map of clientId → primary suggestion summary (for the Clients table).
export async function getClientSuggestionMap(): Promise<Record<string, ClientSuggestionSummary>> {
  await requireAdmin({ path: '/admin/clients' })
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return {}

  try {
    const db = createServiceRoleClient()
    const loaded = await loadClientsAndTasks(db)
    if (!loaded) return {}

    const map: Record<string, ClientSuggestionSummary> = {}
    for (const c of loaded.clients) {
      const primary = getPrimaryClientSuggestion(c, loaded.taskMap.get(c.id) ?? [])
      if (primary) {
        map[c.id] = {
          label:      getSuggestionActionLabel(primary),
          title:      primary.title,
          severity:   primary.severity,
          actionType: primary.actionType,
        }
      }
    }
    return map
  } catch (err) {
    console.error('[getClientSuggestionMap]', err instanceof Error ? err.message : err)
    return {}
  }
}

// Top N highest-priority suggestions across all clients (Mission Control).
export async function getTopClientSuggestions(limit = 3): Promise<TopClientSuggestionsResult> {
  await requireAdmin({ path: '/admin/mission-control' })
  const empty: TopClientSuggestionsResult = { items: [], total: 0, migrationNeeded: false, error: null }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return empty

  try {
    const db = createServiceRoleClient()
    const loaded = await loadClientsAndTasks(db)
    if (!loaded) return empty

    const all: TopClientSuggestion[] = []
    for (const c of loaded.clients) {
      const primary = getPrimaryClientSuggestion(c, loaded.taskMap.get(c.id) ?? [])
      if (primary) {
        all.push({
          client_id:         c.id,
          business_name:     c.business_name,
          title:             primary.title,
          recommendedAction: primary.recommendedAction,
          severity:          primary.severity,
          actionType:        primary.actionType,
        })
      }
    }

    all.sort((a, b) => suggestionSeverityRank(a.severity) - suggestionSeverityRank(b.severity))

    return {
      items:           all.slice(0, Math.max(1, limit)),
      total:           all.length,
      migrationNeeded: loaded.migrationNeeded,
      error:           null,
    }
  } catch (err) {
    console.error('[getTopClientSuggestions]', err instanceof Error ? err.message : err)
    return { ...empty, error: 'Client suggestions unavailable.' }
  }
}
