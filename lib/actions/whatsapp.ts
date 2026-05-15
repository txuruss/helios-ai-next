'use server'

import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { getAuthContext } from '@/lib/actions/_shared'
import { getBusinessPlan } from '@/lib/billing/limits'
import { whatsappSettingsSchema } from '@/lib/validation/whatsapp'
import { sendWhatsAppTextMessage } from '@/lib/whatsapp/client'
import { captureApiError } from '@/lib/logging/api'

const PLAN_ORDER: Record<string, number> = { starter: 0, pro: 1, scale: 2 }

type DbRow = Record<string, unknown>

// ── Shared auth helper ────────────────────────────────────────────

async function getAuthedBusinessId(): Promise<{ ok: true; businessId: string } | { ok: false; error: string }> {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return { ok: false, error: 'Please sign in to manage WhatsApp settings.' }

  const db = createServiceRoleClient()
  const { data: membership } = await db
    .from('business_members').select('business_id').eq('user_id', user.id).limit(1).single()

  if (!membership) return { ok: false, error: 'Create a business profile first.' }
  return { ok: true, businessId: (membership as DbRow).business_id as string }
}

// ── getWhatsAppConnection ─────────────────────────────────────────

export interface WhatsAppConnectionRow {
  id:                   string
  business_id:          string
  phone_number_id:      string | null
  business_account_id:  string | null
  display_phone_number: string | null
  status:               string
  is_enabled:           boolean
  metadata:             Record<string, unknown>
  created_at:           string
  updated_at:           string
}

export async function getWhatsAppConnection(): Promise<{
  connection: WhatsAppConnectionRow | null
  plan:       string
  error:      string | null
}> {
  const auth = await getAuthContext()
  if (!auth.user)       return { connection: null, plan: 'starter', error: 'Not authenticated.' }
  if (!auth.businessId) return { connection: null, plan: 'starter', error: 'No business found.' }

  const db = createServiceRoleClient()
  const [connRes, plan] = await Promise.all([
    db.from('whatsapp_connections').select('*').eq('business_id', auth.businessId).single(),
    getBusinessPlan(db, auth.businessId),
  ])

  return {
    connection: (connRes.data as WhatsAppConnectionRow | null) ?? null,
    plan,
    error:      null,
  }
}

// ── updateWhatsAppConnection ──────────────────────────────────────

export async function updateWhatsAppConnection(
  formData: FormData,
): Promise<{ success?: string; error?: string }> {
  const auth = await getAuthedBusinessId()
  if (!auth.ok) return { error: auth.error }
  const { businessId } = auth

  const raw = {
    is_enabled:           formData.get('is_enabled') === 'true',
    display_phone_number: formData.get('display_phone_number') as string || undefined,
    business_account_id:  formData.get('business_account_id')  as string || undefined,
  }

  const parsed = whatsappSettingsSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Invalid input.' }

  const db = createServiceRoleClient()

  // If enabling, check plan
  if (parsed.data.is_enabled) {
    const plan = await getBusinessPlan(db, businessId)
    if ((PLAN_ORDER[plan] ?? 0) < (PLAN_ORDER['pro'] ?? 1)) {
      return { error: 'This channel requires the Pro plan.' }
    }
  }

  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? null

  try {
    const { error: upsertErr } = await db
      .from('whatsapp_connections')
      .upsert(
        {
          business_id:          businessId,
          phone_number_id:      phoneNumberId ?? undefined,
          business_account_id:  parsed.data.business_account_id ?? undefined,
          display_phone_number: parsed.data.display_phone_number ?? undefined,
          is_enabled:           parsed.data.is_enabled,
          status:               phoneNumberId ? 'connected' : 'disconnected',
        },
        { onConflict: 'business_id' },
      )

    if (upsertErr) {
      console.error('[whatsapp] updateWhatsAppConnection:', upsertErr.message)
      return { error: 'Could not save WhatsApp settings.' }
    }

    await db.from('audit_logs').insert({
      business_id: businessId,
      user_id:     null,
      action:      parsed.data.is_enabled ? 'whatsapp.channel.enabled' : 'whatsapp.channel.disabled',
      resource:    'whatsapp_connections',
    }).catch(() => undefined)

    return { success: 'WhatsApp settings saved.' }
  } catch (err) {
    captureApiError(err, { route: 'actions/whatsapp', error_type: 'update_connection_error', business_id: businessId })
    return { error: 'Could not save WhatsApp settings.' }
  }
}

// ── toggleWhatsAppConnection ──────────────────────────────────────

export async function toggleWhatsAppConnection(
  isEnabled: boolean,
): Promise<{ success?: string; error?: string }> {
  const auth = await getAuthedBusinessId()
  if (!auth.ok) return { error: auth.error }
  const { businessId } = auth

  const db = createServiceRoleClient()

  if (isEnabled) {
    const plan = await getBusinessPlan(db, businessId)
    if ((PLAN_ORDER[plan] ?? 0) < (PLAN_ORDER['pro'] ?? 1)) {
      return { error: 'This channel requires the Pro plan.' }
    }
  }

  try {
    const { error: upsertErr } = await db
      .from('whatsapp_connections')
      .upsert(
        { business_id: businessId, is_enabled: isEnabled },
        { onConflict: 'business_id' },
      )

    if (upsertErr) {
      console.error('[whatsapp] toggleWhatsAppConnection:', upsertErr.message)
      return { error: 'Could not update WhatsApp channel.' }
    }

    await db.from('audit_logs').insert({
      business_id: businessId,
      user_id:     null,
      action:      isEnabled ? 'whatsapp.channel.enabled' : 'whatsapp.channel.disabled',
      resource:    'whatsapp_connections',
    }).catch(() => undefined)

    return { success: isEnabled ? 'WhatsApp channel enabled.' : 'WhatsApp channel disabled.' }
  } catch (err) {
    captureApiError(err, { route: 'actions/whatsapp', error_type: 'toggle_error', business_id: businessId })
    return { error: 'Could not update WhatsApp channel.' }
  }
}

// ── getWhatsAppMessages ───────────────────────────────────────────

export interface WhatsAppMessageRow {
  id:                   string
  business_id:          string
  lead_id:              string | null
  chat_session_id:      string | null
  whatsapp_message_id:  string
  from_phone:           string
  to_phone:             string
  direction:            'inbound' | 'outbound'
  message_type:         string
  content_summary:      string | null
  status:               string
  metadata:             Record<string, unknown>
  created_at:           string
}

export async function getWhatsAppMessages(limit = 30): Promise<{
  messages: WhatsAppMessageRow[]
  error:    string | null
}> {
  const auth = await getAuthContext()
  if (!auth.user)       return { messages: [], error: 'Not authenticated.' }
  if (!auth.businessId) return { messages: [], error: 'No business found.' }

  const db = createServiceRoleClient()
  const { data, error } = await db
    .from('whatsapp_messages')
    .select('*')
    .eq('business_id', auth.businessId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[whatsapp] getWhatsAppMessages:', error.message)
    return { messages: [], error: 'Could not load WhatsApp messages.' }
  }

  return { messages: (data ?? []) as WhatsAppMessageRow[], error: null }
}

// ── sendTestWhatsAppMessage ───────────────────────────────────────
// Dashboard-only test — requires Pro/Scale plan, sends to a verified number.

export async function sendTestWhatsAppMessage(
  to: string,
): Promise<{ success?: string; error?: string }> {
  const auth = await getAuthedBusinessId()
  if (!auth.ok) return { error: auth.error }
  const { businessId } = auth

  // Validate phone (digits only, reasonable length)
  if (!/^\d{10,15}$/.test(to)) {
    return { error: 'Invalid phone number. Use digits only, 10-15 characters.' }
  }

  const db = createServiceRoleClient()
  const plan = await getBusinessPlan(db, businessId)
  if ((PLAN_ORDER[plan] ?? 0) < (PLAN_ORDER['pro'] ?? 1)) {
    return { error: 'This channel requires the Pro plan.' }
  }

  const { data: conn } = await db
    .from('whatsapp_connections')
    .select('is_enabled')
    .eq('business_id', businessId)
    .single()

  if (!(conn as DbRow | null)?.is_enabled) {
    return { error: 'Enable WhatsApp first before sending a test message.' }
  }

  const result = await sendWhatsAppTextMessage(
    to,
    'This is a test message from your Helios AI WhatsApp integration. ✅',
  )

  if (!result.ok) return { error: result.error ?? 'Failed to send test message.' }
  return { success: 'Test message sent. Check your WhatsApp.' }
}
