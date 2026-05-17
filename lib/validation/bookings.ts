import { z } from 'zod'

export const ownerConfirmBookingSchema = z.object({
  booking_id: z.string().uuid(),
})

export const ownerRejectBookingSchema = z.object({
  booking_id: z.string().uuid(),
  reason:     z.string().max(512).optional(),
})
