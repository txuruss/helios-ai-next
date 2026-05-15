-- ============================================================
-- HELIOS AI — Phase 8: Relevance AI agent infrastructure
-- FULLY IDEMPOTENT — safe to run multiple times.
--
-- Key fixes vs original:
--   * Partial unique index prevents duplicate seeded agents on re-run.
--   * All triggers wrapped in IF NOT EXISTS checks.
--   * status only uses allowed values (idle/running/completed/error/degraded).
--   * No status = 'active' anywhere.
--
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── 1. helios_agents ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.helios_agents (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id         uuid REFERENCES public.businesses ON DELETE CASCADE,
  name                text NOT NULL,
  description         text,
  category            text,
  relevance_agent_id  text,
  -- Runtime state only. Allowed: idle, running, completed, error, degraded.
  -- 'active' is NOT valid and will violate the constraint.
  status              text NOT NULL DEFAULT 'idle'
                      CHECK (status IN ('idle', 'running', 'completed', 'error', 'degraded')),
  is_enabled          boolean NOT NULL DEFAULT true,
  required_plan       text NOT NULL DEFAULT 'starter'
                      CHECK (required_plan IN ('starter', 'pro', 'scale')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Partial unique index: prevents duplicate global agents on re-run.
-- ON CONFLICT DO NOTHING in the seed INSERT will match this index.
CREATE UNIQUE INDEX IF NOT EXISTS helios_agents_global_name_idx
  ON public.helios_agents (name)
  WHERE business_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'helios_agents_updated_at'
      AND tgrelid = 'public.helios_agents'::regclass
  ) THEN
    CREATE TRIGGER helios_agents_updated_at
      BEFORE UPDATE ON public.helios_agents
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

-- ── 2. relevance_workforces ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.relevance_workforces (
  id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id             uuid REFERENCES public.businesses ON DELETE CASCADE,
  name                    text NOT NULL,
  description             text,
  relevance_workforce_id  text,
  status                  text NOT NULL DEFAULT 'idle',
  is_enabled              boolean NOT NULL DEFAULT true,
  required_plan           text NOT NULL DEFAULT 'pro'
                          CHECK (required_plan IN ('starter', 'pro', 'scale')),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS relevance_workforces_global_name_idx
  ON public.relevance_workforces (name)
  WHERE business_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'relevance_workforces_updated_at'
      AND tgrelid = 'public.relevance_workforces'::regclass
  ) THEN
    CREATE TRIGGER relevance_workforces_updated_at
      BEFORE UPDATE ON public.relevance_workforces
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

-- ── 3. agent_runs ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.agent_runs (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id      uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  agent_id         uuid REFERENCES public.helios_agents ON DELETE SET NULL,
  workforce_id     uuid REFERENCES public.relevance_workforces ON DELETE SET NULL,
  provider_run_id  text,
  run_type         text NOT NULL DEFAULT 'agent'
                   CHECK (run_type IN ('agent', 'workforce')),
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  input_summary    text,
  output_summary   text,
  error_message    text,
  started_at       timestamptz NOT NULL DEFAULT now(),
  completed_at     timestamptz,
  metadata         jsonb NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'agent_runs_updated_at'
      AND tgrelid = 'public.agent_runs'::regclass
  ) THEN
    CREATE TRIGGER agent_runs_updated_at
      BEFORE UPDATE ON public.agent_runs
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS agent_runs_business_idx
  ON public.agent_runs (business_id, created_at DESC);

-- ── 4. agent_run_logs ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.agent_run_logs (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id    uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  agent_run_id   uuid NOT NULL REFERENCES public.agent_runs ON DELETE CASCADE,
  level          text NOT NULL DEFAULT 'info'
                 CHECK (level IN ('info', 'warn', 'error', 'debug')),
  message        text NOT NULL,
  metadata       jsonb NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_run_logs_run_idx
  ON public.agent_run_logs (agent_run_id, created_at);

-- ── 5. agent_outputs ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.agent_outputs (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id   uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  agent_run_id  uuid NOT NULL REFERENCES public.agent_runs ON DELETE CASCADE,
  output_type   text NOT NULL DEFAULT 'text',
  title         text,
  content       text,
  status        text NOT NULL DEFAULT 'pending_review'
                CHECK (status IN ('pending_review', 'approved', 'rejected', 'archived')),
  metadata      jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'agent_outputs_updated_at'
      AND tgrelid = 'public.agent_outputs'::regclass
  ) THEN
    CREATE TRIGGER agent_outputs_updated_at
      BEFORE UPDATE ON public.agent_outputs
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS agent_outputs_run_idx
  ON public.agent_outputs (agent_run_id);

-- ── 6. agent_recommendations ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.agent_recommendations (
  id                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id          uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  agent_run_id         uuid REFERENCES public.agent_runs ON DELETE SET NULL,
  title                text NOT NULL,
  description          text,
  recommendation_type  text NOT NULL DEFAULT 'general',
  priority             text NOT NULL DEFAULT 'medium'
                       CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status               text NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  metadata             jsonb NOT NULL DEFAULT '{}',
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'agent_recommendations_updated_at'
      AND tgrelid = 'public.agent_recommendations'::regclass
  ) THEN
    CREATE TRIGGER agent_recommendations_updated_at
      BEFORE UPDATE ON public.agent_recommendations
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

-- ── 7. RLS ────────────────────────────────────────────────────────

ALTER TABLE public.helios_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relevance_workforces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_run_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_recommendations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='helios_agents' AND policyname='helios_agents: read global and own') THEN
    CREATE POLICY "helios_agents: read global and own" ON public.helios_agents FOR SELECT
      USING (business_id IS NULL OR public.is_business_member(business_id));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='relevance_workforces' AND policyname='relevance_workforces: read global and own') THEN
    CREATE POLICY "relevance_workforces: read global and own" ON public.relevance_workforces FOR SELECT
      USING (business_id IS NULL OR public.is_business_member(business_id));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='agent_runs' AND policyname='agent_runs: members read') THEN
    CREATE POLICY "agent_runs: members read" ON public.agent_runs FOR SELECT USING (public.is_business_member(business_id));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='agent_run_logs' AND policyname='agent_run_logs: members read') THEN
    CREATE POLICY "agent_run_logs: members read" ON public.agent_run_logs FOR SELECT USING (public.is_business_member(business_id));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='agent_outputs' AND policyname='agent_outputs: members read') THEN
    CREATE POLICY "agent_outputs: members read" ON public.agent_outputs FOR SELECT USING (public.is_business_member(business_id));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='agent_outputs' AND policyname='agent_outputs: members update status') THEN
    CREATE POLICY "agent_outputs: members update status" ON public.agent_outputs FOR UPDATE USING (public.is_business_member(business_id));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='agent_recommendations' AND policyname='agent_recommendations: members read') THEN
    CREATE POLICY "agent_recommendations: members read" ON public.agent_recommendations FOR SELECT USING (public.is_business_member(business_id));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='agent_recommendations' AND policyname='agent_recommendations: members update') THEN
    CREATE POLICY "agent_recommendations: members update" ON public.agent_recommendations FOR UPDATE USING (public.is_business_member(business_id));
  END IF;
END $$;

-- ── 8. Seed global agent definitions ─────────────────────────────
-- business_id is omitted so it defaults to NULL (global).
-- status is omitted so it defaults to 'idle' — the only valid initial state.
-- ON CONFLICT DO NOTHING matches the partial unique index on (name)
-- WHERE business_id IS NULL, making this INSERT fully idempotent.

INSERT INTO public.helios_agents (name, description, category, relevance_agent_id, required_plan) VALUES
  ('Orchestrator Agent',          'Routes tasks to specialized agents and manages the full workflow queue.',       'core',      null, 'starter'),
  ('Business Research Agent',     'Researches prospect businesses, services, online presence, and competition.',   'research',  null, 'starter'),
  ('Website Audit Agent',         'Audits client websites for lead capture gaps, booking flow, and SEO.',          'research',  null, 'starter'),
  ('Client Qualifier Agent',      'Scores inbound leads by business type, budget, and system fit.',                'sales',     null, 'starter'),
  ('Sales Offer Builder Agent',   'Builds personalised proposals and system packages for qualified prospects.',    'sales',     null, 'pro'),
  ('Proposal Generator Agent',    'Creates detailed project proposals with pricing, timeline, and deliverables.',  'sales',     null, 'pro'),
  ('Content & Outreach Agent',    'Generates follow-up emails, DMs, and outreach sequences.',                     'content',   null, 'starter'),
  ('Onboarding Agent',            'Guides new clients through the system onboarding flow.',                        'delivery',  null, 'pro'),
  ('Knowledge Base Builder',      'Builds the AI knowledge base from business FAQs and content.',                  'delivery',  null, 'starter'),
  ('Booking System Builder',      'Configures and tests the AI booking flow for a business.',                      'delivery',  null, 'pro'),
  ('Workflow Builder Agent',      'Designs and implements automated business workflows.',                           'delivery',  null, 'pro'),
  ('Delivery QA Agent',           'Checks client builds before launch and runs post-optimisation quality audits.', 'delivery',  null, 'starter'),
  ('Client Handoff Agent',        'Manages the handoff process from setup to live operations.',                    'delivery',  null, 'pro'),
  ('WhatsApp Assistant Agent',    'Manages WhatsApp business automation and conversation flows.',                   'comms',     null, 'scale'),
  ('Content Creation Agent',      'Creates marketing content, social posts, and email copy.',                      'content',   null, 'starter'),
  ('Social Media Scheduler',      'Schedules and manages social media content across platforms.',                   'content',   null, 'pro'),
  ('Analytics & Optimization',    'Analyses system performance and recommends improvements.',                       'analytics', null, 'pro'),
  ('Follow-Up Automation Agent',  'Automates lead follow-up sequences based on behaviour triggers.',                'sales',     null, 'pro')
ON CONFLICT DO NOTHING;

INSERT INTO public.relevance_workforces (name, description, relevance_workforce_id, required_plan) VALUES
  ('Client Acquisition Workforce', 'Full client acquisition pipeline: research → qualify → propose → close.', null, 'pro'),
  ('Delivery Workforce',           'End-to-end delivery: onboard → build → QA → handoff.',                   null, 'pro'),
  ('Content Workforce',            'Content creation, scheduling, and distribution pipeline.',                 null, 'scale'),
  ('Analytics Workforce',          'System performance analysis and optimisation recommendations.',             null, 'scale')
ON CONFLICT DO NOTHING;
