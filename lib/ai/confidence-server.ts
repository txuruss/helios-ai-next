// ── AI Confidence persistence — server-only ───────────────────────
// Stores AI confidence to chat_sessions and creates review approvals.
// Import from server routes only — never from client components.

import 'server-only'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { captureApiError } from '@/lib/logging/api'
import { capture } from '@/lib/analytics/posthog'
import type { AiConfidence } from './confidence'

type DbClient = ReturnType<typeof createServiceRoleClient>

// ── Persist confidence to chat_sessions ───────────────────────────

export async function storeAiConfidence(params: {
  sessionId:      string
  businessId:     string
  confidence:     AiConfidence
  reason:         string
  requiresReview: boolean
  db?:            DbClient
}): Promise<void> {
  const client = params.db ?? createServiceRoleClient()
  const now    = new Date().toISOString()

  try {
    await client.from('chat_sessions').update({
      ai_confidence:                 params.confidence,
      ai_review_required:            params.requiresReview,
      last_confidence_reason:        params.reason,
      last_ai_confidence_updated_at: now,
      last_ai_response_at:           now,
    }).eq('id', params.sessionId).eq('business_id', params.businessId)

    if (params.requiresReview) {
      await createAiReviewApproval({
        sessionId:  params.sessionId,
        businessId: params.businessId,
        reason:     params.reason,
        db:         client,
      })
    }

    capture('ai_confidence_stored', { confidence: params.confidence })
  } catch (err) {
    captureApiError(err, { route: 'ai/confidence', error_type: 'confidence_store_error', business_id: params.businessId })
  }
}

// ── Auto-create approval item for AI review ───────────────────────

async function createAiReviewApproval(params: {
  sessionId:  string
  businessId: string
  reason:     string
  db:         DbClient
}): Promise<void> {
  try {
    // Deduplicate — don't create another approval if one already exists for this session
    const { count } = await params.db.from('approval_items')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', params.businessId)
      .eq('approval_type', 'ai_review')
      .eq('status', 'pending')
      .contains('metadata', { source_session_id: params.sessionId })

    if ((count ?? 0) > 0) return

    const { data: approvalRow } = await params.db.from('approval_items').insert({
      business_id:       params.businessId,
      approval_type:     'ai_review',
      title:             'AI reply needs review',
      description:       'A conversation was flagged for human review due to uncertainty.',
      content:           null, // never store customer message content
      priority:          'normal',
      status:            'pending',
      source_session_id: params.sessionId,
      review_reason:     params.reason.slice(0, 256),
      metadata:          { source_session_id: params.sessionId },
    }).select('id').single()

    if (approvalRow) {
      const approvalId = (approvalRow as { id: string }).id

      await params.db.from('chat_sessions').update({
        ai_review_approval_id: approvalId,
      }).eq('id', params.sessionId)

      void import('@/lib/ops/events').then(({ createOpsEvent }) =>
        createOpsEvent({
          business_id: params.businessId,
          source:      'chat',
          event_type:  'ai_review_required',
          severity:    'warning',
          title:       'AI reply flagged for review',
          metadata:    { session_id: params.sessionId },
        }, params.db)
      ).catch(() => undefined)

      capture('ai_review_approval_created', { reason: params.reason })
    }
  } catch (err) {
    captureApiError(err, { route: 'ai/confidence', error_type: 'review_approval_error', business_id: params.businessId })
  }
}
