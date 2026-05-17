'use server'

import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { captureApiError } from '@/lib/logging/api'
import { capture } from '@/lib/analytics/posthog'
import {
  DEMO_BUSINESS, DEMO_SERVICES, DEMO_FAQS, DEMO_LEADS,
  DEMO_BOOKING, DEMO_OPS_EVENTS,
  DEMO_AUDIT, DEMO_AUDIT_FINDINGS, DEMO_AUDIT_RECOMMENDATION,
} from '@/lib/demo/demo-data'

type DbRow = Record<string, unknown>

// ── Auth helper ───────────────────────────────────────────────────

async function requireAuth(): Promise<
  { ok: true; userId: string; businessId: string } |
  { ok: false; error: string }
> {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated.' }

  const db = createServiceRoleClient()
  const { data: membership } = await db
    .from('business_members').select('business_id').eq('user_id', user.id).limit(1).single()
  if (!membership) return { ok: false, error: 'No business found.' }

  return { ok: true, userId: user.id, businessId: (membership as DbRow).business_id as string }
}

// ── Load demo data ────────────────────────────────────────────────
// Inserts safe sample data for the authenticated user's business.
// Never overwrites real data — uses upsert with demo tags.

export async function loadDemoData(confirm: true): Promise<{ ok?: boolean; error?: string }> {
  if (confirm !== true) return { error: 'Confirmation required.' }

  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const db = createServiceRoleClient()

  try {
    // Check if real data exists — don't overwrite
    const { count: realServices } = await db
      .from('services')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', auth.businessId)
      .not('metadata->demo', 'is', null)

    // Mark setup progress as demo active
    await db.from('client_setup_progress').upsert({
      business_id:      auth.businessId,
      demo_mode_active: true,
      demo_loaded_at:   new Date().toISOString(),
      updated_at:       new Date().toISOString(),
    }, { onConflict: 'business_id' })

    // Insert demo services (tagged with demo:true in metadata)
    const demoServiceInserts = DEMO_SERVICES.map((s) => ({
      business_id:  auth.businessId,
      name:         s.name,
      price_min:    s.price_min,
      price_max:    s.price_max,
      duration_min: s.duration_min,
      status:       'active',
      metadata:     { demo: true },
    }))

    // Only insert if we have fewer than 3 demo services already
    if ((realServices ?? 0) < 3) {
      await db.from('services').upsert(demoServiceInserts, { onConflict: 'business_id,name', ignoreDuplicates: true }).catch(() => undefined)
    }

    // Insert demo FAQs (tagged with demo:true)
    const demoFaqInserts = DEMO_FAQS.map((f) => ({
      business_id: auth.businessId,
      question:    f.question,
      answer:      f.answer,
      is_active:   true,
      metadata:    { demo: true },
    }))
    await db.from('faqs').upsert(demoFaqInserts, { onConflict: 'business_id,question', ignoreDuplicates: true }).catch(() => undefined)

    // Insert demo leads
    const demoLeadInserts = DEMO_LEADS.map((l) => ({
      business_id:   auth.businessId,
      name:          l.name,
      email:         null,
      phone:         null,
      source:        l.source,
      status:        l.status,
      service_interest: l.service,
      metadata:      { demo: true },
    }))
    await db.from('leads').upsert(demoLeadInserts, { onConflict: 'business_id,name', ignoreDuplicates: true }).catch(() => undefined)

    // Insert demo booking request
    const tomorrow = new Date(Date.now() + 86400000)
    tomorrow.setHours(14, 30, 0, 0)
    await db.from('bookings').upsert({
      business_id:          auth.businessId,
      customer_name:        DEMO_BOOKING.customer_name,
      customer_email:       null,
      status:               DEMO_BOOKING.status,
      confirmation_status:  DEMO_BOOKING.confirmation_status,
      notes:                DEMO_BOOKING.notes,
      scheduled_at:         tomorrow.toISOString(),
      metadata:             DEMO_BOOKING.metadata,
    }, { onConflict: 'business_id,customer_name', ignoreDuplicates: true }).catch(() => undefined)

    // Insert demo ops events
    for (const ev of DEMO_OPS_EVENTS) {
      await db.from('ops_events').insert({
        business_id: auth.businessId,
        source:      ev.source,
        event_type:  ev.event_type,
        severity:    ev.severity,
        title:       ev.title,
        status:      'resolved',
        metadata:    ev.metadata,
      }).catch(() => undefined)
    }

    // Insert demo audit + findings + recommendation
    const { data: auditRow } = await db.from('business_audits').insert({
      business_id: auth.businessId,
      ...DEMO_AUDIT,
      created_by:  auth.userId,
      completed_at: new Date().toISOString(),
    }).select('id').single().catch(() => ({ data: null }))

    if (auditRow) {
      const auditId = (auditRow as { id: string }).id
      await db.from('business_audit_findings').insert(
        DEMO_AUDIT_FINDINGS.map((f) => ({ ...f, business_id: auth.businessId, audit_id: auditId }))
      ).catch(() => undefined)
      await db.from('business_audit_recommendations').insert({
        ...DEMO_AUDIT_RECOMMENDATION,
        business_id: auth.businessId,
        audit_id:    auditId,
      }).catch(() => undefined)
    }

    capture('demo_mode_loaded', { demo_business: DEMO_BUSINESS.name })
    capture('demo_business_loaded', {})

    return { ok: true }
  } catch (err) {
    captureApiError(err, { route: 'actions/demo', error_type: 'demo_load_error', business_id: auth.businessId })
    return { error: 'Could not load demo data.' }
  }
}

// ── Reset demo data ───────────────────────────────────────────────
// Removes only rows tagged with metadata->demo:true.

export async function resetDemoData(): Promise<{ ok?: boolean; error?: string }> {
  const auth = await requireAuth()
  if (!auth.ok) return { error: auth.error }
  const db = createServiceRoleClient()

  try {
    // Remove only demo-tagged rows
    await Promise.all([
      db.from('services').delete().eq('business_id', auth.businessId).contains('metadata', { demo: true }).catch(() => undefined),
      db.from('faqs').delete().eq('business_id', auth.businessId).contains('metadata', { demo: true }).catch(() => undefined),
      db.from('leads').delete().eq('business_id', auth.businessId).contains('metadata', { demo: true }).catch(() => undefined),
      db.from('bookings').delete().eq('business_id', auth.businessId).contains('metadata', { demo: true }).catch(() => undefined),
      db.from('ops_events').delete().eq('business_id', auth.businessId).contains('metadata', { demo: true }).catch(() => undefined),
      db.from('business_audits').delete().eq('business_id', auth.businessId).contains('metadata', { demo: true }).catch(() => undefined),
    ])

    // Unmark demo mode
    await db.from('client_setup_progress').upsert({
      business_id:      auth.businessId,
      demo_mode_active: false,
      demo_loaded_at:   null,
      updated_at:       new Date().toISOString(),
    }, { onConflict: 'business_id' })

    capture('demo_mode_reset', {})
    capture('demo_business_reset', {})

    return { ok: true }
  } catch (err) {
    captureApiError(err, { route: 'actions/demo', error_type: 'demo_reset_error', business_id: auth.businessId })
    return { error: 'Could not reset demo data.' }
  }
}

// ── Get demo mode state ───────────────────────────────────────────

export async function getDemoModeState(): Promise<{
  active:     boolean
  loadedAt:   string | null
  error:      string | null
}> {
  const auth = await requireAuth()
  if (!auth.ok) return { active: false, loadedAt: null, error: auth.error }
  const db = createServiceRoleClient()

  try {
    const { data } = await db
      .from('client_setup_progress')
      .select('demo_mode_active, demo_loaded_at')
      .eq('business_id', auth.businessId)
      .single()

    const d = data as { demo_mode_active?: boolean; demo_loaded_at?: string | null } | null
    return { active: d?.demo_mode_active ?? false, loadedAt: d?.demo_loaded_at ?? null, error: null }
  } catch {
    return { active: false, loadedAt: null, error: null }
  }
}
