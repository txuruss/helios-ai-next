-- ============================================================
-- HELIOS AI — Phase 16: Production Polish, Server Search, Snooze
-- Idempotent migration — safe to run multiple times.
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── 0. Enable pg_trgm for trigram search (safe to re-run) ────

create extension if not exists pg_trgm;

-- ── 1. ops_events: snooze + automation tracking ──────────────

alter table public.ops_events
  add column if not exists snoozed_until          timestamptz,
  add column if not exists snooze_reason          text,
  add column if not exists last_automation_run_at timestamptz,
  add column if not exists automation_status      text;

-- ── 2. ops_tasks: snooze + reminder ──────────────────────────

alter table public.ops_tasks
  add column if not exists snoozed_until       timestamptz,
  add column if not exists snooze_reason       text,
  add column if not exists last_reminder_sent_at timestamptz;

-- ── 3. ops_alerts: snooze + reminder ─────────────────────────

alter table public.ops_alerts
  add column if not exists snoozed_until       timestamptz,
  add column if not exists snooze_reason       text,
  add column if not exists last_reminder_sent_at timestamptz;

-- ── 4. approval_items: snooze + reminder ─────────────────────

alter table public.approval_items
  add column if not exists snoozed_until       timestamptz,
  add column if not exists snooze_reason       text,
  add column if not exists last_reminder_sent_at timestamptz;

-- ── 5. ops_notification_rules: template + multi-recipient ────

alter table public.ops_notification_rules
  add column if not exists email_subject_template text,
  add column if not exists email_body_template    text,
  add column if not exists dry_run_enabled        boolean not null default false,
  add column if not exists recipient_user_ids     uuid[]  not null default '{}',
  add column if not exists recipient_emails       text[]  not null default '{}';

-- ── 6. ops_notification_previews ─────────────────────────────

create table if not exists public.ops_notification_previews (
  id                   uuid primary key default uuid_generate_v4(),
  business_id          uuid not null references public.businesses on delete cascade,
  notification_rule_id uuid references public.ops_notification_rules on delete set null,
  preview_type         text not null check (preview_type in ('rule_preview','dry_run','test_email')),
  subject_preview      text not null,
  body_preview         text not null,
  recipient_preview    text,
  metadata             jsonb not null default '{}',
  created_by           uuid references public.profiles on delete set null,
  created_at           timestamptz not null default now()
);

create index if not exists ops_notification_previews_business_idx
  on public.ops_notification_previews (business_id, created_at desc);

alter table public.ops_notification_previews enable row level security;

drop policy if exists "Business members read notification previews" on public.ops_notification_previews;
create policy "Business members read notification previews"
  on public.ops_notification_previews for select
  using (public.is_business_member(business_id));

-- ── 7. ops_launch_checks ─────────────────────────────────────

create table if not exists public.ops_launch_checks (
  id               uuid primary key default uuid_generate_v4(),
  business_id      uuid not null references public.businesses on delete cascade,
  check_key        text not null,
  category         text not null,
  title            text not null,
  description      text,
  status           text not null default 'pending'
                   check (status in ('pending','passed','warning','failed','skipped')),
  severity         text not null default 'normal'
                   check (severity in ('low','normal','high','critical')),
  result_summary   text,
  last_checked_at  timestamptz,
  metadata         jsonb not null default '{}',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create unique index if not exists ops_launch_checks_key_idx
  on public.ops_launch_checks (business_id, check_key);

create index if not exists ops_launch_checks_business_idx
  on public.ops_launch_checks (business_id, status, severity);

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'ops_launch_checks_updated_at') then
    create trigger ops_launch_checks_updated_at
      before update on public.ops_launch_checks
      for each row execute function public.handle_updated_at();
  end if;
end $$;

alter table public.ops_launch_checks enable row level security;

drop policy if exists "Business members read launch checks" on public.ops_launch_checks;
drop policy if exists "Business members manage launch checks" on public.ops_launch_checks;
create policy "Business members read launch checks"
  on public.ops_launch_checks for select
  using (public.is_business_member(business_id));
create policy "Business members manage launch checks"
  on public.ops_launch_checks for all
  using (public.is_business_member(business_id));

-- ── 8. GIN trigram indexes for server-side search ────────────

-- ops_events
create index if not exists ops_events_title_trgm_idx
  on public.ops_events using gin(title gin_trgm_ops)
  where business_id is not null;

-- ops_alerts
create index if not exists ops_alerts_title_trgm_idx
  on public.ops_alerts using gin(title gin_trgm_ops)
  where business_id is not null;

-- ops_tasks
create index if not exists ops_tasks_title_trgm_idx
  on public.ops_tasks using gin(title gin_trgm_ops)
  where business_id is not null;

-- approval_items
create index if not exists approval_items_title_trgm_idx
  on public.approval_items using gin(title gin_trgm_ops)
  where business_id is not null;

-- ── 9. Snooze indexes ────────────────────────────────────────

create index if not exists ops_events_snoozed_idx
  on public.ops_events (business_id, snoozed_until)
  where snoozed_until is not null;

create index if not exists ops_tasks_snoozed_idx
  on public.ops_tasks (business_id, snoozed_until)
  where snoozed_until is not null;

create index if not exists ops_alerts_snoozed_idx
  on public.ops_alerts (business_id, snoozed_until)
  where snoozed_until is not null;

create index if not exists approval_items_snoozed_idx
  on public.approval_items (business_id, snoozed_until)
  where snoozed_until is not null;
