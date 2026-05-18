// ── Phase 29: Business-registration form validation ──────────────
// Backend-safe Zod schema. Used by /register-business action and any
// API route accepting registration data.

import { z } from 'zod'

const CHANNEL_VALUES = ['website', 'whatsapp', 'instagram', 'facebook', 'sms', 'email', 'phone'] as const

export const businessRegistrationSchema = z.object({
  // Identity
  business_name:    z.string().min(2, 'Business name is required.').max(120),
  industry:         z.string().min(2, 'Industry is required.').max(80),
  city:             z.string().min(2, 'City is required.').max(80),
  country:          z.string().min(2).max(80).default('Jamaica'),

  // Online presence
  website:          z.string().url('Website must be a valid URL.').max(240).optional().or(z.literal('')),
  instagram:        z.string().max(120).optional().or(z.literal('')),
  facebook:         z.string().max(120).optional().or(z.literal('')),
  whatsapp:         z.string().max(40).optional().or(z.literal('')),

  // Operations
  current_booking:  z.string().min(2, 'Tell us how customers book today.').max(120),
  monthly_leads:    z.coerce.number().int().min(0).max(100000),
  biggest_problem:  z.string().min(10, 'Help us understand the biggest issue.').max(600),

  // Services + hours
  services:         z.array(z.string().max(120)).max(40).default([]),
  business_hours:   z.string().max(240).optional().or(z.literal('')),
  team_size:        z.coerce.number().int().min(1).max(1000).default(1),

  // Tools
  existing_software:    z.string().max(160).optional().or(z.literal('')),
  preferred_channels:   z.array(z.enum(CHANNEL_VALUES)).max(7).default([]),

  // Plan
  selected_plan:        z.enum(['starter', 'pro', 'scale']),

  // Optional account email — collected at the registration step
  // Auth-creation itself stays in lib/auth/actions.ts.
  contact_email:        z.string().email('A valid email is required.').max(160),
  contact_name:         z.string().min(2, 'Your name is required.').max(120),
})

export type BusinessRegistrationInput = z.input<typeof businessRegistrationSchema>
export type BusinessRegistrationData  = z.infer<typeof businessRegistrationSchema>
