-- ============================================================
-- HELIOS AI — Cal.com Phase 4 migration
-- Add booking-related columns and RLS policies needed by Phase 4.
-- Safe to run multiple times (IF NOT EXISTS everywhere).
--
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── calcom_event_types: add raw response storage ──────────────────
ALTER TABLE public.calcom_event_types
  ADD COLUMN IF NOT EXISTS raw_data jsonb;

-- ── calcom_connections: add sync tracking ─────────────────────────
ALTER TABLE public.calcom_connections
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

-- ── bookings: add Cal.com reference fields ────────────────────────
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS calcom_booking_uid text;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS calcom_event_type_id integer;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS timezone text;

-- ── RLS: allow members to INSERT/UPDATE calcom_event_types ────────
-- (needed so the sync API route can write event types server-side)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'calcom_event_types'
      AND policyname = 'calcom_event_types: members write'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "calcom_event_types: members write"
        ON public.calcom_event_types FOR ALL
        USING (public.is_business_member(business_id))
    $policy$;
  END IF;
END
$$;

-- ── RLS: allow members to INSERT/UPDATE calcom_connections ────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'calcom_connections'
      AND policyname = 'calcom_connections: owners manage'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "calcom_connections: owners manage"
        ON public.calcom_connections FOR ALL
        USING (public.is_business_member(business_id))
    $policy$;
  END IF;
END
$$;
