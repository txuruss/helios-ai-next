import { NextResponse, type NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { widgetAnalyticsEventSchema } from '@/lib/validation/analytics'
import { getPublicCorsHeaders } from '@/lib/cors'
import { checkChatRateLimit } from '@/lib/rate-limit/chat'

const CORS    = getPublicCorsHeaders()
const MAX_BODY = 4 * 1024  // 4 KB — analytics payloads are tiny

// POST /api/analytics/widget
// Public-safe analytics endpoint for the embedded widget.
// Strict allowlist — never accepts message content or PII.

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function POST(request: NextRequest) {
  // Size guard
  const raw = await request.text().catch(() => '')
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY) {
    return NextResponse.json({ error: 'Payload too large.' }, { status: 413, headers: CORS })
  }

  let body: unknown
  try { body = JSON.parse(raw) } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400, headers: CORS })
  }

  const parsed = widgetAnalyticsEventSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid event.' },
      { status: 400, headers: CORS },
    )
  }

  const { widget_id, event } = parsed.data

  // Basic rate limiting on the widget_id to prevent flooding
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1'
  try {
    const rl = await checkChatRateLimit({ ip, businessId: widget_id })
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429, headers: CORS })
    }
  } catch { /* non-fatal */ }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    // No DB available — silently succeed so the widget keeps working
    return NextResponse.json({ ok: true }, { headers: CORS })
  }

  try {
    const db = createServiceRoleClient()

    // Look up the business_id for this widget (needed for usage_events)
    const { data: ws } = await db
      .from('widget_settings')
      .select('business_id')
      .eq('widget_id', widget_id)
      .single()

    if (ws) {
      const bizId = (ws as { business_id: string }).business_id

      // Map widget events to usage_event types
      const eventTypeMap: Record<string, string> = {
        widget_loaded:       'widget_message',   // counts widget loads as engagement
        widget_opened:       'widget_message',
        widget_message_sent: 'widget_message',
        widget_error:        'widget_message',   // still track for volume
      }

      const eventType = eventTypeMap[event]
      if (eventType) {
        await db.from('usage_events').insert({
          business_id: bizId,
          event_type:  eventType,
          metadata:    { widget_event: event, widget_id: widget_id.slice(0, 12) },
        })
      }
    }
  } catch (err) {
    console.error('[analytics/widget]', err instanceof Error ? err.message : err)
    // Never expose DB errors to the widget
  }

  return NextResponse.json({ ok: true }, { headers: CORS })
}
