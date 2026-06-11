-- ════════════════════════════════════════════════════════════════════
-- Retainer tracking on admin_clients (setup fee + monthly retainer model)
-- ════════════════════════════════════════════════════════════════════
--
-- Purpose:
--   Support the core business model — Audit → Setup Project → Monthly
--   Retainer — by tracking each client's retainer state, the next
--   monthly review date, and when the last monthly optimization report
--   was delivered. Drives the Mission Control "Retainer Health" panel
--   and the client workspace retainer section.
--
-- Field semantics:
--   • retainer_status — the RETAINER relationship (active / paused /
--     cancelled / needs_review). Distinct from admin_clients.status,
--     which is the overall client lifecycle.
--   • next_review_date — when the next monthly review/report is due.
--   • last_report_date — when the last monthly optimization report
--     was sent (docs/templates/monthly-optimization-report.md).
--
-- Safety:
--   • Additive + idempotent: ADD COLUMN IF NOT EXISTS. Safe to re-run.
--   • No data destroyed; no existing column or RLS policy changed.
--   • Existing AND new rows default to retainer_status='needs_review' —
--     a retainer is only counted as Active after the founder explicitly
--     confirms it in the client drawer. Legacy clients are never silently
--     marked as active retainers.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE public.admin_clients
  ADD COLUMN IF NOT EXISTS retainer_status text NOT NULL DEFAULT 'needs_review';

-- Converge the default on re-runs (in case an earlier version was applied).
ALTER TABLE public.admin_clients
  ALTER COLUMN retainer_status SET DEFAULT 'needs_review';

-- Refresh the CHECK so re-running upgrades older databases too.
ALTER TABLE public.admin_clients
  DROP CONSTRAINT IF EXISTS admin_clients_retainer_status_check;
ALTER TABLE public.admin_clients
  ADD CONSTRAINT admin_clients_retainer_status_check CHECK (
    retainer_status IN ('active', 'paused', 'cancelled', 'needs_review')
  );

ALTER TABLE public.admin_clients
  ADD COLUMN IF NOT EXISTS next_review_date date;
ALTER TABLE public.admin_clients
  ADD COLUMN IF NOT EXISTS last_report_date date;

COMMENT ON COLUMN public.admin_clients.retainer_status IS
  'Monthly retainer state: active | paused | cancelled | needs_review. Defaults to needs_review — set to active only when explicitly confirmed. Distinct from the client lifecycle status.';
COMMENT ON COLUMN public.admin_clients.next_review_date IS
  'When the next monthly review / optimization report is due.';
COMMENT ON COLUMN public.admin_clients.last_report_date IS
  'When the last monthly optimization report was delivered.';

CREATE INDEX IF NOT EXISTS admin_clients_retainer_status_idx
  ON public.admin_clients (retainer_status);
CREATE INDEX IF NOT EXISTS admin_clients_next_review_idx
  ON public.admin_clients (next_review_date);

-- Verify after running:
--   SELECT business_name, retainer_status, next_review_date, last_report_date
--   FROM public.admin_clients ORDER BY created_at DESC LIMIT 10;
