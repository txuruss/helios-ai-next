-- ============================================================
-- Migration: ensure chat_messages.metadata column exists
-- ============================================================
-- This column is included in the initial schema.sql.
-- Run this ONLY if you applied schema.sql before the metadata
-- column was added (early development environments).
--
-- Safe to run multiple times — ADD COLUMN IF NOT EXISTS is idempotent.
--
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================

ALTER TABLE public.chat_messages
ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}';
