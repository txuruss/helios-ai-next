// ── Safe analytics event helpers ─────────────────────────────────
// Privacy rules enforced here:
// - No full names, emails, or phone numbers
// - No customer message content
// - No API keys or tokens
// - Only business_id prefix (8 chars), plan, route, counts
// - All captures are fire-and-forget (never block user flows)

import { capture } from './posthog'
import * as Sentry from '@sentry/nextjs'

// ── Safe business_id — first 8 chars only ────────────────────────

function safeBizId(id: string | null | undefined): string {
  return id ? id.slice(0, 8) : 'none'
}

// ── Dashboard events ──────────────────────────────────────────────

export function trackDashboard(route: string, plan?: string) {
  capture('dashboard_viewed', { route, plan: plan ?? 'unknown' })
}

export function trackBusinessProfileSaved(bizId: string, plan: string) {
  capture('business_profile_updated', { business_id: safeBizId(bizId), plan })
}

export function trackServiceEvent(action: 'created' | 'updated' | 'deleted', bizId: string, plan: string) {
  capture(`service_${action}`, { business_id: safeBizId(bizId), plan })
}

export function trackFaqEvent(action: 'created' | 'updated' | 'deleted', bizId: string, plan: string) {
  capture(`faq_${action}`, { business_id: safeBizId(bizId), plan })
}

export function trackWidgetSettingsSaved(bizId: string, plan: string, showPoweredBy: boolean) {
  capture('widget_settings_updated', { business_id: safeBizId(bizId), plan, show_powered_by: showPoweredBy })
}

export function trackEmbedCopied(widgetId: string, plan: string) {
  capture('widget_embed_copied', { widget_id: widgetId.slice(0, 12), plan })
}

export function trackTestChatSent(bizId: string) {
  capture('chat_message_sent', { business_id: safeBizId(bizId), source: 'dashboard_test' })
}

// ── Cal.com events ────────────────────────────────────────────────

export function trackCalcomSync(bizId: string, count: number) {
  capture('calcom_event_types_synced', { business_id: safeBizId(bizId), count })
}

export function trackServiceMapped(bizId: string) {
  capture('service_event_mapped', { business_id: safeBizId(bizId) })
}

// ── Billing events ────────────────────────────────────────────────

export function trackBillingPageViewed(bizId: string, plan: string) {
  capture('billing_page_viewed', { business_id: safeBizId(bizId), plan })
}

export function trackCheckoutStarted(bizId: string, targetPlan: string) {
  capture('checkout_started', { business_id: safeBizId(bizId), target_plan: targetPlan })
}

export function trackPortalOpened(bizId: string) {
  capture('billing_portal_opened', { business_id: safeBizId(bizId) })
}

export function trackPlanLimitReached(
  bizId: string,
  plan: string,
  feature: string,
  used: number,
  limit: number,
) {
  capture('plan_limit_reached', { business_id: safeBizId(bizId), plan, feature, used, limit })
}

// ── Auth events ───────────────────────────────────────────────────

export function trackSignIn() {
  capture('user_signed_in')
}

export function trackSignUp() {
  capture('user_signed_up')
}

// ── Widget events (public) ────────────────────────────────────────

export function trackWidgetLoaded(widgetId: string) {
  capture('widget_loaded', { widget_id: widgetId.slice(0, 12) })
}

export function trackWidgetMessage(widgetId: string) {
  capture('widget_message_sent', { widget_id: widgetId.slice(0, 12) })
}

// ── Sentry helpers ────────────────────────────────────────────────

interface SentryContext {
  route?:        string
  feature?:      string
  error_type?:   string
  business_id?:  string   // truncated before sending
}

/**
 * Safely capture an error in Sentry with sanitised context.
 * Never sends API keys, message content, or full IDs.
 */
export function captureApiError(err: unknown, ctx: SentryContext): void {
  try {
    Sentry.captureException(err, {
      tags: {
        route:      ctx.route,
        feature:    ctx.feature,
        error_type: ctx.error_type,
      },
      extra: {
        // Only first 8 chars of business_id — not a secret but good practice
        business_id_prefix: ctx.business_id?.slice(0, 8),
      },
    })
  } catch {
    // Sentry failures must never affect the application
  }
}
