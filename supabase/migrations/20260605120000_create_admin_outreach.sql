-- ════════════════════════════════════════════════════════════════════
-- Client Outreach Dashboard: admin_outreach_leads + admin_outreach_daily_reviews
-- ════════════════════════════════════════════════════════════════════
--
-- Purpose:
--   Manual outreach CRM for finding, scoring, contacting, and following up
--   with local service businesses. 100% founder-driven — nothing here
--   auto-sends DMs/emails, scrapes, or contacts anyone. Status changes are
--   all manual.
--
-- Safety:
--   • Additive only. Re-runnable (IF NOT EXISTS / DROP POLICY IF EXISTS).
--   • New tables only. public.businesses / audit_submissions / admin_*
--     pipeline tables are untouched.
--   • Soft archive only (archived_at + reply_status='archived'); the app
--     never hard-deletes. RLS: founder_admin via is_founder_admin();
--     server actions use the service-role client.
-- ════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Shared updated_at trigger fn (created by the admin pipeline migration;
-- re-declared here so this migration is self-sufficient / re-runnable).
CREATE OR REPLACE FUNCTION public.admin_pipeline_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ── Outreach leads ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_outreach_leads (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name      text NOT NULL,
  niche              text NOT NULL,
  location           text,
  instagram_url      text,
  website_url        text,
  phone              text,
  email              text,
  contact_method     text NOT NULL DEFAULT 'instagram',
  score              integer NOT NULL DEFAULT 0,
  pain_found         text,
  outreach_angle     text,
  first_message_sent boolean NOT NULL DEFAULT false,
  reply_status       text NOT NULL DEFAULT 'new',
  next_action        text,
  follow_up_date     date,
  last_contacted_at  timestamptz,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  archived_at        timestamptz,

  CONSTRAINT admin_outreach_leads_score_check CHECK (score >= 0 AND score <= 10),
  CONSTRAINT admin_outreach_leads_reply_status_check CHECK (
    reply_status IN (
      'new', 'contacted', 'follow_up_needed', 'replied', 'demo_sent',
      'call_booked', 'proposal_sent', 'won', 'lost', 'nurture', 'archived'
    )
  ),
  CONSTRAINT admin_outreach_leads_contact_method_check CHECK (
    contact_method IN ('instagram', 'whatsapp', 'email', 'phone', 'website', 'in_person', 'other')
  )
);

COMMENT ON TABLE public.admin_outreach_leads IS 'Manual outreach CRM for local-business prospecting. No auto-outreach; soft archive only.';

CREATE INDEX IF NOT EXISTS admin_outreach_leads_status_idx     ON public.admin_outreach_leads (reply_status);
CREATE INDEX IF NOT EXISTS admin_outreach_leads_followup_idx   ON public.admin_outreach_leads (follow_up_date);
CREATE INDEX IF NOT EXISTS admin_outreach_leads_archived_idx   ON public.admin_outreach_leads (archived_at);

DROP TRIGGER IF EXISTS admin_outreach_leads_set_updated_at ON public.admin_outreach_leads;
CREATE TRIGGER admin_outreach_leads_set_updated_at
  BEFORE UPDATE ON public.admin_outreach_leads
  FOR EACH ROW EXECUTE FUNCTION public.admin_pipeline_set_updated_at();

-- ── End-of-day review (one row per day) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_outreach_daily_reviews (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_date          date NOT NULL UNIQUE DEFAULT current_date,
  businesses_contacted text,
  replies              text,
  best_niche           text,
  best_outreach_angle  text,
  hottest_lead         text,
  follow_ups_due       text,
  improve_tomorrow     text,
  checklist            jsonb NOT NULL DEFAULT '{}',
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.admin_outreach_daily_reviews IS 'Optional end-of-day outreach review notes, one row per day. UI-driven, founder-only.';

DROP TRIGGER IF EXISTS admin_outreach_daily_reviews_set_updated_at ON public.admin_outreach_daily_reviews;
CREATE TRIGGER admin_outreach_daily_reviews_set_updated_at
  BEFORE UPDATE ON public.admin_outreach_daily_reviews
  FOR EACH ROW EXECUTE FUNCTION public.admin_pipeline_set_updated_at();

-- ── Row Level Security — founder_admin only ────────────────────────
ALTER TABLE public.admin_outreach_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_outreach_leads FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.admin_outreach_daily_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_outreach_daily_reviews FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS aol_select_founder_admin ON public.admin_outreach_leads;
DROP POLICY IF EXISTS aol_insert_founder_admin ON public.admin_outreach_leads;
DROP POLICY IF EXISTS aol_update_founder_admin ON public.admin_outreach_leads;
DROP POLICY IF EXISTS aol_delete_founder_admin ON public.admin_outreach_leads;

CREATE POLICY aol_select_founder_admin ON public.admin_outreach_leads
  FOR SELECT TO authenticated USING (public.is_founder_admin());
CREATE POLICY aol_insert_founder_admin ON public.admin_outreach_leads
  FOR INSERT TO authenticated WITH CHECK (public.is_founder_admin());
CREATE POLICY aol_update_founder_admin ON public.admin_outreach_leads
  FOR UPDATE TO authenticated USING (public.is_founder_admin()) WITH CHECK (public.is_founder_admin());
CREATE POLICY aol_delete_founder_admin ON public.admin_outreach_leads
  FOR DELETE TO authenticated USING (public.is_founder_admin());

DROP POLICY IF EXISTS aodr_select_founder_admin ON public.admin_outreach_daily_reviews;
DROP POLICY IF EXISTS aodr_insert_founder_admin ON public.admin_outreach_daily_reviews;
DROP POLICY IF EXISTS aodr_update_founder_admin ON public.admin_outreach_daily_reviews;
DROP POLICY IF EXISTS aodr_delete_founder_admin ON public.admin_outreach_daily_reviews;

CREATE POLICY aodr_select_founder_admin ON public.admin_outreach_daily_reviews
  FOR SELECT TO authenticated USING (public.is_founder_admin());
CREATE POLICY aodr_insert_founder_admin ON public.admin_outreach_daily_reviews
  FOR INSERT TO authenticated WITH CHECK (public.is_founder_admin());
CREATE POLICY aodr_update_founder_admin ON public.admin_outreach_daily_reviews
  FOR UPDATE TO authenticated USING (public.is_founder_admin()) WITH CHECK (public.is_founder_admin());
CREATE POLICY aodr_delete_founder_admin ON public.admin_outreach_daily_reviews
  FOR DELETE TO authenticated USING (public.is_founder_admin());
