import { z } from 'zod'

// ── Allowlist of valid widget events ─────────────────────────────
const WIDGET_EVENTS = [
  'widget_loaded',
  'widget_opened',
  'widget_message_sent',
  'widget_error',
] as const

// ── Widget analytics event (public route) ────────────────────────
// Strict — rejects anything not on the allowlist.
// Never accept message content, emails, phones, or arbitrary metadata.

export const widgetAnalyticsEventSchema = z.object({
  widget_id: z
    .string()
    .min(4)
    .max(80)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid widget_id.'),

  event: z.enum(WIDGET_EVENTS, {
    errorMap: () => ({ message: 'Invalid event name.' }),
  }),

  // Only these safe metadata fields are accepted — all others are dropped
  metadata: z
    .object({
      page_origin: z.string().url().max(200).optional(),
      session_hash: z.string().max(32).regex(/^[a-f0-9]+$/).optional(),
      timestamp:    z.string().max(40).optional(),
    })
    .optional()
    .default({}),
})

export type WidgetAnalyticsEvent = z.infer<typeof widgetAnalyticsEventSchema>
export type WidgetEventName      = (typeof WIDGET_EVENTS)[number]
