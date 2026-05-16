-- ============================================================
-- HELIOS AI — Phase 17: Notification UI, FTS, Cron Hardening
-- Idempotent migration — safe to run multiple times.
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── 1. ops_notification_rules: preview + template tracking ───

alter table public.ops_notification_rules
  add column if not exists preview_enabled      boolean not null default true,
  add column if not exists template_variables   jsonb   not null default '{}',
  add column if not exists last_previewed_at    timestamptz,
  add column if not exists last_dry_run_at      timestamptz,
  add column if not exists last_dry_run_status  text,
  add column if not exists last_dry_run_error   text;

-- ── 2. ops_notification_previews: enhanced fields ─────────────

alter table public.ops_notification_previews
  add column if not exists dry_run_status     text,
  add column if not exists source_rule_name   text,
  add column if not exists template_variables jsonb not null default '{}';

-- ── 3. ops_cron_runs: enhanced tracking ──────────────────────

alter table public.ops_cron_runs
  add column if not exists duration_ms        integer,
  add column if not exists trigger_source     text,
  add column if not exists cron_secret_type   text,
  add column if not exists businesses_checked integer not null default 0,
  add column if not exists skipped_count      integer not null default 0;

-- ── 4. Full-text search vectors ───────────────────────────────
-- Only index safe, non-PII text columns (title, description, message, action, etc.)

-- ops_events search vector
alter table public.ops_events
  add column if not exists search_vector tsvector;

create or replace function public.ops_events_search_update()
returns trigger language plpgsql as $$
begin
  new.search_vector := to_tsvector('english',
    coalesce(new.title, '') || ' ' ||
    coalesce(new.description, '') || ' ' ||
    coalesce(new.event_type, '') || ' ' ||
    coalesce(new.source, '')
  );
  return new;
end;
$$;

drop trigger if exists ops_events_search_trigger on public.ops_events;
create trigger ops_events_search_trigger
  before insert or update on public.ops_events
  for each row execute function public.ops_events_search_update();

-- Back-fill existing rows
update public.ops_events set search_vector = to_tsvector('english',
  coalesce(title, '') || ' ' ||
  coalesce(description, '') || ' ' ||
  coalesce(event_type, '') || ' ' ||
  coalesce(source, '')
) where search_vector is null;

-- ops_alerts search vector
alter table public.ops_alerts
  add column if not exists search_vector tsvector;

create or replace function public.ops_alerts_search_update()
returns trigger language plpgsql as $$
begin
  new.search_vector := to_tsvector('english',
    coalesce(new.title, '') || ' ' ||
    coalesce(new.message, '') || ' ' ||
    coalesce(new.alert_type, '')
  );
  return new;
end;
$$;

drop trigger if exists ops_alerts_search_trigger on public.ops_alerts;
create trigger ops_alerts_search_trigger
  before insert or update on public.ops_alerts
  for each row execute function public.ops_alerts_search_update();

update public.ops_alerts set search_vector = to_tsvector('english',
  coalesce(title, '') || ' ' ||
  coalesce(message, '') || ' ' ||
  coalesce(alert_type, '')
) where search_vector is null;

-- ops_tasks search vector
alter table public.ops_tasks
  add column if not exists search_vector tsvector;

create or replace function public.ops_tasks_search_update()
returns trigger language plpgsql as $$
begin
  new.search_vector := to_tsvector('english',
    coalesce(new.title, '') || ' ' ||
    coalesce(new.description, '') || ' ' ||
    coalesce(new.task_type, '')
  );
  return new;
end;
$$;

drop trigger if exists ops_tasks_search_trigger on public.ops_tasks;
create trigger ops_tasks_search_trigger
  before insert or update on public.ops_tasks
  for each row execute function public.ops_tasks_search_update();

update public.ops_tasks set search_vector = to_tsvector('english',
  coalesce(title, '') || ' ' ||
  coalesce(description, '') || ' ' ||
  coalesce(task_type, '')
) where search_vector is null;

-- approval_items search vector
alter table public.approval_items
  add column if not exists search_vector tsvector;

create or replace function public.approval_items_search_update()
returns trigger language plpgsql as $$
begin
  new.search_vector := to_tsvector('english',
    coalesce(new.title, '') || ' ' ||
    coalesce(new.description, '') || ' ' ||
    coalesce(new.approval_type, '')
  );
  return new;
end;
$$;

drop trigger if exists approval_items_search_trigger on public.approval_items;
create trigger approval_items_search_trigger
  before insert or update on public.approval_items
  for each row execute function public.approval_items_search_update();

update public.approval_items set search_vector = to_tsvector('english',
  coalesce(title, '') || ' ' ||
  coalesce(description, '') || ' ' ||
  coalesce(approval_type, '')
) where search_vector is null;

-- ── 5. GIN indexes for FTS ────────────────────────────────────

create index if not exists ops_events_fts_idx
  on public.ops_events using gin(search_vector);

create index if not exists ops_alerts_fts_idx
  on public.ops_alerts using gin(search_vector);

create index if not exists ops_tasks_fts_idx
  on public.ops_tasks using gin(search_vector);

create index if not exists approval_items_fts_idx
  on public.approval_items using gin(search_vector);

-- ── 6. Cron run indexes ───────────────────────────────────────

create index if not exists ops_cron_runs_status_idx
  on public.ops_cron_runs (status, started_at desc);

create index if not exists ops_notification_previews_rule_idx
  on public.ops_notification_previews (notification_rule_id, created_at desc)
  where notification_rule_id is not null;
