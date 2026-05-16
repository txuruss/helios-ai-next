-- ============================================================
-- HELIOS AI — Phase 12: Ops Center Tables
-- Idempotent migration — safe to run multiple times.
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── 1. ops_events ─────────────────────────────────────────────

create table if not exists public.ops_events (
  id             uuid primary key default uuid_generate_v4(),
  business_id    uuid references public.businesses on delete cascade,
  source         text not null,                     -- 'chat', 'whatsapp', 'calcom', 'stripe', 'relevance', 'system'
  event_type     text not null,
  severity       text not null default 'info'
                 check (severity in ('info','warning','error','critical')),
  title          text not null,
  description    text,
  status         text not null default 'open'
                 check (status in ('open','acknowledged','resolved')),
  related_table  text,
  related_id     uuid,
  assigned_to    uuid references public.profiles on delete set null,
  metadata       jsonb not null default '{}',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  resolved_at    timestamptz
);

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'ops_events_updated_at') then
    create trigger ops_events_updated_at
      before update on public.ops_events
      for each row execute function public.handle_updated_at();
  end if;
end $$;

create index if not exists ops_events_business_idx
  on public.ops_events (business_id, created_at desc);
create index if not exists ops_events_status_idx
  on public.ops_events (business_id, status, severity);
create index if not exists ops_events_global_idx
  on public.ops_events (created_at desc)
  where business_id is null;

-- ── 2. ops_tasks ──────────────────────────────────────────────

create table if not exists public.ops_tasks (
  id             uuid primary key default uuid_generate_v4(),
  business_id    uuid references public.businesses on delete cascade,
  title          text not null,
  description    text,
  task_type      text not null,
  priority       text not null default 'normal'
                 check (priority in ('low','normal','high','urgent')),
  status         text not null default 'pending'
                 check (status in ('pending','in_progress','completed','cancelled')),
  related_table  text,
  related_id     uuid,
  assigned_to    uuid references public.profiles on delete set null,
  due_at         timestamptz,
  metadata       jsonb not null default '{}',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  completed_at   timestamptz
);

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'ops_tasks_updated_at') then
    create trigger ops_tasks_updated_at
      before update on public.ops_tasks
      for each row execute function public.handle_updated_at();
  end if;
end $$;

create index if not exists ops_tasks_business_idx
  on public.ops_tasks (business_id, status, priority desc, created_at desc);

-- ── 3. ops_alerts ─────────────────────────────────────────────

create table if not exists public.ops_alerts (
  id               uuid primary key default uuid_generate_v4(),
  business_id      uuid references public.businesses on delete cascade,
  alert_type       text not null,
  severity         text not null default 'warning'
                   check (severity in ('info','warning','error','critical')),
  title            text not null,
  message          text,
  status           text not null default 'active'
                   check (status in ('active','acknowledged','resolved')),
  related_table    text,
  related_id       uuid,
  metadata         jsonb not null default '{}',
  created_at       timestamptz not null default now(),
  acknowledged_at  timestamptz,
  resolved_at      timestamptz
);

create index if not exists ops_alerts_business_idx
  on public.ops_alerts (business_id, status, severity, created_at desc);

-- ── 4. approval_items ─────────────────────────────────────────

create table if not exists public.approval_items (
  id             uuid primary key default uuid_generate_v4(),
  business_id    uuid references public.businesses on delete cascade,
  approval_type  text not null,
  title          text not null,
  description    text,
  content        text,
  status         text not null default 'pending'
                 check (status in ('pending','approved','rejected','expired')),
  requested_by   text,
  reviewed_by    uuid references public.profiles on delete set null,
  related_table  text,
  related_id     uuid,
  metadata       jsonb not null default '{}',
  created_at     timestamptz not null default now(),
  reviewed_at    timestamptz
);

create index if not exists approval_items_business_idx
  on public.approval_items (business_id, status, created_at desc);

-- ── 5. RLS ────────────────────────────────────────────────────

alter table public.ops_events    enable row level security;
alter table public.ops_tasks     enable row level security;
alter table public.ops_alerts    enable row level security;
alter table public.approval_items enable row level security;

-- ops_events
drop policy if exists "Business members read ops_events"   on public.ops_events;
drop policy if exists "Business members update ops_events" on public.ops_events;
create policy "Business members read ops_events"
  on public.ops_events for select
  using (business_id is null or public.is_business_member(business_id));
create policy "Business members update ops_events"
  on public.ops_events for update
  using (business_id is not null and public.is_business_member(business_id));

-- ops_tasks
drop policy if exists "Business members read ops_tasks"   on public.ops_tasks;
drop policy if exists "Business members update ops_tasks" on public.ops_tasks;
create policy "Business members read ops_tasks"
  on public.ops_tasks for select
  using (business_id is null or public.is_business_member(business_id));
create policy "Business members update ops_tasks"
  on public.ops_tasks for update
  using (business_id is not null and public.is_business_member(business_id));

-- ops_alerts
drop policy if exists "Business members read ops_alerts"   on public.ops_alerts;
drop policy if exists "Business members update ops_alerts" on public.ops_alerts;
create policy "Business members read ops_alerts"
  on public.ops_alerts for select
  using (business_id is null or public.is_business_member(business_id));
create policy "Business members update ops_alerts"
  on public.ops_alerts for update
  using (business_id is not null and public.is_business_member(business_id));

-- approval_items
drop policy if exists "Business members read approval_items"   on public.approval_items;
drop policy if exists "Business members update approval_items" on public.approval_items;
create policy "Business members read approval_items"
  on public.approval_items for select
  using (business_id is null or public.is_business_member(business_id));
create policy "Business members update approval_items"
  on public.approval_items for update
  using (business_id is not null and public.is_business_member(business_id));

-- Enable Realtime
do $$
begin
  begin alter publication supabase_realtime add table public.ops_events;
  exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.ops_alerts;
  exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.ops_tasks;
  exception when duplicate_object then null; end;
end;
$$;
