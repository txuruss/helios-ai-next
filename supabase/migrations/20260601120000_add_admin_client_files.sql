-- ════════════════════════════════════════════════════════════════════
-- Client files & handoff storage: admin_client_files + storage bucket
-- ════════════════════════════════════════════════════════════════════
--
-- Purpose:
--   Stores metadata for files attached to a client (contracts, invoices,
--   deliverables, assets, credentials, handoff docs). The binary lives in
--   the private Supabase Storage bucket `client-files`; this table only
--   holds the storage path + metadata. Files are NEVER stored as base64.
--
-- Safety:
--   • Additive only. Re-runnable (IF NOT EXISTS / DROP POLICY IF EXISTS /
--     ON CONFLICT DO NOTHING).
--   • Creates ONE new table + one private storage bucket. businesses,
--     audit_submissions, admin_clients and its sub-tables are untouched.
--   • No hard delete in the app — files are archived (archived_at) and the
--     storage object is retained.
--   • RLS mirrors admin_clients: founder_admin only via is_founder_admin();
--     server actions use the service-role client (which bypasses RLS and
--     signs upload/download URLs).
-- ════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.admin_pipeline_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ── 1. Private storage bucket ──────────────────────────────────────
-- Created here for convenience; can also be created in the Supabase
-- dashboard (Storage → New bucket → "client-files", private).
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-files', 'client-files', false)
ON CONFLICT (id) DO NOTHING;

-- ── 2. admin_client_files ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_client_files (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     uuid NOT NULL REFERENCES public.admin_clients(id) ON DELETE CASCADE,

  -- Storage
  storage_path  text NOT NULL UNIQUE,           -- object key inside the client-files bucket
  file_name     text NOT NULL,                  -- original display name
  content_type  text,
  size_bytes    bigint,

  -- Metadata
  category      text NOT NULL DEFAULT 'general',
  label         text,
  is_handoff    boolean NOT NULL DEFAULT false, -- part of the handoff package

  uploaded_by   uuid,                           -- founder profile id (nullable)
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  archived_at   timestamptz,

  CONSTRAINT admin_client_files_category_check CHECK (category IN (
    'contract', 'invoice', 'deliverable', 'asset', 'credential', 'handoff', 'general'
  )),
  CONSTRAINT admin_client_files_size_check CHECK (size_bytes IS NULL OR size_bytes >= 0)
);

COMMENT ON TABLE public.admin_client_files IS 'Metadata for client files. Binaries live in the private client-files Storage bucket. No base64; no hard delete (archived_at).';

CREATE INDEX IF NOT EXISTS admin_client_files_client_idx   ON public.admin_client_files (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_client_files_handoff_idx  ON public.admin_client_files (client_id, is_handoff);

DROP TRIGGER IF EXISTS admin_client_files_set_updated_at ON public.admin_client_files;
CREATE TRIGGER admin_client_files_set_updated_at
  BEFORE UPDATE ON public.admin_client_files
  FOR EACH ROW EXECUTE FUNCTION public.admin_pipeline_set_updated_at();

-- ── 3. Row Level Security — founder_admin only ─────────────────────
ALTER TABLE public.admin_client_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_client_files FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS acf_select_founder_admin ON public.admin_client_files;
DROP POLICY IF EXISTS acf_insert_founder_admin ON public.admin_client_files;
DROP POLICY IF EXISTS acf_update_founder_admin ON public.admin_client_files;
DROP POLICY IF EXISTS acf_delete_founder_admin ON public.admin_client_files;

CREATE POLICY acf_select_founder_admin ON public.admin_client_files
  FOR SELECT TO authenticated USING (public.is_founder_admin());
CREATE POLICY acf_insert_founder_admin ON public.admin_client_files
  FOR INSERT TO authenticated WITH CHECK (public.is_founder_admin());
CREATE POLICY acf_update_founder_admin ON public.admin_client_files
  FOR UPDATE TO authenticated USING (public.is_founder_admin()) WITH CHECK (public.is_founder_admin());
CREATE POLICY acf_delete_founder_admin ON public.admin_client_files
  FOR DELETE TO authenticated USING (public.is_founder_admin());

-- ── Storage access notes ───────────────────────────────────────────
-- The app never relies on storage.objects RLS: uploads use short-lived
-- signed upload URLs and downloads use short-lived signed URLs, both
-- generated server-side by the service-role client. The bucket stays
-- private (public=false) so objects are not directly accessible.
