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
// Audit → lead → client conversion now writes to the agency CRM tables
// (admin_leads / admin_clients, migration 20260528120000):
//   • qualifyAuditToLead    inserts an admin_leads row + sets status 'qualified'
//   • convertAuditToClient  inserts an admin_clients row + sets status 'converted'
// Both are idempotent (UNIQUE source_audit_id prevents duplicates) and
// degrade gracefully when the migration has not been applied yet.

import { requireAdmin } from '@/lib/auth/require-admin'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import {
  normalizeToAdminPlan,
  feesForPlan,
  PLAN_FEES,
} from '@/lib/admin/plan-pricing'
import { seedDefaultTasksFor } from '@/lib/admin/onboarding-tasks'

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

// Columns pulled from audit_submissions to seed a lead / client.
const AUDIT_SEED_COLS =
  'id, business_name, contact_name, email, phone, website, industry, ' +
  'city, country, location, selected_plan'

interface AuditSeed {
  id:            string
  business_name: string
  contact_name:  string | null
  email:         string | null
  phone:         string | null
  website:       string | null
  industry:      string | null
  city:          string | null
  country:       string | null
  location:      string | null
  selected_plan: string | null
}

function asStr(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null
}

function locationOf(s: AuditSeed): string | null {
  return s.location ?? ([s.city, s.country].filter(Boolean).join(', ') || null)
}

// PostgREST "relation does not exist" → migration not applied yet.
function isMissingTable(e: { code?: string; message?: string } | null): boolean {
  if (!e) return false
  if (e.code === '42P01') return true
  const m = (e.message ?? '').toLowerCase()
  return m.includes('relation') && m.includes('does not exist')
}

const MIGRATION_HINT =
  'Pipeline tables not found. Apply migration 20260528120000_create_admin_pipeline.sql in Supabase, then retry.'

async function fetchAuditSeed(
  db: ReturnType<typeof createServiceRoleClient>,
  id: string,
): Promise<AuditSeed | null> {
  const { data, error } = await db
    .from('audit_submissions')
    .select(AUDIT_SEED_COLS)
    .eq('id', id)
    .single()
  if (error || !data) return null
  const r = data as Record<string, unknown>
  return {
    id:            String(r.id ?? ''),
    business_name: asStr(r.business_name) ?? '(unknown business)',
    contact_name:  asStr(r.contact_name),
    email:         asStr(r.email),
    phone:         asStr(r.phone),
    website:       asStr(r.website),
    industry:      asStr(r.industry),
    city:          asStr(r.city),
    country:       asStr(r.country),
    location:      asStr(r.location),
    selected_plan: asStr(r.selected_plan),
  }
}

// ── Qualify an audit submission into an agency sales lead ──────────
// Idempotent: if a lead already exists for this audit, we simply ensure
// the submission is marked 'qualified' and return ok.
export async function qualifyAuditToLead(submissionId: string): Promise<AdminAuditActionResult> {
  await requireAdmin({ path: '/admin/audits' })

  const id = validateSubmissionId(submissionId)
  if (!id) return { ok: false, error: 'Invalid submission id.' }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[admin-audits] SUPABASE_SERVICE_ROLE_KEY missing')
    return { ok: false, error: 'Server configuration error.' }
  }

  const db = createServiceRoleClient()

  // Already qualified? (UNIQUE source_audit_id) — make it idempotent.
  const existing = await db
    .from('admin_leads')
    .select('id')
    .eq('source_audit_id', id)
    .maybeSingle()

  if (existing.error && isMissingTable(existing.error)) {
    return { ok: false, error: MIGRATION_HINT }
  }

  if (!existing.data) {
    const seed = await fetchAuditSeed(db, id)
    if (!seed) return { ok: false, error: 'Audit submission not found.' }

    const plan = normalizeToAdminPlan(seed.selected_plan)
    const { error: insErr } = await db.from('admin_leads').insert({
      source_audit_id: id,
      business_name:   seed.business_name,
      contact_name:    seed.contact_name,
      email:           seed.email,
      phone:           seed.phone,
      website:         seed.website,
      industry:        seed.industry,
      location:        locationOf(seed),
      target_plan:     plan,
      stage:           'qualified',
      estimated_value: plan ? PLAN_FEES[plan].est_value : 0,
      next_action:     'Send audit / book strategy call',
    })

    if (insErr) {
      if (isMissingTable(insErr)) return { ok: false, error: MIGRATION_HINT }
      console.error('[qualifyAuditToLead] insert failed:', insErr.message, '| code:', insErr.code)
      return { ok: false, error: 'Could not create lead. Try again.' }
    }
  }

  // Reflect qualification on the submission (best-effort).
  await db.from('audit_submissions').update({ status: 'qualified' }).eq('id', id)

  revalidatePath('/admin/audits')
  revalidatePath('/admin/leads')
  revalidatePath('/admin/mission-control')
  return { ok: true }
}

// ── Convert an audit submission directly into a client ─────────────
// Idempotent via UNIQUE source_audit_id. If a lead exists for this audit
// it is linked and marked 'won'.
export async function convertAuditToClient(submissionId: string): Promise<AdminAuditActionResult> {
  await requireAdmin({ path: '/admin/audits' })

  const id = validateSubmissionId(submissionId)
  if (!id) return { ok: false, error: 'Invalid submission id.' }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[admin-audits] SUPABASE_SERVICE_ROLE_KEY missing')
    return { ok: false, error: 'Server configuration error.' }
  }

  const db = createServiceRoleClient()

  const existing = await db
    .from('admin_clients')
    .select('id')
    .eq('source_audit_id', id)
    .maybeSingle()

  if (existing.error && isMissingTable(existing.error)) {
    return { ok: false, error: MIGRATION_HINT }
  }

  if (!existing.data) {
    const seed = await fetchAuditSeed(db, id)
    if (!seed) return { ok: false, error: 'Audit submission not found.' }

    // Link an existing lead from the same audit, if present.
    const leadRes = await db
      .from('admin_leads')
      .select('id')
      .eq('source_audit_id', id)
      .maybeSingle()
    const sourceLeadId =
      !leadRes.error && leadRes.data ? (leadRes.data.id as string) : null

    const plan  = normalizeToAdminPlan(seed.selected_plan)
    const fees  = feesForPlan(plan)
    const today = new Date().toISOString().slice(0, 10)

    const { error: insErr } = await db.from('admin_clients').insert({
      source_audit_id: id,
      source_lead_id:  sourceLeadId,
      business_name:   seed.business_name,
      contact_name:    seed.contact_name,
      email:           seed.email,
      phone:           seed.phone,
      website:         seed.website,
      industry:        seed.industry,
      city:            seed.city,
      plan,
      setup_fee:       fees.setup_fee,
      monthly_fee:     fees.monthly_fee,
      status:          'onboarding',
      client_since:    today,
    })

    if (insErr) {
      if (isMissingTable(insErr)) return { ok: false, error: MIGRATION_HINT }
      console.error('[convertAuditToClient] insert failed:', insErr.message, '| code:', insErr.code)
      return { ok: false, error: 'Could not convert to client. Try again.' }
    }

    if (sourceLeadId) {
      await db.from('admin_leads').update({ stage: 'won' }).eq('id', sourceLeadId)
    }
  }

  // Seed the default onboarding checklist (idempotent, non-fatal). A
  // failure here never blocks the conversion.
  try {
    const clientRow = await db
      .from('admin_clients')
      .select('id, plan')
      .eq('source_audit_id', id)
      .maybeSingle()
    if (!clientRow.error && clientRow.data) {
      await seedDefaultTasksFor(
        db,
        clientRow.data.id as string,
        typeof clientRow.data.plan === 'string' ? clientRow.data.plan : null,
      )
    }
  } catch (seedErr) {
    console.error('[convertAuditToClient] task seed failed (non-fatal):', seedErr instanceof Error ? seedErr.message : seedErr)
  }

  await db.from('audit_submissions').update({ status: 'converted' }).eq('id', id)

  revalidatePath('/admin/audits')
  revalidatePath('/admin/leads')
  revalidatePath('/admin/clients')
  revalidatePath('/admin/mission-control')
  return { ok: true }
}

// Backward-compatible alias — Convert now creates a real client.
export async function convertAuditSubmission(submissionId: string): Promise<AdminAuditActionResult> {
  return convertAuditToClient(submissionId)
}

export async function archiveBulkAuditSubmissions(ids: unknown[]): Promise<AdminAuditActionResult> {
  await requireAdmin({ path: '/admin/audits' })

  if (!Array.isArray(ids) || ids.length === 0) {
    return { ok: false, error: 'No submissions selected.' }
  }
  const validIds = ids.filter((id): id is string => typeof id === 'string' && UUID_RE.test(id))
  if (validIds.length === 0) return { ok: false, error: 'Invalid submission IDs.' }
  if (validIds.length > 50)  return { ok: false, error: 'Too many submissions selected at once (max 50).' }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[admin-audits] SUPABASE_SERVICE_ROLE_KEY missing')
    return { ok: false, error: 'Server configuration error.' }
  }

  const db = createServiceRoleClient()
  const { error } = await db
    .from('audit_submissions')
    .update({ status: 'archived' })
    .in('id', validIds)

  if (error) {
    console.error('[admin-audits] bulk archive failed:', error.message, '| code:', error.code)
    return { ok: false, error: 'Could not archive records. Try again.' }
  }

  revalidatePath('/admin/audits')
  revalidatePath('/admin/mission-control')
  return { ok: true }
}
