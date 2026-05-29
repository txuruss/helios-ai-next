// ── Client file categories (pure — safe for server + client) ──────
// Kept out of the server-only data module so client components (the
// drawer) can import the category list and type without pulling
// 'server-only' into the browser bundle.

export type ClientFileCategory =
  // New explicit taxonomy (used by the upload dropdown)
  | 'logo' | 'brand_asset' | 'service_menu' | 'business_info' | 'screenshot'
  | 'setup_document' | 'handoff_document' | 'proposal' | 'contract' | 'general'
  // Legacy values — kept valid for existing records / back-compat
  | 'asset' | 'deliverable' | 'handoff' | 'credential' | 'invoice'

// Shown in the upload / edit dropdowns (the new clearer taxonomy).
export const CLIENT_FILE_CATEGORIES: ClientFileCategory[] = [
  'handoff_document', 'setup_document', 'logo', 'brand_asset',
  'service_menu', 'business_info', 'screenshot', 'proposal', 'contract', 'general',
]

// Full set accepted by validation/normalization (new + legacy), so existing
// files with legacy categories keep working.
export const CLIENT_FILE_CATEGORY_VALUES: ClientFileCategory[] = [
  ...CLIENT_FILE_CATEGORIES,
  'asset', 'deliverable', 'handoff', 'credential', 'invoice',
]

// Friendly labels for display.
export const CLIENT_FILE_CATEGORY_LABELS: Record<string, string> = {
  logo: 'Logo', brand_asset: 'Brand asset', service_menu: 'Service menu',
  business_info: 'Business info', screenshot: 'Screenshot', setup_document: 'Setup document',
  handoff_document: 'Handoff document', proposal: 'Proposal', contract: 'Contract', general: 'General',
  asset: 'Asset (legacy)', deliverable: 'Deliverable (legacy)', handoff: 'Handoff (legacy)',
  credential: 'Credential (legacy)', invoice: 'Invoice (legacy)',
}
