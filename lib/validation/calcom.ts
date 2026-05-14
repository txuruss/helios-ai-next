import { z } from 'zod'

// ── Common ────────────────────────────────────────────────────────

const uuid = z.string().uuid()
const isoDateTime = z
  .string()
  .min(10)
  .max(64)
  .refine((v) => !isNaN(Date.parse(v)), { message: 'Must be a valid ISO date-time.' })

// ── Dashboard schemas (authenticated, server-side derived business_id) ──

export const eventTypeSyncSchema = z.object({
  // business_id is derived from the session — not accepted from the client
})

export const serviceEventMappingSchema = z.object({
  service_id:            uuid,
  calcom_event_type_id:  uuid,   // our internal UUID, not the Cal.com integer
})

export const deleteServiceEventMappingSchema = z.object({
  mapping_id: uuid,
})

// ── Public-safe schemas (API routes without auth) ─────────────────

export const availabilityRequestSchema = z.object({
  business_id:  uuid,
  service_id:   uuid,
  start:        isoDateTime,
  end:          isoDateTime,
  timezone:     z.string().max(60).optional(),
})

export const bookingRequestSchema = z.object({
  business_id:   uuid,
  service_id:    uuid,
  lead_id:       uuid.optional(),
  name:          z.string().trim().min(1, 'Name is required.').max(120),
  email:         z.string().email('Valid email required.').max(200),
  phone:         z.string().max(30).optional(),
  selected_time: isoDateTime,
  timezone:      z.string().max(60).optional(),
  notes:         z.string().max(1000).trim().optional(),
})

// ── Webhook ───────────────────────────────────────────────────────

const CALCOM_TRIGGER_EVENTS = [
  'BOOKING_CREATED',
  'BOOKING_RESCHEDULED',
  'BOOKING_CANCELLED',
  'BOOKING_CONFIRMED',
  'BOOKING_REJECTED',
] as const

export const calcomWebhookSchema = z.object({
  triggerEvent: z.enum(CALCOM_TRIGGER_EVENTS),
  createdAt:    z.string().optional(),
  payload: z.object({
    uid:       z.string().optional(),
    id:        z.number().optional(),
    status:    z.string().optional(),
    title:     z.string().optional(),
    startTime: z.string().optional(),
    endTime:   z.string().optional(),
    attendees: z.array(z.object({
      email: z.string().optional(),
      name:  z.string().optional(),
    })).optional(),
  }).passthrough(),
})

// ── Exported types ────────────────────────────────────────────────

export type AvailabilityRequest       = z.infer<typeof availabilityRequestSchema>
export type BookingRequest            = z.infer<typeof bookingRequestSchema>
export type ServiceEventMappingInput  = z.infer<typeof serviceEventMappingSchema>
export type CalcomWebhookPayload      = z.infer<typeof calcomWebhookSchema>
