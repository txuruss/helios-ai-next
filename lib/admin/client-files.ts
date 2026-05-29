// ── Client file categories (pure — safe for server + client) ──────
// Kept out of the server-only data module so client components (the
// drawer) can import the category list and type without pulling
// 'server-only' into the browser bundle.

export type ClientFileCategory =
  | 'contract' | 'invoice' | 'deliverable' | 'asset' | 'credential' | 'handoff' | 'general'

export const CLIENT_FILE_CATEGORIES: ClientFileCategory[] =
  ['contract', 'invoice', 'deliverable', 'asset', 'credential', 'handoff', 'general']
