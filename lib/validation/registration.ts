// ── Pass 34: Public audit / business-registration form validation ──
//
// Validation for the intake submitted by the public /audit and
// /register-business forms. Output maps directly to the
// `public.audit_submissions` table (migration 20260520120000).
//
// Design notes:
//   • Only business_name is hard-required, matching the table NOT NULL.
//     Every other field is optional — the form's own `required` attrs
//     still gate the UX, but the action is tolerant so partial intake
//     is never silently dropped.
//   • Empty-string form inputs are accepted via `.or(z.literal(''))`
//     and normalized to null at insert time (in the action).
//   • Free-text fields have safe maximum lengths to prevent abuse.
//   • Numeric fields stay coerce-numbers so the existing form
//     (which uses <input type="number">) still works without changes;
//     they are converted to text at insert time to match the table.

import { z } from 'zod'

const CHANNEL_VALUES = ['website', 'whatsapp', 'instagram', 'facebook', 'sms', 'email', 'phone'] as const

export const businessRegistrationSchema = z.object({
  // ── Required ────────────────────────────────────────────────────
  business_name:    z.string().min(2, 'Business name is required.').max(200),

  // ── Contact ─────────────────────────────────────────────────────
  contact_name:     z.string().max(200).optional().or(z.literal('')),
  contact_email:    z.string().email('A valid email is required.').max(320).optional().or(z.literal('')),
  phone:            z.string().max(40).optional().or(z.literal('')),

  // ── Identity / location ────────────────────────────────────────
  industry:         z.string().max(120).optional().or(z.literal('')),
  business_type:    z.string().max(120).optional().or(z.literal('')),
  city:             z.string().max(120).optional().or(z.literal('')),
  country:          z.string().max(120).optional().or(z.literal('')),
  location:         z.string().max(240).optional().or(z.literal('')),

  // ── Online presence ────────────────────────────────────────────
  website:          z.string().url('Website must be a valid URL.').max(500).optional().or(z.literal('')),
  instagram:        z.string().max(200).optional().or(z.literal('')),
  facebook:         z.string().max(200).optional().or(z.literal('')),
  whatsapp:         z.string().max(40).optional().or(z.literal('')),

  // ── Operations ─────────────────────────────────────────────────
  current_booking:  z.string().max(200).optional().or(z.literal('')),
  monthly_leads:    z.coerce.number().int().min(0).max(1_000_000).optional(),
  biggest_problem:  z.string().max(2000).optional().or(z.literal('')),

  // ── Services & hours ───────────────────────────────────────────
  services:         z.array(z.string().max(200)).max(50).default([]),
  business_hours:   z.string().max(500).optional().or(z.literal('')),
  team_size:        z.coerce.number().int().min(0).max(10_000).optional(),

  // ── Tools / channels ───────────────────────────────────────────
  existing_software:  z.string().max(200).optional().or(z.literal('')),
  preferred_channels: z.array(z.enum(CHANNEL_VALUES)).max(10).default([]),

  // ── Plan ───────────────────────────────────────────────────────
  selected_plan:    z.string().max(50).optional().or(z.literal('')),

  // ── Internal triage hints (rarely supplied by the public form) ──
  notes:            z.string().max(2000).optional().or(z.literal('')),
})

export type BusinessRegistrationInput = z.input<typeof businessRegistrationSchema>
export type BusinessRegistrationData  = z.infer<typeof businessRegistrationSchema>
