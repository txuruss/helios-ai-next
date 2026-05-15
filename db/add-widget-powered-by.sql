-- ============================================================
-- HELIOS AI — Phase 6.1: Widget branding plan gating
-- Adds show_powered_by column to widget_settings.
-- Safe to run multiple times (IF NOT EXISTS).
--
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================

ALTER TABLE public.widget_settings
  ADD COLUMN IF NOT EXISTS show_powered_by boolean NOT NULL DEFAULT true;
