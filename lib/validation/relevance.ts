import { z } from 'zod'

const uuid = z.string().uuid()

// ── Run an agent ──────────────────────────────────────────────────

export const relevanceAgentRunSchema = z.object({
  agent_id:      uuid,
  input_summary: z.string().trim().min(1).max(1000).optional(),
  context:       z.record(z.string().max(500)).optional(),
})

// ── Run a workforce ───────────────────────────────────────────────

export const relevanceWorkforceRunSchema = z.object({
  workforce_id:  uuid,
  input_summary: z.string().trim().min(1).max(1000).optional(),
  context:       z.record(z.string().max(500)).optional(),
})

// ── Run status ────────────────────────────────────────────────────

export const relevanceRunStatusSchema = z.object({
  run_id: uuid,
})

// ── Output / recommendation status updates ────────────────────────

export const outputStatusSchema = z.object({
  output_id: uuid,
  status:    z.enum(['pending_review', 'approved', 'rejected', 'archived']),
})

export const recommendationStatusSchema = z.object({
  recommendation_id: uuid,
  status:            z.enum(['pending', 'approved', 'rejected', 'completed']),
})

// ── Agent mapping (dashboard admin) ──────────────────────────────

export const relevanceAgentMappingSchema = z.object({
  agent_id:           uuid,
  relevance_agent_id: z.string().trim().min(1).max(200),
})

export const relevanceWorkforceMappingSchema = z.object({
  workforce_id:            uuid,
  relevance_workforce_id:  z.string().trim().min(1).max(200),
})

// ── Webhook ───────────────────────────────────────────────────────

export const relevanceWebhookSchema = z.object({
  job_id:      z.string().max(200),
  studio_id:   z.string().max(200).optional(),
  status:      z.string().max(50),
  output:      z.record(z.unknown()).optional(),
  error:       z.string().max(1000).optional(),
  metadata:    z.record(z.unknown()).optional(),
})

// ── Exported types ────────────────────────────────────────────────

export type AgentRunInput            = z.infer<typeof relevanceAgentRunSchema>
export type WorkforceRunInput        = z.infer<typeof relevanceWorkforceRunSchema>
export type OutputStatusInput        = z.infer<typeof outputStatusSchema>
export type RecommendationStatusInput = z.infer<typeof recommendationStatusSchema>
