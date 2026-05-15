// ── Plan limit enforcement — server-only ─────────────────────────
// Never trust business_id from client input.
// Always derive it from the authenticated user session.

import { getPlanLimits } from './plans'

type DbClient = ReturnType<typeof import('@/lib/supabase/server').createServiceRoleClient>

// ── Current period start (1st of current month UTC) ───────────────
function currentMonthStart(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
}

// ── Fetch subscription row ─────────────────────────────────────────
export async function getBusinessPlan(
  db:         DbClient,
  businessId: string,
): Promise<string> {
  const { data } = await db
    .from('subscriptions')
    .select('plan, status')
    .eq('business_id', businessId)
    .single()

  const sub = data as { plan: string; status: string } | null
  if (!sub) return 'starter' // default — local/demo safe
  if (sub.status === 'active' || sub.status === 'trialing') return sub.plan
  return 'starter' // downgrade to starter for past_due, cancelled, etc.
}

// ── Monthly usage for a specific event type ────────────────────────
export async function getMonthlyUsage(
  db:         DbClient,
  businessId: string,
  eventType:  string,
): Promise<number> {
  const { count } = await db
    .from('usage_events')
    .select('*', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('event_type', eventType)
    .gte('created_at', currentMonthStart())

  return count ?? 0
}

// ── Full usage summary ────────────────────────────────────────────
export interface UsageSummary {
  ai_conversations: number
  leads:            number
  bookings:         number
}

export async function getBusinessUsage(
  db:         DbClient,
  businessId: string,
): Promise<UsageSummary> {
  const monthStart = currentMonthStart()

  const { data } = await db
    .from('usage_events')
    .select('event_type')
    .eq('business_id', businessId)
    .gte('created_at', monthStart)

  const rows = (data ?? []) as { event_type: string }[]
  return {
    ai_conversations: rows.filter((r) => r.event_type === 'ai_conversation').length,
    leads:            rows.filter((r) => r.event_type === 'lead_created').length,
    bookings:         rows.filter((r) => r.event_type === 'booking_created').length,
  }
}

// ── Limit check helpers ────────────────────────────────────────────

export interface LimitCheckResult {
  allowed: boolean
  plan:    string
  used:    number
  limit:   number
}

export async function checkLimit(
  db:         DbClient,
  businessId: string,
  eventType:  'ai_conversation' | 'lead_created' | 'booking_created',
): Promise<LimitCheckResult> {
  const plan   = await getBusinessPlan(db, businessId)
  const limits = getPlanLimits(plan)

  const limitMap: Record<string, number> = {
    ai_conversation: limits.ai_conversations_month,
    lead_created:    limits.leads_month,
    booking_created: limits.bookings_month,
  }

  const limit = limitMap[eventType] ?? Infinity
  const used  = await getMonthlyUsage(db, businessId, eventType)

  return { allowed: used < limit, plan, used, limit }
}

// ── Track usage (fire-and-forget) ─────────────────────────────────
export async function trackUsage(
  db:         DbClient,
  businessId: string,
  eventType:  'ai_conversation' | 'lead_created' | 'booking_created' | 'widget_message',
  metadata:   Record<string, unknown> = {},
): Promise<void> {
  try {
    await db.from('usage_events').insert({ business_id: businessId, event_type: eventType, metadata })
  } catch (err) {
    console.error('[usage] trackUsage error:', err instanceof Error ? err.message : err)
  }
}
