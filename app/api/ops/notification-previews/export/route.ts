import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { captureApiError } from '@/lib/logging/api'
import { capture } from '@/lib/analytics/posthog'

// POST /api/ops/notification-previews/export
// Authenticated dashboard only. Exports sanitized preview history as CSV or JSON.
// Phase 18 — never exports emails, phone numbers, raw metadata, or secrets.

const MAX_ROWS = 2000

function escCsv(v: string | null | boolean | undefined): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  const lines   = [headers.join(',')]
  for (const row of rows) {
    lines.push(headers.map((h) => escCsv(row[h] as string | null | boolean)).join(','))
  }
  return lines.join('\n')
}

export async function POST(request: NextRequest) {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const db = createServiceRoleClient()
  const { data: membership } = await db
    .from('business_members').select('business_id').eq('user_id', user.id).limit(1).single()
  if (!membership) return NextResponse.json({ error: 'No business found.' }, { status: 404 })
  const businessId = (membership as { business_id: string }).business_id

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const {
    format    = 'csv',
    rule_id,
    preview_type,
    date_from,
    date_to,
    search,
    limit     = 500,
  } = (body ?? {}) as {
    format?:       string
    rule_id?:      string
    preview_type?: string
    date_from?:    string
    date_to?:      string
    search?:       string
    limit?:        number
  }

  if (!['csv', 'json'].includes(format)) {
    return NextResponse.json({ error: 'Invalid format. Use csv or json.' }, { status: 400 })
  }

  const safeLimit = Math.min(Math.max(1, limit), MAX_ROWS)

  try {
    let query = db.from('ops_notification_previews')
      .select('id,created_at,preview_type,source_rule_name,rendered_with_template,dry_run_status,subject_preview,recipient_preview')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(safeLimit)

    if (rule_id)      query = query.eq('notification_rule_id', rule_id)
    if (preview_type) query = query.eq('preview_type', preview_type)
    if (date_from)    query = query.gte('created_at', date_from)
    if (date_to)      query = query.lte('created_at', date_to)

    // FTS or ilike for search
    if (search && search.length >= 3) {
      query = (query as ReturnType<typeof db.from>).textSearch('search_vector', search.trim(), { type: 'websearch', config: 'english' }) as typeof query
    } else if (search) {
      query = query.ilike('source_rule_name', `%${search}%`)
    }

    let { data, error } = await query
    if (error && search && search.length >= 3) {
      // FTS fallback
      let fb = db.from('ops_notification_previews')
        .select('id,created_at,preview_type,source_rule_name,rendered_with_template,dry_run_status,subject_preview,recipient_preview')
        .eq('business_id', businessId)
        .ilike('source_rule_name', `%${search}%`)
        .order('created_at', { ascending: false })
        .limit(safeLimit)
      if (rule_id)      fb = fb.eq('notification_rule_id', rule_id)
      if (preview_type) fb = fb.eq('preview_type', preview_type)
      const fallback = await fb
      data  = fallback.data
      error = fallback.error
    }
    if (error) throw error

    type PreviewRow = {
      id: string
      created_at: string
      preview_type: string
      source_rule_name: string | null
      rendered_with_template: boolean
      dry_run_status: string | null
      subject_preview: string | null
      recipient_preview: string | null
    }

    // Sanitise: truncate subject, mask recipient
    const sanitised = ((data ?? []) as PreviewRow[]).map((r) => ({
      created_at:             r.created_at,
      preview_type:           r.preview_type,
      source_rule_name:       r.source_rule_name ?? '',
      rendered_with_template: r.rendered_with_template,
      dry_run_status:         r.dry_run_status ?? '',
      subject_preview:        (r.subject_preview ?? '').slice(0, 120),
      recipient_preview:      maskRecipientPreview(r.recipient_preview),
    }))

    // Mark rows as exported
    const ids = ((data ?? []) as PreviewRow[]).map((r) => r.id)
    if (ids.length > 0) {
      await db.from('ops_notification_previews')
        .update({ exported_at: new Date().toISOString(), export_format: format })
        .in('id', ids)
        .eq('business_id', businessId)
        .catch(() => undefined)
    }

    // Log to ops_exports
    await db.from('ops_exports').insert({
      business_id:  businessId,
      export_type:  'notification_previews',
      format,
      status:       'completed',
      requested_by: user.id,
      filters:      { rule_id, preview_type, date_from, date_to, search },
      row_count:    sanitised.length,
      source_table: 'ops_notification_previews',
    }).catch(() => undefined)

    capture('ops_notification_preview_exported', {
      format,
      export_format: format,
      count:         sanitised.length,
      has_search:    !!search,
    })

    if (format === 'json') {
      return NextResponse.json({ ok: true, rows: sanitised, count: sanitised.length })
    }

    const csv = toCsv(sanitised)
    return new NextResponse(csv, {
      status:  200,
      headers: {
        'Content-Type':        'text/csv',
        'Content-Disposition': `attachment; filename="notification-previews-${Date.now()}.csv"`,
      },
    })

  } catch (err) {
    captureApiError(err, {
      route:       '/api/ops/notification-previews/export',
      error_type:  'preview_export_error',
      business_id: businessId,
    })
    return NextResponse.json({ error: 'Export failed.' }, { status: 500 })
  }
}

function maskRecipientPreview(raw: string | null): string {
  if (!raw) return ''
  return raw.replace(/[\w.+-]+@[\w-]+\.[a-z]{2,}/gi, (m) => {
    const [local, domain] = m.split('@')
    return `${local.slice(0, 2)}***@${domain}`
  })
}
