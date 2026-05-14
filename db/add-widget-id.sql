-- ============================================================
-- HELIOS AI — Phase 5: Widget ID & display fields
-- Safe to run multiple times (IF NOT EXISTS / DO blocks).
--
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- Add widget_id — stable public identifier for the embed script
ALTER TABLE public.widget_settings
  ADD COLUMN IF NOT EXISTS widget_id text;

-- Add logo_url — optional branding logo shown in widget header
ALTER TABLE public.widget_settings
  ADD COLUMN IF NOT EXISTS logo_url text;

-- Backfill existing rows that have no widget_id yet
UPDATE public.widget_settings
SET widget_id = 'wgt_' || encode(gen_random_bytes(10), 'hex')
WHERE widget_id IS NULL;

-- Create a unique index (not constraint) so it's idempotent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename  = 'widget_settings'
      AND indexname  = 'widget_settings_widget_id_idx'
  ) THEN
    CREATE UNIQUE INDEX widget_settings_widget_id_idx
      ON public.widget_settings (widget_id)
      WHERE widget_id IS NOT NULL;
  END IF;
END
$$;

-- Add notification_email to notifications for tracking send status
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS channel    text DEFAULT 'in_app';  -- 'in_app' | 'email'

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS status     text DEFAULT 'sent';    -- 'sent' | 'skipped' | 'failed'

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS recipient  text;                   -- email address when channel='email'
