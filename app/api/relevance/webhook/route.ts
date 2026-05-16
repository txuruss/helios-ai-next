import { NextResponse, type NextRequest } from 'next/server'
import { createHmac } from 'crypto'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { relevanceWebhookSchema } from '@/lib/validation/relevance'
import { captureApiError } from '@/lib/logging/api'
import { createOpsEvent, createApprovalItem } from '@/lib/ops/events'

const MAX_BODY_BYTES = 64 * 1024

function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.RELEVANCE_WEBHOOK_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[relevance/webhook] RELEVANCE_WEBHOOK_SECRET not set — rejecting in production')
      return false
    }
    return true // dev only
  }
  if (!signature) return false
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
  return signature === expected || signature === `sha256=${expected}`
}

// POST /api/relevance/webhook
// Receives Relevance AI run completion callbacks.

export async function POST(request: NextRequest) {
  const rawBody = await request.text().catch(() => '')
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large.' }, { status: 413 })
  }

  const sig = request.headers.get('x-relevance-signature') ?? request.headers.get('x-webhook-signature')
  if (!verifySignature(rawBody, sig)) {
    console.error('[relevance/webhook] Signature verification failed')
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  let body: unknown
  try { body = JSON.parse(rawBody) } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const parsed = relevanceWebhookSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: true, message: 'Event not handled.' })
  }

  const { job_id, status, output, error: errMsg } = parsed.data
  const db = createServiceRoleClient()

  try {
    // Find the run by provider_run_id
    const { data: run } = await db
      .from('agent_runs')
      .select('id, business_id')
      .eq('provider_run_id', job_id)
      .single()

    if (!run) {
      console.warn('[relevance/webhook] Run not found for job_id:', job_id)
      return NextResponse.json({ ok: true })
    }

    const runRow = run as { id: string; business_id: string }
    const newStatus = status === 'complete' ? 'completed' : status === 'failed' ? 'failed' : 'running'

    await db.from('agent_runs').update({
      status:         newStatus,
      output_summary: output ? JSON.stringify(output).slice(0, 500) : undefined,
      error_message:  errMsg ?? null,
      completed_at:   ['completed', 'failed'].includes(newStatus) ? new Date().toISOString() : undefined,
    }).eq('id', runRow.id)

    // Save output when complete
    if (newStatus === 'completed' && output) {
      await db.from('agent_outputs').insert({
        business_id:  runRow.business_id,
        agent_run_id: runRow.id,
        output_type:  'json',
        title:        'Agent Output',
        content:      JSON.stringify(output, null, 2).slice(0, 10000),
        status:       'pending_review',
      }).catch(() => undefined)

      // Create approval item for agent output review
      void createApprovalItem({
        business_id:   runRow.business_id,
        approval_type: 'agent_output',
        title:         'Agent output ready for review',
        description:   'A Relevance AI agent run completed with output. Review before approving.',
        requested_by:  'relevance',
        related_table: 'agent_runs',
        related_id:    runRow.id,
        priority:      'normal',
        source_table:  'agent_runs',
        source_id:     runRow.id,
        metadata:      {},
      })

      void createOpsEvent({
        business_id:   runRow.business_id,
        source:        'relevance',
        event_type:    'agent_output_ready',
        severity:      'info',
        title:         'Agent output ready for approval',
        related_table: 'agent_runs',
        related_id:    runRow.id,
      })
    }

    // Create ops event for failed runs
    if (newStatus === 'failed') {
      void createOpsEvent({
        business_id:   runRow.business_id,
        source:        'relevance',
        event_type:    'agent_run_failed',
        severity:      'error',
        title:         'Relevance AI agent run failed',
        description:   errMsg ?? undefined,
        related_table: 'agent_runs',
        related_id:    runRow.id,
      })
    }

    // Save log
    await db.from('agent_run_logs').insert({
      business_id:  runRow.business_id,
      agent_run_id: runRow.id,
      level:        newStatus === 'failed' ? 'error' : 'info',
      message:      `Webhook: status=${newStatus}`,
    }).catch(() => undefined)

    // Audit
    await db.from('audit_logs').insert({
      business_id: runRow.business_id,
      user_id:     null,
      action:      `relevance.webhook.${newStatus}`,
      resource:    'agent_runs',
      resource_id: runRow.id,
    }).catch(() => undefined)

    console.log(`[relevance/webhook] Run ${runRow.id} → ${newStatus}`)
  } catch (err) {
    captureApiError(err, { route: '/api/relevance/webhook', error_type: 'webhook_processing_error' })
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
