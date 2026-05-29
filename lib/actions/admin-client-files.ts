'use server'

// ── Founder admin actions: client files & handoff ─────────────────
//
// Upload flow (no base64, no file routed through the Next server):
//   1. createClientFileUploadUrl(...) → service-role signs a one-time
//      upload URL for a generated path in the private client-files bucket.
//   2. The browser uploads the binary directly via uploadToSignedUrl.
//   3. recordClientFile(...) inserts the metadata row.
// Viewing uses short-lived signed download URLs. Archiving is soft
// (archived_at) — the storage object is retained, never hard-deleted.

import { requireAdmin } from '@/lib/auth/require-admin'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getClientFiles, CLIENT_FILE_CATEGORIES } from '@/lib/data/admin-client-files'

const BUCKET = 'client-files'
const MAX_BYTES = 50 * 1024 * 1024   // 50 MB cap

export interface FileActionResult {
  ok:      boolean
  error?:  string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const MIGRATION_HINT =
  'Apply the client files migration (20260601120000_add_admin_client_files.sql) and create the client-files bucket in Supabase, then retry.'

function validId(raw: unknown): string | null {
  return typeof raw === 'string' && UUID_RE.test(raw) ? raw : null
}
function isMissingTable(e: { code?: string; message?: string } | null): boolean {
  if (!e) return false
  if (e.code === '42P01') return true
  const m = (e.message ?? '').toLowerCase()
  return m.includes('relation') && m.includes('does not exist')
}
function guardServiceRole(): FileActionResult | null {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[admin-client-files] SUPABASE_SERVICE_ROLE_KEY missing')
    return { ok: false, error: 'Server configuration error.' }
  }
  return null
}
function cleanText(raw: string | null | undefined, max: number): string | null {
  if (typeof raw !== 'string') return null
  const t = raw.trim()
  return t.length === 0 ? null : t.slice(0, max)
}
// Make a storage-safe object key segment from a filename.
function safeName(name: string): string {
  const base = name.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/_+/g, '_').slice(0, 120)
  return base.length > 0 ? base : 'file'
}
function revalidate() {
  revalidatePath('/admin/clients')
  revalidatePath('/admin/mission-control')
}

// ── Read wrapper (callable from the client drawer) ─────────────────
export async function loadClientFiles(clientId: string) {
  const id = validId(clientId)
  if (!id) return { rows: [], migrationNeeded: false, error: 'Invalid client id.' }
  return getClientFiles(id)
}

// ── 1. Create a one-time signed upload URL ─────────────────────────
export interface SignedUploadResult extends FileActionResult {
  path?:   string
  token?:  string
}

export async function createClientFileUploadUrl(
  clientId:    string,
  fileName:    string,
  sizeBytes:   number,
): Promise<SignedUploadResult> {
  await requireAdmin({ path: '/admin/clients' })

  const id = validId(clientId)
  if (!id) return { ok: false, error: 'Invalid client id.' }

  const name = typeof fileName === 'string' ? fileName.trim() : ''
  if (name.length === 0)   return { ok: false, error: 'A file name is required.' }
  if (name.length > 200)   return { ok: false, error: 'File name is too long (max 200).' }
  if (typeof sizeBytes !== 'number' || Number.isNaN(sizeBytes) || sizeBytes < 0) {
    return { ok: false, error: 'Invalid file size.' }
  }
  if (sizeBytes > MAX_BYTES) return { ok: false, error: 'File is too large (max 50 MB).' }

  const guard = guardServiceRole()
  if (guard) return guard

  // Unique object key under the client's folder.
  const key = `${id}/${crypto.randomUUID()}-${safeName(name)}`

  const db = createServiceRoleClient()
  const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(key)

  if (error || !data) {
    const msg = (error?.message ?? '').toLowerCase()
    if (msg.includes('bucket') && msg.includes('not found')) {
      return { ok: false, error: MIGRATION_HINT }
    }
    console.error('[createClientFileUploadUrl]', error?.message)
    return { ok: false, error: 'Could not start the upload. Try again.' }
  }

  return { ok: true, path: data.path, token: data.token }
}

// ── 2. Record uploaded file metadata ───────────────────────────────
export interface RecordFileInput {
  clientId:     string
  path:         string
  fileName:     string
  contentType?: string | null
  sizeBytes?:   number | null
  category?:    string
  label?:       string | null
  isHandoff?:   boolean
}

export async function recordClientFile(input: RecordFileInput): Promise<FileActionResult> {
  await requireAdmin({ path: '/admin/clients' })

  const id = validId(input.clientId)
  if (!id) return { ok: false, error: 'Invalid client id.' }

  const path = typeof input.path === 'string' ? input.path.trim() : ''
  // The signed path is always prefixed with the client id folder.
  if (path.length === 0 || !path.startsWith(`${id}/`)) {
    return { ok: false, error: 'Invalid file path.' }
  }
  const name = cleanText(input.fileName, 200)
  if (!name) return { ok: false, error: 'A file name is required.' }

  const category = CLIENT_FILE_CATEGORIES.includes(input.category as never) ? input.category : 'general'
  const size = typeof input.sizeBytes === 'number' && input.sizeBytes >= 0 ? Math.floor(input.sizeBytes) : null

  const guard = guardServiceRole()
  if (guard) return guard

  const db = createServiceRoleClient()
  const { error } = await db.from('admin_client_files').insert({
    client_id:    id,
    storage_path: path,
    file_name:    name,
    content_type: cleanText(input.contentType, 200),
    size_bytes:   size,
    category,
    label:        cleanText(input.label, 200),
    is_handoff:   input.isHandoff === true,
  })

  if (error) {
    if (isMissingTable(error)) return { ok: false, error: MIGRATION_HINT }
    console.error('[recordClientFile]', error.message, '| code:', error.code)
    return { ok: false, error: 'Could not save the file record. Try again.' }
  }

  revalidate()
  return { ok: true }
}

// ── 3. Signed download URL (short-lived) ───────────────────────────
export interface SignedUrlResult extends FileActionResult {
  url?: string
}

export async function getSignedClientFileUrl(fileId: string): Promise<SignedUrlResult> {
  await requireAdmin({ path: '/admin/clients' })

  const id = validId(fileId)
  if (!id) return { ok: false, error: 'Invalid file id.' }

  const guard = guardServiceRole()
  if (guard) return guard

  const db = createServiceRoleClient()
  const { data: row, error: rowErr } = await db
    .from('admin_client_files')
    .select('storage_path')
    .eq('id', id)
    .maybeSingle()

  if (rowErr) {
    if (isMissingTable(rowErr)) return { ok: false, error: MIGRATION_HINT }
    return { ok: false, error: 'Could not load the file.' }
  }
  if (!row || typeof row.storage_path !== 'string') return { ok: false, error: 'File not found.' }

  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(row.storage_path as string, 3600)
  if (error || !data?.signedUrl) {
    console.error('[getSignedClientFileUrl]', error?.message)
    return { ok: false, error: 'Could not generate a view link. Try again.' }
  }
  return { ok: true, url: data.signedUrl }
}

// ── 4. Edit metadata (label / category / handoff flag) ─────────────
export interface UpdateFileMetaInput {
  label?:     string | null
  category?:  string
  isHandoff?: boolean
}

export async function updateClientFileMeta(
  fileId: string,
  input:  UpdateFileMetaInput,
): Promise<FileActionResult> {
  await requireAdmin({ path: '/admin/clients' })

  const id = validId(fileId)
  if (!id) return { ok: false, error: 'Invalid file id.' }

  const update: Record<string, unknown> = {}
  if (input.label !== undefined)    update.label = cleanText(input.label, 200)
  if (input.category !== undefined) {
    if (!CLIENT_FILE_CATEGORIES.includes(input.category as never)) return { ok: false, error: 'Invalid category.' }
    update.category = input.category
  }
  if (input.isHandoff !== undefined) update.is_handoff = input.isHandoff === true

  if (Object.keys(update).length === 0) return { ok: true }

  const guard = guardServiceRole()
  if (guard) return guard

  const db = createServiceRoleClient()
  const { error } = await db.from('admin_client_files').update(update).eq('id', id)

  if (error) {
    if (isMissingTable(error)) return { ok: false, error: MIGRATION_HINT }
    console.error('[updateClientFileMeta]', error.message, '| code:', error.code)
    return { ok: false, error: 'Could not update the file. Try again.' }
  }

  revalidate()
  return { ok: true }
}

// ── 5. Archive a file (soft — storage object retained) ─────────────
export async function archiveClientFile(fileId: string): Promise<FileActionResult> {
  await requireAdmin({ path: '/admin/clients' })

  const id = validId(fileId)
  if (!id) return { ok: false, error: 'Invalid file id.' }

  const guard = guardServiceRole()
  if (guard) return guard

  const db = createServiceRoleClient()
  const { error } = await db
    .from('admin_client_files')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    if (isMissingTable(error)) return { ok: false, error: MIGRATION_HINT }
    console.error('[archiveClientFile]', error.message, '| code:', error.code)
    return { ok: false, error: 'Could not archive the file. Try again.' }
  }

  revalidate()
  return { ok: true }
}
