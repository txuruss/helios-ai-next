import { z } from 'zod'

// ── GET webhook verification ──────────────────────────────────────

export const whatsappWebhookVerifySchema = z.object({
  'hub.mode':         z.literal('subscribe'),
  'hub.verify_token': z.string().min(1).max(256),
  'hub.challenge':    z.string().min(1).max(256),
})

// ── POST webhook payload ──────────────────────────────────────────

const whatsappContactSchema = z.object({
  profile: z.object({ name: z.string().max(200) }).optional(),
  wa_id:   z.string().max(30),
})

const whatsappTextMessageSchema = z.object({
  id:        z.string().max(256),
  from:      z.string().max(30),
  timestamp: z.string().max(30),
  type:      z.string().max(32),
  text:      z.object({ body: z.string().min(1).max(4096) }).optional(),
})

const whatsappValueSchema = z.object({
  messaging_product: z.string().max(32),
  metadata: z.object({
    display_phone_number: z.string().max(30),
    phone_number_id:      z.string().max(128),
  }),
  contacts: z.array(whatsappContactSchema).max(10).optional(),
  messages: z.array(whatsappTextMessageSchema).max(10).optional(),
  statuses: z.array(z.unknown()).max(10).optional(),
})

const whatsappChangeSchema = z.object({
  value: whatsappValueSchema,
  field: z.string().max(64),
})

const whatsappEntrySchema = z.object({
  id:      z.string().max(128),
  changes: z.array(whatsappChangeSchema).max(10),
})

export const whatsappWebhookPayloadSchema = z.object({
  object: z.string().max(64),
  entry:  z.array(whatsappEntrySchema).max(20),
})

// ── Dashboard send-message form ───────────────────────────────────

export const whatsappSendMessageSchema = z.object({
  to:      z.string().min(10).max(30).regex(/^\d+$/, 'Phone number must be digits only.'),
  message: z.string().min(1).max(4096),
})

// ── WhatsApp connection settings ──────────────────────────────────

export const whatsappSettingsSchema = z.object({
  is_enabled:           z.boolean(),
  display_phone_number: z.string().max(30).optional(),
  business_account_id:  z.string().max(128).optional(),
})
