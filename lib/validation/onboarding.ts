import { z } from 'zod'

const MAX_NOTES = 4000
const MAX_TEXT  = 256
const MAX_URL   = 512
const MAX_PHONE = 64

export const ONBOARDING_STATUS = ['draft', 'submitted', 'in_review', 'approved', 'needs_changes'] as const
export type OnboardingStatus = typeof ONBOARDING_STATUS[number]

export const saveOnboardingDraftSchema = z.object({
  owner_name:              z.string().max(MAX_TEXT).optional(),
  owner_email:             z.string().email().max(MAX_TEXT).optional().or(z.literal('')),
  owner_phone:             z.string().max(MAX_PHONE).optional(),
  business_name:           z.string().max(MAX_TEXT).optional(),
  business_type:           z.string().max(MAX_TEXT).optional(),
  city:                    z.string().max(MAX_TEXT).optional(),
  country:                 z.string().max(MAX_TEXT).optional(),
  website_url:             z.string().url().max(MAX_URL).optional().or(z.literal('')),
  instagram_url:           z.string().url().max(MAX_URL).optional().or(z.literal('')),
  facebook_url:            z.string().url().max(MAX_URL).optional().or(z.literal('')),
  whatsapp_number:         z.string().max(MAX_PHONE).optional(),
  services_notes:          z.string().max(MAX_NOTES).optional(),
  faq_notes:               z.string().max(MAX_NOTES).optional(),
  booking_rules_notes:     z.string().max(MAX_NOTES).optional(),
  brand_notes:             z.string().max(MAX_NOTES).optional(),
  ai_persona_notes:        z.string().max(MAX_NOTES).optional(),
  notification_preferences: z.string().max(MAX_NOTES).optional(),
  launch_notes:            z.string().max(MAX_NOTES).optional(),
})

export const submitOnboardingIntakeSchema = saveOnboardingDraftSchema.extend({
  business_name: z.string().min(1).max(MAX_TEXT),
  owner_name:    z.string().min(1).max(MAX_TEXT),
})

export const updateOnboardingStatusSchema = z.object({
  status: z.enum(ONBOARDING_STATUS),
})

export type SaveOnboardingDraftInput = z.infer<typeof saveOnboardingDraftSchema>
