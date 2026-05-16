-- ============================================================
-- HELIOS AI — Phase 15: Ops Rule Editing, Search, Cron
-- Idempotent migration — safe to run multiple times.
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── 1. ops_automation_rules: audit + soft delete ─────────────

alter table public.ops_automation_rules
  add column if not exists created_by       uuid references public.profiles on delete set null,
  add column if not exists updated_by       uuid references public.profiles on delete set null,
  add column if not exists deleted_at       timestamptz,
  add column if not exists last_run_at      timestamptz,
  add column if not exists last_run_status  text,
  add column if not exists last_run_error   text;

-- ── 2. ops_sla_policies: audit + soft delete ─────────────────

alter table public.ops_sla_policies
  add column if not exists created_by  uuid references public.profiles on delete set null,
  add column if not exists updated_by  uuid references public.profiles on delete set null,
  add column if not exists deleted_at  timestamptz;

-- ── 3. ops_notification_rules: audit + test tracking ─────────

alter table public.ops_notification_rules
  add column if not exists created_by       uuid references public.profiles on delete set null,
  add column if not exists updated_by       uuid references public.profiles on delete set null,
  add column if not exists deleted_at       timestamptz,
  add column if not exists last_tested_at   timestamptz,
  add column if not exists last_test_status text,
  add column if not exists last_test_error  text;

-- ── 4. ops_exports: enhanced tracking ────────────────────────

alter table public.ops_exports
  add column if not exists completed_at       timestamptz,
  add column if not exists download_format    text,
  add column if not exists sanitized_filters  jsonb not null default '{}';

-- ── 5. ops_cron_runs ─────────────────────────────────────────

create table if not exists public.ops_cron_runs (
  id               uuid primary key default uuid_generate_v4(),
  business_id      uuid references public.businesses on delete cascade,
  job_name         text not null,
  status           text not null default 'started'
                   check (status in ('started','completed','failed','skipped')),
  checked_count    integer not null default 0,
  breached_count   integer not null default 0,
  escalated_count  integer not null default 0,
  notified_count   integer not null default 0,
  error_message    text,
  metadata         jsonb not null default '{}',
  started_at       timestamptz not null default now(),
  completed_at     timestamptz
);

create index if not exists ops_cron_runs_business_idx
  on public.ops_cron_runs (business_id, started_at desc);

create index if not exists ops_cron_runs_global_idx
  on public.ops_cron_runs (started_at desc)
  where business_id is null;

alter table public.ops_cron_runs enable row level security;

drop policy if exists "Business members read cron runs" on public.ops_cron_runs;
create policy "Business members read cron runs"
  on public.ops_cron_runs for select
  using (business_id is null or public.is_business_member(business_id));

-- ── 6. Soft-delete + search indexes ──────────────────────────

create index if not exists ops_automation_rules_active_idx
  on public.ops_automation_rules (business_id, is_enabled)
  where deleted_at is null;

create index if not exists ops_sla_policies_active_idx
  on public.ops_sla_policies (business_id, is_enabled)
  where deleted_at is null;

create index if not exists ops_notification_rules_active_idx
  on public.ops_notification_rules (business_id, is_enabled)
  where deleted_at is null;

-- Search indexes for ops tables
create index if not exists ops_events_title_idx
  on public.ops_events using gin(to_tsvector('english', title))
  where business_id is not null;

create index if not exists ops_alerts_title_idx
  on public.ops_alerts using gin(to_tsvector('english', title))
  where business_id is not null;

create index if not exists ops_tasks_title_idx
  on public.ops_tasks using gin(to_tsvector('english', title))
  where business_id is not null;

create index if not exists approval_items_title_idx
  on public.approval_items using gin(to_tsvector('english', title))
  where business_id is not null;

-- Pagination support — ensure created_at ordering is fast
create index if not exists ops_exports_business_created_idx
  on public.ops_exports (business_id, created_at desc);
