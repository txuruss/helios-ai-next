-- ════════════════════════════════════════════════════════════════════
-- Relevance AI audit analysis results: admin_audit_ai_results
-- ════════════════════════════════════════════════════════════════════
--
-- Purpose:
--   Stores structured output from a MANUAL Relevance AI audit analysis
--   run against a public.audit_submissions row. One current result per
--   audit (UNIQUE audit_id) — re-running upserts.
--
--   This is decision-support only: it never converts leads, creates
--   clients, contacts anyone, or changes payment. Results are written
--   only when the agent actually returns data (no fabricated results).
--
-- Safety:
--   • Additive only. Re-runnable (IF NOT EXISTS / DROP POLICY IF EXISTS).
--   • New table only. audit_submissions / admin_leads / admin_clients /
--     businesses are untouched.
--   • No hard delete in the app. RLS: founder_admin via is_founder_admin();
--     server actions use the service-role client.
-- ════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.admin_pipeline_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.admin_audit_ai_results (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id                 uuid NOT NULL UNIQUE REFERENCES public.audit_submissions(id) ON DELETE CASCADE,

  business_summary         text,
  fit_score                integer,
  urgency_score            integer,
  lead_priority            text,
  recommended_offer        text,
  automation_opportunities jsonb NOT NULL DEFAULT '[]',
  missing_information      jsonb NOT NULL DEFAULT '[]',
  suggested_next_action    text,
  founder_notes            text,
  raw_agent_response       jsonb,

  status                   text NOT NULL DEFAULT 'completed',
  error_message            text,

  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT admin_audit_ai_results_status_check CHECK (status IN ('running', 'completed', 'failed')),
  CONSTRAINT admin_audit_ai_results_fit_check     CHECK (fit_score     IS NULL OR (fit_score     >= 0 AND fit_score     <= 100)),
  CONSTRAINT admin_audit_ai_results_urgency_check CHECK (urgency_score IS NULL OR (urgency_score >= 0 AND urgency_score <= 100)),
  CONSTRAINT admin_audit_ai_results_priority_check CHECK (
    lead_priority IS NULL OR lead_priority IN ('low', 'medium', 'high', 'urgent')
  ),
  CONSTRAINT admin_audit_ai_results_offer_check CHECK (
    recommended_offer IS NULL OR recommended_offer IN ('Starter', 'Booking OS', 'Ops Center', 'Custom')
  )
);

COMMENT ON TABLE public.admin_audit_ai_results IS 'Manual Relevance AI analysis results per audit submission. Decision-support only — no auto-conversion/outreach.';

CREATE INDEX IF NOT EXISTS admin_audit_ai_results_audit_idx ON public.admin_audit_ai_results (audit_id);

DROP TRIGGER IF EXISTS admin_audit_ai_results_set_updated_at ON public.admin_audit_ai_results;
CREATE TRIGGER admin_audit_ai_results_set_updated_at
  BEFORE UPDATE ON public.admin_audit_ai_results
  FOR EACH ROW EXECUTE FUNCTION public.admin_pipeline_set_updated_at();

-- ── Row Level Security — founder_admin only ────────────────────────
ALTER TABLE public.admin_audit_ai_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_ai_results FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS aar_select_founder_admin ON public.admin_audit_ai_results;
DROP POLICY IF EXISTS aar_insert_founder_admin ON public.admin_audit_ai_results;
DROP POLICY IF EXISTS aar_update_founder_admin ON public.admin_audit_ai_results;
DROP POLICY IF EXISTS aar_delete_founder_admin ON public.admin_audit_ai_results;

CREATE POLICY aar_select_founder_admin ON public.admin_audit_ai_results
  FOR SELECT TO authenticated USING (public.is_founder_admin());
CREATE POLICY aar_insert_founder_admin ON public.admin_audit_ai_results
  FOR INSERT TO authenticated WITH CHECK (public.is_founder_admin());
CREATE POLICY aar_update_founder_admin ON public.admin_audit_ai_results
  FOR UPDATE TO authenticated USING (public.is_founder_admin()) WITH CHECK (public.is_founder_admin());
CREATE POLICY aar_delete_founder_admin ON public.admin_audit_ai_results
  FOR DELETE TO authenticated USING (public.is_founder_admin());
