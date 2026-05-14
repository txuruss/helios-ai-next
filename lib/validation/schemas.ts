import { z } from 'zod'

export const loginSchema = z.object({
  email:    z.string().email('Enter a valid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
})

export const signupSchema = loginSchema.extend({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters.')
    .max(80, 'Name is too long.')
    .trim(),
})

export const businessSchema = z.object({
  name:                      z.string().min(2).max(120).trim(),
  description:               z.string().max(1000).optional(),
  website_url:               z.string().url().optional().or(z.literal('')),
  phone:                     z.string().max(30).optional(),
  address:                   z.string().max(200).optional(),
  city:                      z.string().max(80).optional(),
  country:                   z.string().max(80).default('Jamaica'),
  business_type:             z.string().max(60).optional(),
  owner_notification_email:  z.string().email().optional().or(z.literal('')),
})

export const serviceSchema = z.object({
  name:         z.string().min(1).max(120).trim(),
  description:  z.string().max(500).optional(),
  price_cents:  z.coerce.number().int().min(0).optional(),
  duration_min: z.coerce.number().int().min(5).max(480).optional(),
  is_active:    z.boolean().default(true),
})

export const faqSchema = z.object({
  question: z.string().min(3).max(300).trim(),
  answer:   z.string().min(3).max(2000).trim(),
  is_active: z.boolean().default(true),
})

export const agentSettingsSchema = z.object({
  agent_name:      z.string().min(1).max(80).trim(),
  persona_prompt:  z.string().max(4000).optional(),
  collect_name:    z.boolean().default(true),
  collect_email:   z.boolean().default(true),
  collect_phone:   z.boolean().default(false),
})

export const widgetSettingsSchema = z.object({
  primary_color:    z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color.'),
  bot_name:         z.string().min(1).max(80).trim(),
  welcome_message:  z.string().min(1).max(300).trim(),
  placeholder_text: z.string().min(1).max(100).trim(),
  position:         z.enum(['bottom-right', 'bottom-left']),
  is_enabled:       z.boolean(),
})

export type LoginInput          = z.infer<typeof loginSchema>
export type SignupInput         = z.infer<typeof signupSchema>
export type BusinessInput       = z.infer<typeof businessSchema>
export type ServiceInput        = z.infer<typeof serviceSchema>
export type FAQInput            = z.infer<typeof faqSchema>
export type AgentSettingsInput  = z.infer<typeof agentSettingsSchema>
export type WidgetSettingsInput = z.infer<typeof widgetSettingsSchema>
