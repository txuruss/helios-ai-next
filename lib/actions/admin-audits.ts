'use server'

// ── Lean Baseline: founder admin audit-submission actions ─────────
//
// Server actions wired up to the /admin/audits action buttons.
// All three actions:
//   1. Re-derive identity server-side via requireAdmin().
//   2. Use the service-role client so the founder_admin RLS policy on
//      audit_submissions is satisfied (the service role bypasses RLS;
//      the requireAdmin() check above is the real gate).
//   3. Revalidate /admin/audits and /admin/mission-control so the
//      table + KPI cards reflect the new state immediately.
//
// SECURITY
//   • requireAdmin() reads Supabase auth + team_members on every call.
//     A non-founder attacker forging the submission_id parameter is
//     blocked here.
//   • The submission_id is validated as a UUID before being sent to
//     Postgres to refuse junk that could affect the explain plan.
//   • Errors are returned as `{ ok: false, error }` with a generic
//     message; the raw Supabase error is logged server-side only.
//
// Convert-to-lead intentionally does NOT insert a leads row in this
// pass. The `leads` table requires a non-null business_id and uses a
// `source` CHECK constraint that does not include 'audit'. Until we
// add a proper "convert this submission into a real business" flow
// (which creates the business + business_member + lead atomically),
// Convert just flips audit_submissions.status to 'converted'. The gap
// is tracked in docs/PARKED_FEATURES.md.

import { requireAdmin } from '@/lib/auth/require-admin'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface AdminAuditActionResult {
  ok:    boolean
  error?: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function validateSubmissionId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  if (!UUID_RE.test(raw)) return null
  return raw
}

async function updateStatus(
  submissionId: string,
  nextStatus: 'in_review' | 'archived' | 'converted',
): Promise<AdminAuditActionResult> {
  await requireAdmin({ path: '/admin/audits' })

  const id = validateSubmissionId(submissionId)
  if (!id) return { ok: false, error: 'Invalid submission id.' }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[admin-audits] SUPABASE_SERVICE_ROLE_KEY missing')
    return { ok: false, error: 'Server configuration error.' }
  }

  const db = createServiceRoleClient()
  const { error } = await db
    .from('audit_submissions')
    .update({ status: nextStatus })
    .eq('id', id)

  if (error) {
    console.error('[admin-audits] update failed:', error.message, '| code:', error.code)
    return { ok: false, error: 'Could not update submission. Try again.' }
  }

  revalidatePath('/admin/audits')
  revalidatePath('/admin/mission-control')
  return { ok: true }
}

export async function markAuditReviewed(submissionId: string): Promise<AdminAuditActionResult> {
  return updateStatus(submissionId, 'in_review')
}

export async function archiveAuditSubmission(submissionId: string): Promise<AdminAuditActionResult> {
  return updateStatus(submissionId, 'archived')
}

// Lean fallback: flips status to 'converted' only. A proper
// audit-to-lead conversion (business + business_member + leads row)
// is parked. See docs/PARKED_FEATURES.md.
export async function convertAuditSubmission(submissionId: string): Promise<AdminAuditActionResult> {
  return updateStatus(submissionId, 'converted')
}
