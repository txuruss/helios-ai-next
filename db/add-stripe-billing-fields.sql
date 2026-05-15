-- ============================================================
-- HELIOS AI — Phase 6: Stripe billing migration
-- Safe to run multiple times (IF NOT EXISTS / conditional blocks).
--
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── 1. Update subscriptions table ────────────────────────────────

-- Drop old plan check so we can replace it with new plan names
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_plan_check;

-- Re-add check with Phase 6 plan names (keeps 'free' for unsubscribed users)
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_plan_check
  CHECK (plan IN ('free', 'starter', 'pro', 'scale'));

-- Drop old status check so we can add Stripe-specific statuses
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_status_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('trialing', 'active', 'past_due', 'cancelled',
                    'incomplete', 'incomplete_expired', 'unpaid', 'paused'));

-- Add Stripe-specific columns
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS user_id               uuid REFERENCES public.profiles ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stripe_customer_id    text UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_price_id       text,
  ADD COLUMN IF NOT EXISTS current_period_start  timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS metadata              jsonb NOT NULL DEFAULT '{}';

-- ── 2. Create usage_events table ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.usage_events (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id   uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  event_type    text NOT NULL
                CHECK (event_type IN ('ai_conversation', 'lead_created',
                                      'booking_created', 'widget_message')),
  quantity      integer NOT NULL DEFAULT 1,
  metadata      jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Indexes for usage queries (monthly rollup by business + type)
CREATE INDEX IF NOT EXISTS usage_events_business_type_idx
  ON public.usage_events (business_id, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS usage_events_created_idx
  ON public.usage_events (created_at DESC);

-- ── 3. RLS for usage_events ───────────────────────────────────────
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'usage_events'
      AND policyname = 'usage_events: members read'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "usage_events: members read"
        ON public.usage_events FOR SELECT
        USING (public.is_business_member(business_id))
    $pol$;
  END IF;
END $$;

-- Writes go through service role only (no authenticated INSERT policy).

-- ── 4. RLS for subscriptions (update) ────────────────────────────
-- Add UPDATE/DELETE policy guarded by service role (no existing ones).
-- Reads already have a "members read" policy from policies.sql.

-- ── 5. Indexes on subscriptions ───────────────────────────────────
CREATE INDEX IF NOT EXISTS subscriptions_stripe_customer_idx
  ON public.subscriptions (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS subscriptions_stripe_sub_idx
  ON public.subscriptions (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
