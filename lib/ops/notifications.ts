// ── Ops notification routing engine — server-only ─────────────────
// Routes ops events to email or dashboard notifications.
// Fire-and-forget safe — never affects primary flows.

import 'server-only'
import { sendEmail } from '@/lib/resend/client'
import { captureApiError } from '@/lib/logging/api'
import { createServiceRoleClient } from '@/lib/supabase/server'

type DbClient = ReturnType<typeof createServiceRoleClient>
type DbRow    = Record<string, unknown>

export interface NotificationRule {
  id:                string
  business_id:       string | null
  name:              string
  trigger_type:      string
  source:            string | null
  severity:          string | null
  priority:          string | null
  status:            string | null
  channel:           string
  recipient_type:    string
  recipient_user_id: string | null
  recipient_email:   string | null
  delay_minutes:     number
  is_enabled:        boolean
  metadata:          Record<string, unknown>
}

// ── Safe email builder ────────────────────────────────────────────

function buildOpsEmail(params: {
  title:       string
  severity?:   string
  source?:     string
  description: string | null
  dashboardUrl: string
  section:     string
}): { html: string; text: string } {
  const { title, severity, source, description, dashboardUrl, section } = params
  const sectionUrl = `${dashboardUrl}/dashboard/ops?tab=${section}`

  const sevColor =
    severity === 'critical' ? '#ff8a7a' :
    severity === 'error'    ? '#ff8a7a' :
    severity === 'warning'  ? '#ffae3c' :
    '#9a9a9d'

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;background:#0a0a0c;color:#f3f3f3;padding:32px;max-width:600px;margin:0 auto;">
  <div style="background:#0f1012;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px;">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
      <div style="width:36px;height:36px;background:#ff7a18;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px;">⚙</div>
      <span style="font-size:18px;font-weight:600;">Helios AI · Ops Center</span>
    </div>
    <h2 style="margin:0 0 8px;font-size:19px;color:#f3f3f3;">${title}</h2>
    ${severity ? `<div style="display:inline-block;margin-bottom:16px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;color:${sevColor};border:1px solid ${sevColor}33;">${severity}</div>` : ''}
    ${description ? `<p style="color:#9a9a9d;margin:0 0 24px;font-size:14px;line-height:1.6;">${description}</p>` : ''}
    ${source ? `<p style="color:#6a6a6e;font-size:12px;margin:0 0 20px;">Source: ${source}</p>` : ''}
    <a href="${sectionUrl}" style="display:inline-block;padding:12px 24px;background:#ff7a18;color:#1a0c00;font-weight:600;border-radius:10px;text-decoration:none;font-size:14px;">
      Open in Ops Center →
    </a>
    <p style="color:#6a6a6e;font-size:12px;margin-top:24px;">
      This is an automated notification from Helios AI Ops Center. Do not reply to this email.
    </p>
  </div>
</body>
</html>`

  const text = `${title}\n${severity ? `Severity: ${severity}\n` : ''}${source ? `Source: ${source}\n` : ''}${description ? `\n${description}\n` : ''}\nOpen in Ops Center: ${sectionUrl}`

  return { html, text }
}

// ── Resolve recipient ─────────────────────────────────────────────

async function resolveRecipient(
  rule:        NotificationRule,
  businessId:  string,
  assignedTo?: string | null,
  db?:         DbClient,
): Promise<string | null> {
  const client = db ?? createServiceRoleClient()

  if (rule.recipient_type === 'custom_email') return rule.recipient_email ?? null

  if (rule.recipient_type === 'assigned_user' && assignedTo) {
    const { data: profile } = await client
      .from('profiles').select('email').eq('id', assignedTo).single()
    return (profile as DbRow | null)?.email as string | null
  }

  // Default: owner email
  const { data: biz } = await client
    .from('businesses').select('owner_notification_email').eq('id', businessId).single()
  return (biz as DbRow | null)?.owner_notification_email as string | null
}

// ── Route a notification ──────────────────────────────────────────

export async function routeOpsNotification(params: {
  trigger_type: string
  businessId:   string
  title:        string
  severity?:    string
  source?:      string
  description?:  string | null
  section:      string
  assignedTo?:  string | null
  db?:          DbClient
}): Promise<void> {
  const { trigger_type, businessId, title, severity, source, description, section, assignedTo, db } = params
  const client    = db ?? createServiceRoleClient()
  const dashUrl   = process.env.NEXT_PUBLIC_APP_URL ?? 'https://helios.ai'

  try {
    // Load matching rules
    const { data: rules } = await client
      .from('ops_notification_rules')
      .select('*')
      .eq('is_enabled', true)
      .eq('trigger_type', trigger_type)
      .or(`business_id.eq.${businessId},business_id.is.null`)

    const matchingRules = ((rules ?? []) as NotificationRule[]).filter((r) => {
      if (r.source   && r.source   !== source)   return false
      if (r.severity && r.severity !== severity)  return false
      return true
    })

    for (const rule of matchingRules) {
      try {
        if (rule.channel === 'none') continue

        if (rule.channel === 'email') {
          const to = await resolveRecipient(rule, businessId, assignedTo, client)
          if (!to) continue

          const { html, text } = buildOpsEmail({ title, severity, source, description: description ?? null, dashboardUrl: dashUrl, section })
          const subjectLabel =
            severity === 'critical' ? '[Critical] ' :
            severity === 'error'    ? '[Error] '    :
            trigger_type === 'payment_failed' ? '[Urgent] ' : ''

          await sendEmail({ to, subject: `${subjectLabel}${title} — Helios AI Ops`, html, text })
          await client.from('ops_notification_rules').update({ }).eq('id', rule.id).catch(() => undefined) // touch to update

        } else if (rule.channel === 'dashboard') {
          // Create in-app notification
          await client.from('notifications').insert({
            business_id: businessId,
            user_id:     null,
            type:        `ops.${trigger_type}`,
            title,
            body:        description ?? '',
            channel:     'in_app',
            status:      'pending',
            metadata:    { trigger_type, source, severity },
          }).catch(() => undefined)
        }
      } catch { /* silent per-rule */ }
    }

  } catch (err) {
    captureApiError(err, { route: 'ops/notifications', error_type: 'route_notification_error', business_id: businessId })
  }
}

// ── Notify assigned user ──────────────────────────────────────────

export async function notifyAssignedUser(params: {
  userId:      string
  title:       string
  description: string | null
  section:     string
  businessId:  string
  db?:         DbClient
}): Promise<void> {
  const { userId, title, description, section, businessId, db } = params
  const client  = db ?? createServiceRoleClient()
  const dashUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://helios.ai'

  try {
    const { data: profile } = await client
      .from('profiles').select('email').eq('id', userId).single()
    const email = (profile as DbRow | null)?.email as string | null
    if (!email) return

    const { html, text } = buildOpsEmail({ title, description, dashboardUrl: dashUrl, section })
    await sendEmail({ to: email, subject: `Item assigned to you — ${title} | Helios AI`, html, text })
  } catch (err) {
    captureApiError(err, { route: 'ops/notifications', error_type: 'assignment_notification_error', business_id: businessId })
  }
}

// ── Seed default notification rules ──────────────────────────────

const DEFAULT_NOTIFICATION_RULES = [
  { name: 'Critical alert created → email owner', trigger_type: 'alert_created', severity: 'critical', channel: 'email', recipient_type: 'owner', delay_minutes: 0 },
  { name: 'Payment failed → email owner',         trigger_type: 'payment_failed',  source: 'stripe',   channel: 'email', recipient_type: 'owner', delay_minutes: 0 },
  { name: 'Booking failed → email owner',         trigger_type: 'booking_failed',  source: 'calcom',   channel: 'email', recipient_type: 'owner', delay_minutes: 0 },
  { name: 'Handoff requested → email owner',      trigger_type: 'handoff_requested', source: 'whatsapp', channel: 'email', recipient_type: 'owner', delay_minutes: 0 },
  { name: 'Item assigned → email assigned user',  trigger_type: 'item_assigned',   channel: 'email', recipient_type: 'assigned_user', delay_minutes: 0 },
  { name: 'SLA breached → email assigned user',   trigger_type: 'sla_breached',    channel: 'email', recipient_type: 'assigned_user', delay_minutes: 0 },
  { name: 'Escalation → email owner',             trigger_type: 'escalation_created', channel: 'email', recipient_type: 'owner', delay_minutes: 0 },
  { name: 'Approval created → dashboard',         trigger_type: 'approval_created', channel: 'dashboard', recipient_type: 'owner', delay_minutes: 0 },
]

export async function seedDefaultNotificationRules(
  businessId: string,
  db?:        DbClient,
): Promise<{ seeded: number; error: string | null }> {
  const client = db ?? createServiceRoleClient()
  let seeded = 0
  try {
    for (const r of DEFAULT_NOTIFICATION_RULES) {
      const { error } = await client.from('ops_notification_rules').upsert(
        {
          business_id:       businessId,
          name:              r.name,
          trigger_type:      r.trigger_type,
          source:            (r as DbRow).source as string | null ?? null,
          severity:          (r as DbRow).severity as string | null ?? null,
          channel:           r.channel,
          recipient_type:    r.recipient_type,
          delay_minutes:     r.delay_minutes,
          is_enabled:        true,
          metadata:          {},
        },
        { onConflict: 'business_id,name', ignoreDuplicates: true },
      )
      if (!error) seeded++
    }
    return { seeded, error: null }
  } catch (err) {
    captureApiError(err, { route: 'ops/notifications', error_type: 'seed_notifications_error', business_id: businessId })
    return { seeded, error: 'Could not seed notification rules.' }
  }
}

// NotificationRule is the primary export of this module
