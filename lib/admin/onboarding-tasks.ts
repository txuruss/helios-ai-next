import 'server-only'

// ── Default client onboarding checklist ────────────────────────────
// Seeded (idempotently) on client conversion and via the manual
// "Create default checklist" action. Titles/categories/priorities are
// the single source of truth for the default list.

import type { createServiceRoleClient } from '@/lib/supabase/server'
import { getOnboardingTasksForPlan } from './onboarding-task-templates'

type Db = ReturnType<typeof createServiceRoleClient>

export type TaskStatus   = 'todo' | 'in_progress' | 'blocked' | 'done'
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'
export type TaskCategory =
  | 'onboarding' | 'setup' | 'automation' | 'communication' | 'QA' | 'handoff' | 'support'

export interface DefaultTask {
  title:    string
  category: TaskCategory
  priority: TaskPriority
}

export const DEFAULT_ONBOARDING_TASKS: DefaultTask[] = [
  { title: 'Collect business information',   category: 'onboarding',    priority: 'high'   },
  { title: 'Confirm services and pricing',   category: 'onboarding',    priority: 'high'   },
  { title: 'Confirm business hours',         category: 'onboarding',    priority: 'normal' },
  { title: 'Confirm booking/contact flow',   category: 'setup',         priority: 'high'   },
  { title: 'Set up AI chat assistant',       category: 'automation',    priority: 'high'   },
  { title: 'Connect lead capture',           category: 'automation',    priority: 'high'   },
  { title: 'Connect booking flow',           category: 'automation',    priority: 'high'   },
  { title: 'Test website audit/form flow',   category: 'QA',            priority: 'normal' },
  { title: 'Test client notifications',      category: 'QA',            priority: 'normal' },
  { title: 'Send client handoff',            category: 'handoff',       priority: 'normal' },
  { title: 'Mark client live',               category: 'handoff',       priority: 'high'   },
]

function isMissingTable(e: { code?: string; message?: string } | null): boolean {
  if (!e) return false
  if (e.code === '42P01') return true
  const m = (e.message ?? '').toLowerCase()
  return m.includes('relation') && m.includes('does not exist')
}

export interface SeedResult {
  seeded:       number
  skipped:      boolean   // client already had tasks
  missingTable: boolean
  error:        string | null
}

// Idempotent: only seeds when the client has zero tasks. Never throws —
// callers (conversion flow) treat seeding as non-fatal. The task list is
// chosen by the client's plan (Starter / Booking OS / Helios AIOS), with
// Starter as the safe fallback for unknown plans.
export async function seedDefaultTasksFor(
  db: Db,
  clientId: string,
  plan?: string | null,
): Promise<SeedResult> {
  try {
    const existing = await db
      .from('admin_client_tasks')
      .select('id')
      .eq('client_id', clientId)
      .limit(1)

    if (existing.error) {
      if (isMissingTable(existing.error)) return { seeded: 0, skipped: false, missingTable: true, error: null }
      throw existing.error
    }
    if (existing.data && existing.data.length > 0) {
      return { seeded: 0, skipped: true, missingTable: false, error: null }
    }

    const rows = getOnboardingTasksForPlan(plan).map((t) => ({
      client_id: clientId,
      title:     t.title,
      category:  t.category,
      priority:  t.priority,
      status:    'todo' as const,
    }))

    const { error } = await db.from('admin_client_tasks').insert(rows)
    if (error) {
      if (isMissingTable(error)) return { seeded: 0, skipped: false, missingTable: true, error: null }
      throw error
    }
    return { seeded: rows.length, skipped: false, missingTable: false, error: null }
  } catch (err) {
    return { seeded: 0, skipped: false, missingTable: false, error: err instanceof Error ? err.message : 'seed failed' }
  }
}
