import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { generateAIReply } from '@/lib/ai/respond'
import { isOriginAllowed, getCorsHeaders, type CorsHeaders } from '@/lib/cors'
import { checkChatRateLimit } from '@/lib/rate-limit/chat'
import { logApiEvent, hashIp, type ApiLogEvent } from '@/lib/logging/api'
import { createOpsEvent } from '@/lib/ops/events'

// ── Constants ─────────────────────────────────────────────────────

const MAX_BODY_BYTES = 32 * 1024

// ── Request validation ────────────────────────────────────────────

const messageSchema = z.object({
  role:    z.enum(['user', 'assistant']),
  content: z.string().trim().min(1, 'Message content cannot be empty.').max(2000, 'Message too long.'),
})

const chatRequestSchema = z.object({
  business_id: z.string().uuid('Invalid business_id.'),
  messages:    z
    .array(messageSchema)
    .min(1, 'At least one message is required.')
    .max(50, 'Too many messages in history.'),
  session_id:  z.string().uuid().optional(),
  visitor_id:  z.string().max(100).optional(),
})

// ── Response / IP helpers ─────────────────────────────────────────

function respond(body: object, status: number, cors: CorsHeaders = {}): NextResponse {
  const res = NextResponse.json(body, { status })
  for (const [k, v] of Object.entries(cors)) res.headers.set(k, v)
  return res
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1'
  )
}

// ── OPTIONS (preflight) ───────────────────────────────────────────

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin')
  if (!isOriginAllowed(origin)) return new NextResponse(null, { status: 403 })
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(origin) })
}

// ── POST ──────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const t0     = Date.now()
  const origin = request.headers.get('origin')
  const ip     = getClientIp(request)
  const ipHash = hashIp(ip)
  const cors   = getCorsHeaders(origin)
  const originOk = isOriginAllowed(origin)

  const log: Partial<ApiLogEvent> & Pick<ApiLogEvent, 'route' | 'ip_hash' | 'origin' | 'origin_allowed'> = {
    route:          'chat',
    ip_hash:        ipHash,
    origin,
    origin_allowed: originOk,
    rate_limit:     'skipped',
  }

  function finish(status: number, error?: string) {
    logApiEvent({ ...log, status, error_type: error, ms: Date.now() - t0 } as ApiLogEvent)
  }

  // 1. CORS
  if (!originOk && process.env.NODE_ENV === 'production') {
    finish(403, 'cors_blocked')
    return respond({ error: 'Origin not allowed.' }, 403)
  }

  // 2. Env gates
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[chat] ANTHROPIC_API_KEY not configured')
    finish(503, 'missing_anthropic_key')
    return respond({ error: 'AI service not configured. Contact the site administrator.' }, 503, cors)
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[chat] SUPABASE_SERVICE_ROLE_KEY not configured')
    finish(503, 'missing_service_key')
    return respond({ error: 'Service not configured. Contact the site administrator.' }, 503, cors)
  }

  // 3. Body size
  let rawBody: string
  try { rawBody = await request.text() } catch {
    finish(400, 'body_read_error')
    return respond({ error: 'Could not read request body.' }, 400, cors)
  }

  const bodyBytes = Buffer.byteLength(rawBody, 'utf8')
  log.body_size_bytes = bodyBytes
  if (bodyBytes > MAX_BODY_BYTES) {
    finish(413, 'body_too_large')
    return respond({ error: 'Request is too large.' }, 413, cors)
  }

  // 4. JSON parse
  let body: unknown
  try { body = JSON.parse(rawBody) } catch {
    finish(400, 'invalid_json')
    return respond({ error: 'Invalid JSON body.' }, 400, cors)
  }

  // 5. Schema validation
  const parsed = chatRequestSchema.safeParse(body)
  if (!parsed.success) {
    const msg = parsed.error.errors[0]?.message ?? 'Invalid request.'
    finish(400, 'validation_failed')
    return respond({ error: msg }, 400, cors)
  }

  const { business_id, messages, session_id, visitor_id } = parsed.data
  log.business_id = business_id
  if (session_id) log.session_id = session_id
  log.input_chars  = messages.reduce((n, m) => n + m.content.length, 0)

  // 6. Rate limiting
  let rlResult: Awaited<ReturnType<typeof checkChatRateLimit>>
  try {
    rlResult = await checkChatRateLimit({ ip, businessId: business_id, sessionId: session_id })
  } catch (err) {
    console.error('[chat] Rate limit check failed:', err instanceof Error ? err.message : err)
    rlResult = { allowed: true, limit: 0, remaining: 0, reset: 0 }
  }

  if (!rlResult.allowed) {
    log.rate_limit = `blocked_${rlResult.reason}` as ApiLogEvent['rate_limit']
    finish(429, 'rate_limited')
    const res = respond({ error: 'Too many requests. Please wait and try again.' }, 429, cors)
    res.headers.set('Retry-After', String(Math.ceil((rlResult.reset - Date.now()) / 1000)))
    return res
  }
  log.rate_limit = rlResult.limit > 0 ? 'allowed' : 'skipped'

  // 7. Run shared AI engine
  const db     = createServiceRoleClient()
  const result = await generateAIReply({
    businessId:        business_id,
    channel:           'widget',
    messages,
    db,
    existingSessionId: session_id ?? null,
    visitorId:         visitor_id ?? null,
  })

  if (!result.ok) {
    const errCode = result.errorCode
    if (errCode === 'plan_limit') {
      void createOpsEvent({ source: 'chat', event_type: 'plan_limit_reached', severity: 'warning', title: 'Chat plan limit reached', business_id: business_id })
      finish(402, 'plan_limit_ai')
      return respond({ error: result.error ?? 'Plan limit reached.' }, 402, cors)
    }
    if (errCode === 'business_not_found') {
      finish(404, 'business_not_found')
      return respond({ error: 'Business not found.' }, 404, cors)
    }
    if (errCode === 'widget_disabled') {
      finish(403, 'widget_disabled')
      return respond({ error: 'Chat is currently disabled.' }, 403, cors)
    }
    if (errCode === 'ai_empty' || errCode === 'anthropic_error') {
      void createOpsEvent({ source: 'chat', event_type: 'ai_error', severity: 'error', title: 'Chat AI response error', business_id: business_id, metadata: { code: errCode } })
      finish(500, errCode === 'ai_empty' ? 'empty_ai_response' : 'anthropic_error')
      return respond({ error: result.error ?? 'Failed to generate a response.' }, 500, cors)
    }
    finish(500, 'anthropic_error')
    return respond({ error: result.error ?? 'Failed to generate a response.' }, 500, cors)
  }

  // Log new lead creation
  if (result.leadCreated && result.leadId) {
    void createOpsEvent({ source: 'chat', event_type: 'lead_created', severity: 'info', title: 'New lead captured via chat', business_id, related_table: 'leads', related_id: result.leadId })
  }

  if (result.sessionId) log.session_id  = result.sessionId
  log.output_chars = result.reply?.length ?? 0
  finish(200)

  return respond(
    {
      reply:              result.reply,
      session_id:         result.sessionId,
      lead_id:            result.leadId,
      calcom_booking_uid: result.calcomBookingUid,
    },
    200,
    cors,
  )
}
