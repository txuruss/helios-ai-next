-- ============================================================
-- HELIOS AI — Phase 13: Ops Automation, Export & Assignment
-- Idempotent migration — safe to run multiple times.
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── 1. ops_events: automation tracking fields ────────────────

alter table public.ops_events
  add column if not exists acknowledged_at   timestamptz,
  add column if not exists ignored_at        timestamptz,
  add column if not exists auto_generated    boolean not null default false,
  add column if not exists processed_at      timestamptz,
  add column if not exists processing_error  text,
  add column if not exists assigned_to       uuid references public.profiles on delete set null;

-- ── 2. ops_tasks: automation + dismissal fields ──────────────

alter table public.ops_tasks
  add column if not exists created_from_event_id  uuid references public.ops_events on delete set null,
  add column if not exists completed_by            uuid references public.profiles on delete set null,
  add column if not exists dismissed_at            timestamptz,
  add column if not exists dismissed_by            uuid references public.profiles on delete set null;

-- ── 3. ops_alerts: assignment and creator tracking ───────────

alter table public.ops_alerts
  add column if not exists created_from_event_id  uuid references public.ops_events on delete set null,
  add column if not exists acknowledged_by         uuid references public.profiles on delete set null,
  add column if not exists resolved_by             uuid references public.profiles on delete set null,
  add column if not exists assigned_to             uuid references public.profiles on delete set null;

-- ── 4. approval_items: additional metadata ───────────────────

alter table public.approval_items
  add column if not exists source_table  text,
  add column if not exists source_id     uuid,
  add column if not exists priority      text not null default 'normal'
                             check (priority in ('low','normal','high','urgent')),
  add column if not exists assigned_to   uuid references public.profiles on delete set null;

-- ── 5. ops_automation_rules ──────────────────────────────────

create table if not exists public.ops_automation_rules (
  id                          uuid primary key default uuid_generate_v4(),
  business_id                 uuid references public.businesses on delete cascade,
  name                        text not null,
  description                 text,
  trigger_source              text,
  trigger_event_type          text,
  trigger_severity            text check (trigger_severity in ('info','warning','error','critical')),
  action_type                 text not null check (action_type in ('create_alert','create_task','create_approval','ignore')),
  action_title_template       text not null,
  action_description_template text,
  priority                    text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  is_enabled                  boolean not null default true,
  metadata                    jsonb not null default '{}',
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'ops_automation_rules_updated_at') then
    create trigger ops_automation_rules_updated_at
      before update on public.ops_automation_rules
      for each row execute function public.handle_updated_at();
  end if;
end $$;

create index if not exists ops_automation_rules_business_idx
  on public.ops_automation_rules (business_id, is_enabled);

create unique index if not exists ops_automation_rules_name_idx
  on public.ops_automation_rules (business_id, name)
  where business_id is not null;

-- ── 6. ops_exports ───────────────────────────────────────────

create table if not exists public.ops_exports (
  id            uuid primary key default uuid_generate_v4(),
  business_id   uuid not null references public.businesses on delete cascade,
  export_type   text not null check (export_type in ('ops_events','ops_alerts','ops_tasks','approvals')),
  format        text not null check (format in ('csv','json')),
  status        text not null default 'completed' check (status in ('pending','completed','failed')),
  requested_by  uuid references public.profiles on delete set null,
  filters       jsonb not null default '{}',
  row_count     integer not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists ops_exports_business_idx
  on public.ops_exports (business_id, created_at desc);

-- ── 7. Additional indexes for Phase 13 queries ───────────────

create index if not exists ops_events_unprocessed_idx
  on public.ops_events (business_id, created_at)
  where processed_at is null and status = 'open';

create index if not exists ops_events_severity_status_idx
  on public.ops_events (business_id, severity, status, created_at desc);

create index if not exists ops_tasks_priority_status_idx
  on public.ops_tasks (business_id, status, priority, created_at desc);

create index if not exists ops_alerts_severity_status_idx
  on public.ops_alerts (business_id, status, severity, created_at desc);

create index if not exists approval_items_priority_status_idx
  on public.approval_items (business_id, status, priority, created_at desc);

-- ── 8. RLS ───────────────────────────────────────────────────

alter table public.ops_automation_rules enable row level security;
alter table public.ops_exports          enable row level security;

drop policy if exists "Business members read automation rules"   on public.ops_automation_rules;
drop policy if exists "Business members manage automation rules" on public.ops_automation_rules;
create policy "Business members read automation rules"
  on public.ops_automation_rules for select
  using (business_id is null or public.is_business_member(business_id));
create policy "Business members manage automation rules"
  on public.ops_automation_rules for all
  using (business_id is not null and public.is_business_member(business_id));

drop policy if exists "Business members read exports" on public.ops_exports;
create policy "Business members read exports"
  on public.ops_exports for select
  using (public.is_business_member(business_id));

-- ── 9. Enable Realtime ────────────────────────────────────────
do $$
begin
  begin alter publication supabase_realtime add table public.ops_automation_rules;
  exception when duplicate_object then null; end;
end;
$$;
