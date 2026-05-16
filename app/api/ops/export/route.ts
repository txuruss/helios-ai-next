import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { exportOpsSchema } from '@/lib/validation/ops'
import { captureApiError } from '@/lib/logging/api'

// POST /api/ops/export
// Authenticated dashboard only. Returns CSV or JSON download.

const MAX_ROWS = 2000

// ── Safe field lists ──────────────────────────────────────────────
// Only these fields are exported — no raw metadata, no phone numbers.

const SAFE_EVENT_FIELDS = 'id,source,event_type,severity,title,description,status,created_at,resolved_at,auto_generated'
const SAFE_ALERT_FIELDS = 'id,alert_type,severity,title,message,status,created_at,acknowledged_at,resolved_at'
const SAFE_TASK_FIELDS  = 'id,title,description,task_type,priority,status,created_at,completed_at,due_at'
const SAFE_APPROVAL_FIELDS = 'id,approval_type,title,description,status,requested_by,priority,created_at,reviewed_at'

type Row = Record<string, unknown>

function toCSV(rows: Row[], fields: string[]): string {
  const header = fields.join(',')
  const lines  = rows.map((row) =>
    fields.map((f) => {
      const v = row[f]
      if (v === null || v === undefined) return ''
      const s = String(v).replace(/"/g, '""')
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s
    }).join(','),
  )
  return [header, ...lines].join('\n')
}

export async function POST(request: NextRequest) {
  // 1. Auth
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const db = createServiceRoleClient()
  const { data: membership } = await db
    .from('business_members').select('business_id').eq('user_id', user.id).limit(1).single()
  if (!membership) return NextResponse.json({ error: 'No business found.' }, { status: 404 })
  const businessId = (membership as Row).business_id as string

  // 2. Parse + validate body
  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const parsed = exportOpsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input.' }, { status: 400 })
  }

  const { export_type, format, status, severity, source, date_from, date_to, limit, search } = parsed.data
  const rowLimit = Math.min(limit ?? 500, MAX_ROWS)

  // 3. Query the appropriate table
  try {
    let query: ReturnType<typeof db.from>

    if (export_type === 'ops_events') {
      query = db.from('ops_events').select(SAFE_EVENT_FIELDS).eq('business_id', businessId)
      if (status)    query = query.eq('status', status)
      if (severity)  query = query.eq('severity', severity)
      if (source)    query = query.eq('source', source)
      if (date_from) query = query.gte('created_at', date_from)
      if (date_to)   query = query.lte('created_at', date_to)
      if (search)    query = query.ilike('title', `%${search}%`)
    } else if (export_type === 'ops_alerts') {
      query = db.from('ops_alerts').select(SAFE_ALERT_FIELDS).eq('business_id', businessId)
      if (status)    query = query.eq('status', status)
      if (severity)  query = query.eq('severity', severity)
      if (date_from) query = query.gte('created_at', date_from)
      if (date_to)   query = query.lte('created_at', date_to)
      if (search)    query = query.ilike('title', `%${search}%`)
    } else if (export_type === 'ops_tasks') {
      query = db.from('ops_tasks').select(SAFE_TASK_FIELDS).eq('business_id', businessId)
      if (status)    query = query.eq('status', status)
      if (date_from) query = query.gte('created_at', date_from)
      if (date_to)   query = query.lte('created_at', date_to)
      if (search)    query = query.ilike('title', `%${search}%`)
    } else {
      // approvals
      query = db.from('approval_items').select(SAFE_APPROVAL_FIELDS).eq('business_id', businessId)
      if (status)    query = query.eq('status', status)
      if (date_from) query = query.gte('created_at', date_from)
      if (date_to)   query = query.lte('created_at', date_to)
      if (search)    query = query.ilike('title', `%${search}%`)
    }

    query = query.order('created_at', { ascending: false }).limit(rowLimit)

    const { data: rows, error: qErr } = await query
    if (qErr) throw qErr

    const safeRows = (rows ?? []) as Row[]
    const rowCount = safeRows.length

    // 4. Log export (fire-and-forget)
    db.from('ops_exports').insert({
      business_id:  businessId,
      export_type,
      format,
      status:       'completed',
      requested_by: user.id,
      filters:      { status, severity, source, date_from, date_to, search },
      row_count:    rowCount,
    }).catch(() => undefined)

    // 5. Serialize + return
    const filename = `${export_type}_${new Date().toISOString().slice(0, 10)}.${format}`

    if (format === 'json') {
      const body = JSON.stringify({ export_type, exported_at: new Date().toISOString(), row_count: rowCount, rows: safeRows }, null, 2)
      return new NextResponse(body, {
        status: 200,
        headers: {
          'Content-Type':        'application/json',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    }

    // CSV
    const fields = (export_type === 'ops_events'  ? SAFE_EVENT_FIELDS  :
                    export_type === 'ops_alerts'   ? SAFE_ALERT_FIELDS  :
                    export_type === 'ops_tasks'    ? SAFE_TASK_FIELDS   :
                                                     SAFE_APPROVAL_FIELDS).split(',')
    const csv = toCSV(safeRows, fields)

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type':        'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })

  } catch (err) {
    captureApiError(err, { route: '/api/ops/export', error_type: 'export_error', business_id: businessId })
    return NextResponse.json({ error: 'Export failed.' }, { status: 500 })
  }
}
