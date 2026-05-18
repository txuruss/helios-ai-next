import { z } from 'zod'
import type { NicheTemplateKey } from '@/lib/templates/niche-templates'

export const TEMPLATE_KEYS = [
  'barbershop','hair_salon','beauty_spa',
  'clinic','cleaning_company','auto_repair','tutor',
] as const

export const APPLY_MODES = ['preview','append','fill_missing','replace_demo_only'] as const
export type ApplyMode = typeof APPLY_MODES[number]

export const templateKeySchema = z.enum(TEMPLATE_KEYS)

export const applyNicheTemplateSchema = z.object({
  template_key:      z.enum(TEMPLATE_KEYS),
  apply_mode:        z.enum(APPLY_MODES).default('append'),
  confirm_overwrite: z.boolean().optional().default(false),
})

export const previewNicheTemplateSchema = z.object({
  template_key: z.enum(TEMPLATE_KEYS),
})

export type ApplyNicheTemplateInput = z.input<typeof applyNicheTemplateSchema>
