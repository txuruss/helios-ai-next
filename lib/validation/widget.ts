import { z } from 'zod'

// ── Widget config request (public route) ─────────────────────────

export const widgetConfigRequestSchema = z.object({
  widget_id: z
    .string()
    .min(4, 'Invalid widget_id.')
    .max(80, 'Invalid widget_id.')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid widget_id format.'),
})

// ── Widget settings update (authenticated dashboard) ─────────────

export const widgetSettingsUpdateSchema = z.object({
  primary_color:    z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color.'),
  bot_name:         z.string().trim().min(1).max(80),
  welcome_message:  z.string().trim().min(1).max(300),
  placeholder_text: z.string().trim().min(1).max(100),
  position:         z.enum(['bottom-right', 'bottom-left']),
  is_enabled:       z.boolean(),
  logo_url:         z.string().url().max(500).optional().or(z.literal('')),
})

// ── Widget ID regeneration (authenticated dashboard) ─────────────

export const widgetIdRegenSchema = z.object({
  confirm: z.literal('regenerate'),
})

export type WidgetConfigRequest    = z.infer<typeof widgetConfigRequestSchema>
export type WidgetSettingsUpdate   = z.infer<typeof widgetSettingsUpdateSchema>
