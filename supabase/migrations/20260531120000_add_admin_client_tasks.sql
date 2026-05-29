-- ════════════════════════════════════════════════════════════════════
-- Client onboarding checklist / task tracking: admin_client_tasks
-- ════════════════════════════════════════════════════════════════════
--
-- Purpose:
--   Per-client onboarding/delivery checklist and tasks, managed from the
--   client detail drawer on /admin/clients. Default onboarding tasks are
--   seeded in app code on client conversion (idempotent) and can also be
--   created manually.
--
-- Safety:
--   • Additive only. Re-runnable (CREATE TABLE/INDEX IF NOT EXISTS,
--     DROP POLICY IF EXISTS).
--   • Creates ONE new table. businesses / audit_submissions / admin_leads
--     / admin_clients (and its sub-tables) are untouched.
--   • No hard delete in the app — task removal (if ever added) will use a
--     status/archive pattern, not DELETE.
--   • RLS mirrors admin_clients: founder_admin only via is_founder_admin();
--     server actions use the service-role client.
-- ════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Shared updated_at trigger fn (idempotent; also defined by the pipeline
-- migration — CREATE OR REPLACE keeps this file self-contained).
CREATE OR REPLACE FUNCTION public.admin_pipeline_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.admin_client_tasks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid NOT NULL REFERENCES public.admin_clients(id) ON DELETE CASCADE,
  title        text NOT NULL,
  description  text,
  category     text NOT NULL DEFAULT 'onboarding',
  status       text NOT NULL DEFAULT 'todo',
  priority     text NOT NULL DEFAULT 'normal',
  due_date     date,
  completed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT admin_client_tasks_status_check CHECK (status IN (
    'todo', 'in_progress', 'blocked', 'done'
  )),
  CONSTRAINT admin_client_tasks_priority_check CHECK (priority IN (
    'low', 'normal', 'high', 'urgent'
  )),
  CONSTRAINT admin_client_tasks_category_check CHECK (category IN (
    'onboarding', 'setup', 'automation', 'communication', 'QA', 'handoff', 'support'
  ))
);

COMMENT ON TABLE public.admin_client_tasks IS 'Per-client onboarding/delivery checklist. Founder-managed via the client detail drawer.';

CREATE INDEX IF NOT EXISTS admin_client_tasks_client_idx   ON public.admin_client_tasks (client_id, created_at);
CREATE INDEX IF NOT EXISTS admin_client_tasks_status_idx   ON public.admin_client_tasks (status);
CREATE INDEX IF NOT EXISTS admin_client_tasks_due_date_idx ON public.admin_client_tasks (due_date);

DROP TRIGGER IF EXISTS admin_client_tasks_set_updated_at ON public.admin_client_tasks;
CREATE TRIGGER admin_client_tasks_set_updated_at
  BEFORE UPDATE ON public.admin_client_tasks
  FOR EACH ROW EXECUTE FUNCTION public.admin_pipeline_set_updated_at();

-- ── Row Level Security — founder_admin only ────────────────────────
ALTER TABLE public.admin_client_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_client_tasks FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS act_select_founder_admin ON public.admin_client_tasks;
DROP POLICY IF EXISTS act_insert_founder_admin ON public.admin_client_tasks;
DROP POLICY IF EXISTS act_update_founder_admin ON public.admin_client_tasks;
DROP POLICY IF EXISTS act_delete_founder_admin ON public.admin_client_tasks;

CREATE POLICY act_select_founder_admin ON public.admin_client_tasks
  FOR SELECT TO authenticated USING (public.is_founder_admin());
CREATE POLICY act_insert_founder_admin ON public.admin_client_tasks
  FOR INSERT TO authenticated WITH CHECK (public.is_founder_admin());
CREATE POLICY act_update_founder_admin ON public.admin_client_tasks
  FOR UPDATE TO authenticated USING (public.is_founder_admin()) WITH CHECK (public.is_founder_admin());
CREATE POLICY act_delete_founder_admin ON public.admin_client_tasks
  FOR DELETE TO authenticated USING (public.is_founder_admin());
