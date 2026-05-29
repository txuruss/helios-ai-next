-- ════════════════════════════════════════════════════════════════════
-- Expand admin_client_files.category to the explicit handoff taxonomy
-- ════════════════════════════════════════════════════════════════════
--
-- Purpose:
--   Adds clearer file categories (logo, brand_asset, service_menu,
--   business_info, screenshot, setup_document, handoff_document, proposal)
--   used by the upload dropdown and handoff-readiness checks.
--
-- Safety:
--   • Additive only — the new CHECK is a SUPERSET that keeps every
--     pre-existing value (asset, deliverable, handoff, credential, invoice,
--     contract, general) valid. No file record is deleted or rewritten.
--   • No storage paths changed. No hard deletes. businesses untouched.
--   • Re-runnable (DROP CONSTRAINT IF EXISTS, then ADD).
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE public.admin_client_files
  DROP CONSTRAINT IF EXISTS admin_client_files_category_check;

ALTER TABLE public.admin_client_files
  ADD CONSTRAINT admin_client_files_category_check CHECK (category IN (
    -- New explicit taxonomy
    'logo', 'brand_asset', 'service_menu', 'business_info', 'screenshot',
    'setup_document', 'handoff_document', 'proposal', 'contract', 'general',
    -- Legacy values kept for backward compatibility with existing records
    'asset', 'deliverable', 'handoff', 'credential', 'invoice'
  ));

COMMENT ON COLUMN public.admin_client_files.category IS
  'File category. New uploads use the explicit taxonomy (logo, brand_asset, service_menu, business_info, screenshot, setup_document, handoff_document, proposal, contract, general). Legacy values (asset, deliverable, handoff, credential, invoice) remain valid.';
