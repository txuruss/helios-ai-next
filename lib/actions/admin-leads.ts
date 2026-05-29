'use server'

// ── Founder admin actions: agency sales pipeline (admin_leads) ─────
//
// Server actions behind the /admin/leads row actions. Every action:
//   1. Re-derives founder identity via requireAdmin().
//   2. Uses the service-role client (RLS gate is requireAdmin()).
//   3. Validates the id as a UUID before hitting Postgres.
//   4. Revalidates affected admin routes.
//
// SAFETY
//   • No hard deletes. Archive sets stage='archived' + archived_at.
//   • Convert is idempotent (UNIQUE source_lead_id on admin_clients).
//   • Missing pipeline tables degrade to a clear, user-safe error.

import { requireAdmin } from '@/lib/auth/require-admin'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { feesForPlan, isAdminPlan } from '@/lib/admin/plan-pricing'

export interface AdminLeadActionResult {
  ok:     boolean
  error?: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const LEAD_STAGES = ['new', 'qualified', 'audit_sent', 'proposal', 'won', 'lost'] as const
type LeadStage = (typeof LEAD_STAGES)[number]

function validId(raw: unknown): string | null {
  return typeof raw === 'string' && UUID_RE.test(raw) ? raw : null
}

function isMissingTable(e: { code?: string; message?: string } | null): boolean {
  if (!e) return false
  if (e.code === '42P01') return true
  const m = (e.message ?? '').toLowerCase()
  return m.includes('relation') && m.includes('does not exist')
}

const MIGRATION_HINT =
  'Pipeline tables not found. Apply migration 20260528120000_create_admin_pipeline.sql in Supabase, then retry.'

function guardServiceRole(): AdminLeadActionResult | null {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[admin-leads] SUPABASE_SERVICE_ROLE_KEY missing')
    return { ok: false, error: 'Server configuration error.' }
  }
  return null
}

// ── Update lead stage ──────────────────────────────────────────────
export async function updateLeadStage(
  leadId: string,
  stage:  LeadStage,
): Promise<AdminLeadActionResult> {
  await requireAdmin({ path: '/admin/leads' })

  const id = validId(leadId)
  if (!id) return { ok: false, error: 'Invalid lead id.' }
  if (!LEAD_STAGES.includes(stage)) return { ok: false, error: 'Invalid stage.' }

  const guard = guardServiceRole()
  if (guard) return guard

  const db = createServiceRoleClient()
  const { error } = await db.from('admin_leads').update({ stage }).eq('id', id)

  if (error) {
    if (isMissingTable(error)) return { ok: false, error: MIGRATION_HINT }
    console.error('[updateLeadStage]', error.message, '| code:', error.code)
    return { ok: false, error: 'Could not update lead stage. Try again.' }
  }

  revalidatePath('/admin/leads')
  revalidatePath('/admin/mission-control')
  return { ok: true }
}

// ── Archive a lead (soft) ──────────────────────────────────────────
export async function archiveLead(leadId: string): Promise<AdminLeadActionResult> {
  await requireAdmin({ path: '/admin/leads' })

  const id = validId(leadId)
  if (!id) return { ok: false, error: 'Invalid lead id.' }

  const guard = guardServiceRole()
  if (guard) return guard

  const db = createServiceRoleClient()
  const { error } = await db
    .from('admin_leads')
    .update({ stage: 'archived', archived_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    if (isMissingTable(error)) return { ok: false, error: MIGRATION_HINT }
    console.error('[archiveLead]', error.message, '| code:', error.code)
    return { ok: false, error: 'Could not archive lead. Try again.' }
  }

  revalidatePath('/admin/leads')
  revalidatePath('/admin/mission-control')
  return { ok: true }
}

// ── Convert a lead into a client ───────────────────────────────────
// Idempotent via UNIQUE source_lead_id on admin_clients. Fees default
// from the lead's target_plan and remain editable on the client record.
export async function convertLeadToClient(leadId: string): Promise<AdminLeadActionResult> {
  await requireAdmin({ path: '/admin/leads' })

  const id = validId(leadId)
  if (!id) return { ok: false, error: 'Invalid lead id.' }

  const guard = guardServiceRole()
  if (guard) return guard

  const db = createServiceRoleClient()

  // Already converted?
  const existing = await db
    .from('admin_clients')
    .select('id')
    .eq('source_lead_id', id)
    .maybeSingle()

  if (existing.error && isMissingTable(existing.error)) {
    return { ok: false, error: MIGRATION_HINT }
  }

  if (!existing.data) {
    const leadRes = await db
      .from('admin_leads')
      .select('id, source_audit_id, business_name, contact_name, email, phone, website, industry, location, target_plan')
      .eq('id', id)
      .single()

    if (leadRes.error || !leadRes.data) {
      if (leadRes.error && isMissingTable(leadRes.error)) return { ok: false, error: MIGRATION_HINT }
      return { ok: false, error: 'Lead not found.' }
    }

    const lead = leadRes.data as Record<string, unknown>
    const plan = isAdminPlan(lead.target_plan) ? lead.target_plan : null
    const fees = feesForPlan(plan)
    const today = new Date().toISOString().slice(0, 10)

    const { error: insErr } = await db.from('admin_clients').insert({
      source_lead_id:  id,
      source_audit_id: typeof lead.source_audit_id === 'string' ? lead.source_audit_id : null,
      business_name:   typeof lead.business_name === 'string' ? lead.business_name : '(unknown business)',
      contact_name:    typeof lead.contact_name === 'string' ? lead.contact_name : null,
      email:           typeof lead.email === 'string' ? lead.email : null,
      phone:           typeof lead.phone === 'string' ? lead.phone : null,
      website:         typeof lead.website === 'string' ? lead.website : null,
      industry:        typeof lead.industry === 'string' ? lead.industry : null,
      city:            typeof lead.location === 'string' ? lead.location : null,
      plan,
      setup_fee:       fees.setup_fee,
      monthly_fee:     fees.monthly_fee,
      status:          'onboarding',
      client_since:    today,
    })

    if (insErr) {
      // Unique violation = a client already exists for this lead's audit.
      if (insErr.code === '23505') return { ok: true }
      if (isMissingTable(insErr)) return { ok: false, error: MIGRATION_HINT }
      console.error('[convertLeadToClient] insert failed:', insErr.message, '| code:', insErr.code)
      return { ok: false, error: 'Could not convert lead to client. Try again.' }
    }
  }

  // Mark the lead won (best-effort).
  await db.from('admin_leads').update({ stage: 'won' }).eq('id', id)

  revalidatePath('/admin/leads')
  revalidatePath('/admin/clients')
  revalidatePath('/admin/mission-control')
  return { ok: true }
}
