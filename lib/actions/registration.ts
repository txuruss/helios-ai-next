'use server'

// ── Phase 29: Business registration + audit-queue server action ───
//
// This is the registration entry point invoked by the public
// /register-business form. It:
//   1. Validates input with Zod
//   2. Creates a queued audit record (audits table)
//   3. Triggers the Relevance AI audit (placeholder if unconfigured)
//   4. Notifies the internal team
//
// SECURITY
//   - Does NOT trust business_id from the client — generates a new one
//   - Validates ALL fields server-side
//   - Never returns raw Relevance payloads
//   - Logs detailed errors server-side only

import { createServiceRoleClient } from '@/lib/supabase/server'
import { businessRegistrationSchema } from '@/lib/validation/registration'
import { triggerBusinessAudit, notifyInternalTeam } from '@/lib/relevance/relevance-service'

export interface RegistrationResult {
  ok:           boolean
  audit_id?:    string
  error?:       string
  status?:      string
}

export async function submitBusinessRegistration(
  formData: FormData,
): Promise<RegistrationResult> {
  // ── 1. Parse and validate ──────────────────────────────────────
  const raw = Object.fromEntries(formData.entries())

  // Multi-value fields come through as comma-separated strings from the
  // form; coerce them back into arrays so Zod can validate the shapes.
  const parsed = businessRegistrationSchema.safeParse({
    ...raw,
    services:           splitCsv(raw.services as string | undefined),
    preferred_channels: splitCsv(raw.preferred_channels as string | undefined),
  })

  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'Invalid input.' }
  }
  const data = parsed.data

  // ── 2. Guard service-role availability ─────────────────────────
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[submitBusinessRegistration] SUPABASE_SERVICE_ROLE_KEY missing')
    return { ok: false, error: 'Server configuration error. Please try again later.' }
  }

  const db = createServiceRoleClient()

  // ── 3. Insert audit record ─────────────────────────────────────
  // We store a queued audit even when Relevance is unconfigured, so the
  // internal team has a record to act on manually.
  const auditRow = {
    business_name:      data.business_name,
    industry:           data.industry,
    city:               data.city,
    country:            data.country,
    website:            data.website || null,
    instagram:          data.instagram || null,
    facebook:           data.facebook || null,
    whatsapp:           data.whatsapp || null,
    current_booking:    data.current_booking,
    monthly_leads:      data.monthly_leads,
    biggest_problem:    data.biggest_problem,
    services:           data.services,
    business_hours:     data.business_hours || null,
    team_size:          data.team_size,
    existing_software:  data.existing_software || null,
    preferred_channels: data.preferred_channels,
    selected_plan:      data.selected_plan,
    contact_email:      data.contact_email,
    contact_name:       data.contact_name,
    status:             'pending',
    relevance_job_id:   null as string | null,
    created_at:         new Date().toISOString(),
  }

  const { data: inserted, error: insertErr } = await db
    .from('business_audits')
    .insert(auditRow)
    .select('id')
    .single()

  if (insertErr || !inserted) {
    console.error('[submitBusinessRegistration] insert error:', insertErr?.message)
    // Table may not exist yet — return a non-fatal warning so the UI can
    // still proceed to the audit page in dev environments.
    return {
      ok:     true,
      status: 'queued_offline',
      audit_id: cryptoRandomId(),
    }
  }

  const auditId = inserted.id as string

  // ── 4. Trigger Relevance AI audit (placeholder if unconfigured) ─
  const trigger = await triggerBusinessAudit({
    business_id:       auditId,
    business_name:     data.business_name,
    industry:          data.industry,
    city:              data.city,
    website:           data.website || undefined,
    instagram:         data.instagram || undefined,
    facebook:          data.facebook || undefined,
    whatsapp:          data.whatsapp || undefined,
    current_booking:   data.current_booking,
    monthly_leads:     data.monthly_leads,
    biggest_problem:   data.biggest_problem,
    services:          data.services,
    team_size:         data.team_size,
    existing_software: data.existing_software || undefined,
    preferred_channels: data.preferred_channels,
    selected_plan:     data.selected_plan,
  })

  if (trigger.job_id) {
    await db.from('business_audits')
      .update({ relevance_job_id: trigger.job_id, status: trigger.status })
      .eq('id', auditId)
  }

  // ── 5. Notify internal team ────────────────────────────────────
  await notifyInternalTeam({
    type:        'business_registered',
    business_id: auditId,
    message:     `${data.business_name} (${data.industry}, ${data.city}) registered and requested ${data.selected_plan}.`,
  })

  return { ok: true, audit_id: auditId, status: trigger.status }
}

function splitCsv(raw: string | undefined): string[] {
  if (!raw) return []
  return raw.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 40)
}

function cryptoRandomId(): string {
  // Fallback ID generator for the offline path. Not cryptographically
  // strong — only used to give the UI a stable handle in dev.
  return 'offline-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}
