-- ============================================================
-- HELIOS AI — Phase 18: Cron Verification, Template Test Email,
--   Preview History Export, Cron Pagination, Live Preview, FTS
-- Idempotent migration — safe to run multiple times.
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── 1. ops_notification_previews: export + rendering tracking ────

alter table public.ops_notification_previews
  add column if not exists exported_at              timestamptz,
  add column if not exists export_format            text,
  add column if not exists preview_hash             text,
  add column if not exists rendered_with_template   boolean not null default false;

-- ── 2. ops_cron_runs: verification tracking ───────────────────────

alter table public.ops_cron_runs
  add column if not exists verification_method  text,
  add column if not exists request_source       text,
  add column if not exists page_context         jsonb not null default '{}';

-- ── 3. ops_notification_rules: template preview tracking ─────────

alter table public.ops_notification_rules
  add column if not exists last_template_preview              text,
  add column if not exists last_template_previewed_at         timestamptz,
  add column if not exists last_test_rendered_with_template   boolean not null default false,
  add column if not exists resolved_recipient_count           integer not null default 0;

-- ── 4. ops_exports: source tracking ──────────────────────────────

alter table public.ops_exports
  add column if not exists source_table     text,
  add column if not exists source_export_id uuid;

-- ── 5. FTS on ops_audit_trail ─────────────────────────────────────

alter table public.ops_audit_trail
  add column if not exists search_vector tsvector;

create or replace function public.ops_audit_trail_search_update()
returns trigger language plpgsql as $$
begin
  new.search_vector := to_tsvector('english',
    coalesce(new.action, '') || ' ' ||
    coalesce(new.target_table, '')
  );
  return new;
end;
$$;

drop trigger if exists ops_audit_trail_search_trigger on public.ops_audit_trail;
create trigger ops_audit_trail_search_trigger
  before insert or update on public.ops_audit_trail
  for each row execute function public.ops_audit_trail_search_update();

update public.ops_audit_trail set search_vector = to_tsvector('english',
  coalesce(action, '') || ' ' ||
  coalesce(target_table, '')
) where search_vector is null;

-- ── 6. FTS on ops_exports ─────────────────────────────────────────

alter table public.ops_exports
  add column if not exists search_vector tsvector;

create or replace function public.ops_exports_search_update()
returns trigger language plpgsql as $$
begin
  new.search_vector := to_tsvector('english',
    coalesce(new.export_type, '') || ' ' ||
    coalesce(new.format, '') || ' ' ||
    coalesce(new.status, '') || ' ' ||
    coalesce(new.source_table, '')
  );
  return new;
end;
$$;

drop trigger if exists ops_exports_search_trigger on public.ops_exports;
create trigger ops_exports_search_trigger
  before insert or update on public.ops_exports
  for each row execute function public.ops_exports_search_update();

update public.ops_exports set search_vector = to_tsvector('english',
  coalesce(export_type, '') || ' ' ||
  coalesce(format, '') || ' ' ||
  coalesce(status, '') || ' ' ||
  coalesce(source_table, '')
) where search_vector is null;

-- ── 7. FTS on ops_notification_previews ──────────────────────────

alter table public.ops_notification_previews
  add column if not exists search_vector tsvector;

create or replace function public.ops_notification_previews_search_update()
returns trigger language plpgsql as $$
begin
  new.search_vector := to_tsvector('english',
    coalesce(new.preview_type, '') || ' ' ||
    coalesce(new.source_rule_name, '')
  );
  return new;
end;
$$;

drop trigger if exists ops_notification_previews_search_trigger on public.ops_notification_previews;
create trigger ops_notification_previews_search_trigger
  before insert or update on public.ops_notification_previews
  for each row execute function public.ops_notification_previews_search_update();

update public.ops_notification_previews set search_vector = to_tsvector('english',
  coalesce(preview_type, '') || ' ' ||
  coalesce(source_rule_name, '')
) where search_vector is null;

-- ── 8. FTS on ops_cron_runs ───────────────────────────────────────

alter table public.ops_cron_runs
  add column if not exists search_vector tsvector;

create or replace function public.ops_cron_runs_search_update()
returns trigger language plpgsql as $$
begin
  new.search_vector := to_tsvector('english',
    coalesce(new.job_name, '') || ' ' ||
    coalesce(new.status, '') || ' ' ||
    coalesce(new.trigger_source, '') || ' ' ||
    coalesce(new.verification_method, '')
  );
  return new;
end;
$$;

drop trigger if exists ops_cron_runs_search_trigger on public.ops_cron_runs;
create trigger ops_cron_runs_search_trigger
  before insert or update on public.ops_cron_runs
  for each row execute function public.ops_cron_runs_search_update();

update public.ops_cron_runs set search_vector = to_tsvector('english',
  coalesce(job_name, '') || ' ' ||
  coalesce(status, '') || ' ' ||
  coalesce(trigger_source, '') || ' ' ||
  coalesce(verification_method, '')
) where search_vector is null;

-- ── 9. GIN indexes ────────────────────────────────────────────────

create index if not exists ops_audit_trail_search_idx
  on public.ops_audit_trail using gin (search_vector);

create index if not exists ops_exports_search_idx
  on public.ops_exports using gin (search_vector);

create index if not exists ops_notification_previews_search_idx
  on public.ops_notification_previews using gin (search_vector);

create index if not exists ops_cron_runs_search_idx
  on public.ops_cron_runs using gin (search_vector);

-- Composite access indexes
create index if not exists ops_notification_previews_business_created_idx
  on public.ops_notification_previews (business_id, created_at desc);

create index if not exists ops_notification_previews_business_exported_idx
  on public.ops_notification_previews (business_id, exported_at)
  where exported_at is not null;

create index if not exists ops_cron_runs_business_started_idx
  on public.ops_cron_runs (business_id, started_at desc);

create index if not exists ops_cron_runs_business_status_idx
  on public.ops_cron_runs (business_id, status);

create index if not exists ops_exports_business_source_created_idx
  on public.ops_exports (business_id, source_table, created_at desc)
  where source_table is not null;

-- ── 10. RLS policies ──────────────────────────────────────────────
-- Safe to rerun — uses CREATE POLICY IF NOT EXISTS pattern via DO block

do $$
begin
  -- ops_notification_previews: members read own
  if not exists (
    select 1 from pg_policies
    where tablename = 'ops_notification_previews'
      and policyname = 'members_read_own_notification_previews'
  ) then
    execute $p$
      create policy members_read_own_notification_previews
        on public.ops_notification_previews for select
        using (is_business_member(business_id))
    $p$;
  end if;

  -- ops_notification_previews: service role insert
  if not exists (
    select 1 from pg_policies
    where tablename = 'ops_notification_previews'
      and policyname = 'service_role_insert_notification_previews'
  ) then
    execute $p$
      create policy service_role_insert_notification_previews
        on public.ops_notification_previews for insert
        with check (true)
    $p$;
  end if;

  -- ops_notification_previews: members update own (for export tracking)
  if not exists (
    select 1 from pg_policies
    where tablename = 'ops_notification_previews'
      and policyname = 'members_update_own_notification_previews'
  ) then
    execute $p$
      create policy members_update_own_notification_previews
        on public.ops_notification_previews for update
        using (is_business_member(business_id))
    $p$;
  end if;

  -- ops_cron_runs: members read own
  if not exists (
    select 1 from pg_policies
    where tablename = 'ops_cron_runs'
      and policyname = 'members_read_own_cron_runs'
  ) then
    execute $p$
      create policy members_read_own_cron_runs
        on public.ops_cron_runs for select
        using (business_id is null or is_business_member(business_id))
    $p$;
  end if;

  -- ops_cron_runs: service role insert
  if not exists (
    select 1 from pg_policies
    where tablename = 'ops_cron_runs'
      and policyname = 'service_role_insert_cron_runs'
  ) then
    execute $p$
      create policy service_role_insert_cron_runs
        on public.ops_cron_runs for insert
        with check (true)
    $p$;
  end if;

  -- ops_exports: members read own
  if not exists (
    select 1 from pg_policies
    where tablename = 'ops_exports'
      and policyname = 'members_read_own_exports'
  ) then
    execute $p$
      create policy members_read_own_exports
        on public.ops_exports for select
        using (is_business_member(business_id))
    $p$;
  end if;

end;
$$;
