import { z } from 'zod'

export const VALID_PLAN_IDS = ['starter', 'pro', 'scale'] as const

export const checkoutSessionSchema = z.object({
  plan_id: z.enum(VALID_PLAN_IDS, { errorMap: () => ({ message: 'Invalid plan.' }) }),
})

export const customerPortalSchema = z.object({
  return_url: z.string().url().optional(),
})

export const planChangeSchema = z.object({
  new_plan_id: z.enum(VALID_PLAN_IDS),
})

export type CheckoutSessionInput = z.infer<typeof checkoutSessionSchema>
export type CustomerPortalInput  = z.infer<typeof customerPortalSchema>
