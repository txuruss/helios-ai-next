import { NextResponse, type NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { widgetConfigRequestSchema } from '@/lib/validation/widget'
import { getPublicCorsHeaders } from '@/lib/cors'

const CORS = getPublicCorsHeaders()

// GET /api/widget/config?widget_id=wgt_...
// Public — returns only safe display configuration for the widget embed.
// Never returns API keys, owner emails, services, FAQs, or internal IDs.

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const parsed = widgetConfigRequestSchema.safeParse({
    widget_id: searchParams.get('widget_id'),
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid widget_id.' },
      { status: 400, headers: CORS },
    )
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Service not configured.' }, { status: 503, headers: CORS })
  }

  const db = createServiceRoleClient()

  // Look up widget_settings by widget_id — join only what the widget needs
  const { data: ws } = await db
    .from('widget_settings')
    .select(`
      business_id,
      widget_id,
      primary_color,
      bot_name,
      welcome_message,
      placeholder_text,
      position,
      is_enabled,
      logo_url
    `)
    .eq('widget_id', parsed.data.widget_id)
    .single()

  if (!ws) {
    return NextResponse.json({ error: 'Widget not found.' }, { status: 404, headers: CORS })
  }

  const settings = ws as {
    business_id: string
    widget_id: string
    primary_color: string
    bot_name: string
    welcome_message: string
    placeholder_text: string
    position: string
    is_enabled: boolean
    logo_url: string | null
  }

  if (!settings.is_enabled) {
    return NextResponse.json({ error: 'Widget is disabled.' }, { status: 403, headers: CORS })
  }

  // Return ONLY safe display fields — no private business data
  return NextResponse.json(
    {
      business_id:        settings.business_id,
      widget_id:          settings.widget_id,
      primary_color:      settings.primary_color,
      logo_url:           settings.logo_url ?? null,
      agent_display_name: settings.bot_name,
      greeting:           settings.welcome_message,
      placeholder:        settings.placeholder_text,
      position:           settings.position,
      show_powered_by:    true,   // Phase 6: gate behind plan
      is_enabled:         true,
    },
    { status: 200, headers: CORS },
  )
}
