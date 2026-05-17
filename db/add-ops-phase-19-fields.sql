-- ============================================================
-- HELIOS AI — Phase 19: Notification Delivery Logs,
--   Webhook Observability, Retry Controls, Delay Scheduling
-- Idempotent migration — safe to run multiple times.
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── 1. notification_delivery_logs ────────────────────────────────

create table if not exists public.notification_delivery_logs (
  id                   uuid primary key default gen_random_uuid(),
  business_id          uuid,
  notification_rule_id uuid,
  notification_preview_id uuid,
  target_table         text,
  target_id            uuid,
  recipient_type       text,
  recipient_masked     text,
  delivery_channel     text not null default 'email',
  delivery_status      text not null default 'pending',
  provider             text not null default 'resend',
  provider_message_id  text,
  attempt_count        integer not null default 0,
  last_attempt_at      timestamptz,
  next_retry_at        timestamptz,
  scheduled_for        timestamptz,
  sent_at              timestamptz,
  failed_at            timestamptz,
  error_summary        text,
  subject_hash         text,
  body_hash            text,
  search_vector        tsvector,
  metadata             jsonb not null default '{}',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Add any missing columns (idempotent)
alter table public.notification_delivery_logs
  add column if not exists notification_preview_id uuid,
  add column if not exists scheduled_for           timestamptz,
  add column if not exists search_vector           tsvector;

-- FTS trigger for delivery logs
create or replace function public.notification_delivery_logs_search_update()
returns trigger language plpgsql as $$
begin
  new.search_vector := to_tsvector('english',
    coalesce(new.recipient_type, '') || ' ' ||
    coalesce(new.delivery_status, '') || ' ' ||
    coalesce(new.provider, '') || ' ' ||
    coalesce(new.error_summary, '')
  );
  return new;
end;
$$;

drop trigger if exists notification_delivery_logs_search_trigger on public.notification_delivery_logs;
create trigger notification_delivery_logs_search_trigger
  before insert or update on public.notification_delivery_logs
  for each row execute function public.notification_delivery_logs_search_update();

-- ── 2. webhook_delivery_logs ──────────────────────────────────────

create table if not exists public.webhook_delivery_logs (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid,
  provider            text not null,
  route_path          text not null,
  event_type          text,
  verification_status text,
  processing_status   text not null default 'received',
  status_code         integer,
  duration_ms         integer,
  request_id          text,
  external_event_id   text,
  error_summary       text,
  safe_summary        text,
  search_vector       tsvector,
  metadata            jsonb not null default '{}',
  received_at         timestamptz not null default now(),
  processed_at        timestamptz
);

-- Add missing columns (idempotent)
alter table public.webhook_delivery_logs
  add column if not exists search_vector tsvector;

-- FTS trigger for webhook logs
create or replace function public.webhook_delivery_logs_search_update()
returns trigger language plpgsql as $$
begin
  new.search_vector := to_tsvector('english',
    coalesce(new.provider, '') || ' ' ||
    coalesce(new.route_path, '') || ' ' ||
    coalesce(new.event_type, '') || ' ' ||
    coalesce(new.processing_status, '') || ' ' ||
    coalesce(new.verification_status, '') || ' ' ||
    coalesce(new.safe_summary, '')
  );
  return new;
end;
$$;

drop trigger if exists webhook_delivery_logs_search_trigger on public.webhook_delivery_logs;
create trigger webhook_delivery_logs_search_trigger
  before insert or update on public.webhook_delivery_logs
  for each row execute function public.webhook_delivery_logs_search_update();

-- ── 3. Update ops_notification_rules ─────────────────────────────

alter table public.ops_notification_rules
  add column if not exists max_retry_attempts   integer not null default 3,
  add column if not exists retry_backoff_minutes integer not null default 10,
  add column if not exists notify_on_failure     boolean not null default true;

-- ── 4. Update ops_notification_previews ──────────────────────────

alter table public.ops_notification_previews
  add column if not exists delivery_log_id uuid;

-- ── 5. Update ops_exports ─────────────────────────────────────────

alter table public.ops_exports
  add column if not exists export_panel_source text;

-- ── 6. Indexes ────────────────────────────────────────────────────

create index if not exists notification_delivery_logs_business_created_idx
  on public.notification_delivery_logs (business_id, created_at desc);

create index if not exists notification_delivery_logs_business_status_idx
  on public.notification_delivery_logs (business_id, delivery_status);

create index if not exists notification_delivery_logs_business_retry_idx
  on public.notification_delivery_logs (business_id, next_retry_at)
  where next_retry_at is not null;

create index if not exists notification_delivery_logs_rule_created_idx
  on public.notification_delivery_logs (notification_rule_id, created_at desc)
  where notification_rule_id is not null;

create index if not exists notification_delivery_logs_search_idx
  on public.notification_delivery_logs using gin (search_vector);

create index if not exists webhook_delivery_logs_business_received_idx
  on public.webhook_delivery_logs (business_id, received_at desc);

create index if not exists webhook_delivery_logs_provider_received_idx
  on public.webhook_delivery_logs (provider, received_at desc);

create index if not exists webhook_delivery_logs_processing_status_idx
  on public.webhook_delivery_logs (processing_status, received_at desc);

create index if not exists webhook_delivery_logs_verification_idx
  on public.webhook_delivery_logs (verification_status, received_at desc);

create index if not exists webhook_delivery_logs_external_event_idx
  on public.webhook_delivery_logs (external_event_id)
  where external_event_id is not null;

create index if not exists webhook_delivery_logs_search_idx
  on public.webhook_delivery_logs using gin (search_vector);

create index if not exists ops_cron_runs_business_started_idx2
  on public.ops_cron_runs (business_id, started_at desc);

create index if not exists ops_exports_business_created_idx
  on public.ops_exports (business_id, created_at desc);

-- ── 7. RLS policies ───────────────────────────────────────────────

do $$
begin
  -- notification_delivery_logs: members read own
  if not exists (
    select 1 from pg_policies
    where tablename = 'notification_delivery_logs'
      and policyname = 'members_read_own_delivery_logs'
  ) then
    execute $p$
      create policy members_read_own_delivery_logs
        on public.notification_delivery_logs for select
        using (business_id is null or is_business_member(business_id))
    $p$;
  end if;

  -- notification_delivery_logs: service role insert/update
  if not exists (
    select 1 from pg_policies
    where tablename = 'notification_delivery_logs'
      and policyname = 'service_role_manage_delivery_logs'
  ) then
    execute $p$
      create policy service_role_manage_delivery_logs
        on public.notification_delivery_logs for all
        using (true) with check (true)
    $p$;
  end if;

  -- webhook_delivery_logs: members read own
  if not exists (
    select 1 from pg_policies
    where tablename = 'webhook_delivery_logs'
      and policyname = 'members_read_own_webhook_logs'
  ) then
    execute $p$
      create policy members_read_own_webhook_logs
        on public.webhook_delivery_logs for select
        using (business_id is null or is_business_member(business_id))
    $p$;
  end if;

  -- webhook_delivery_logs: service role insert/update
  if not exists (
    select 1 from pg_policies
    where tablename = 'webhook_delivery_logs'
      and policyname = 'service_role_manage_webhook_logs'
  ) then
    execute $p$
      create policy service_role_manage_webhook_logs
        on public.webhook_delivery_logs for all
        using (true) with check (true)
    $p$;
  end if;

end;
$$;

-- Enable RLS on new tables
alter table public.notification_delivery_logs enable row level security;
alter table public.webhook_delivery_logs       enable row level security;
