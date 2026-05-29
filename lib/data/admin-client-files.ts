// ── Founder-only reads: client files (admin_client_files) ──────────
//
// Reads file METADATA only. Binaries live in the private `client-files`
// Storage bucket and are accessed via short-lived signed URLs (see
// lib/actions/admin-client-files.ts). No base64, no hard delete.
//
// SECURITY: requireAdmin() gates every read; service-role client used.
// RESILIENCE: missing table → empty + migrationNeeded, never crash.

import 'server-only'

import { requireAdmin } from '@/lib/auth/require-admin'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { type ClientFileCategory, CLIENT_FILE_CATEGORIES } from '@/lib/admin/client-files'

export { CLIENT_FILE_CATEGORIES } from '@/lib/admin/client-files'
export type { ClientFileCategory } from '@/lib/admin/client-files'

export interface ClientFile {
  id:           string
  client_id:    string
  file_name:    string
  content_type: string | null
  size_bytes:   number | null
  category:     ClientFileCategory
  label:        string | null
  is_handoff:   boolean
  created_at:   string
}

export interface ClientFilesResult {
  rows:            ClientFile[]
  migrationNeeded: boolean
  error:           string | null
}

function isMissingTable(e: { code?: string; message?: string } | null): boolean {
  if (!e) return false
  if (e.code === '42P01') return true
  const m = (e.message ?? '').toLowerCase()
  return m.includes('relation') && m.includes('does not exist')
}

function normCategory(v: unknown): ClientFileCategory {
  return (CLIENT_FILE_CATEGORIES as string[]).includes(v as string)
    ? (v as ClientFileCategory)
    : 'general'
}

const FILE_COLS =
  'id, client_id, file_name, content_type, size_bytes, category, label, is_handoff, created_at'

export async function getClientFiles(clientId: string): Promise<ClientFilesResult> {
  await requireAdmin({ path: '/admin/clients' })
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { rows: [], migrationNeeded: false, error: 'Service role key not configured.' }
  }

  try {
    const db = createServiceRoleClient()
    const { data, error } = await db
      .from('admin_client_files')
      .select(FILE_COLS)
      .eq('client_id', clientId)
      .is('archived_at', null)                 // hide archived; never deleted
      .order('created_at', { ascending: false })
      .limit(300)

    if (error) {
      if (isMissingTable(error)) return { rows: [], migrationNeeded: true, error: null }
      throw error
    }

    const rows = ((data ?? []) as Record<string, unknown>[]).map((r) => ({
      id:           String(r.id ?? ''),
      client_id:    String(r.client_id ?? ''),
      file_name:    typeof r.file_name === 'string' ? r.file_name : '(file)',
      content_type: typeof r.content_type === 'string' ? r.content_type : null,
      size_bytes:   typeof r.size_bytes === 'number' ? r.size_bytes : null,
      category:     normCategory(r.category),
      label:        typeof r.label === 'string' && r.label ? r.label : null,
      is_handoff:   r.is_handoff === true,
      created_at:   typeof r.created_at === 'string' ? r.created_at : new Date(0).toISOString(),
    }))
    return { rows, migrationNeeded: false, error: null }
  } catch (err) {
    console.error('[getClientFiles]', err instanceof Error ? err.message : err)
    return { rows: [], migrationNeeded: false, error: 'Files are temporarily unavailable.' }
  }
}
