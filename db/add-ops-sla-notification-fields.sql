-- ============================================================
-- HELIOS AI — Phase 14: SLA Timers, Notifications, Audit Trail
-- Idempotent migration — safe to run multiple times.
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── 1. ops_events: SLA + notification tracking ───────────────

alter table public.ops_events
  add column if not exists sla_due_at           timestamptz,
  add column if not exists escalated_at          timestamptz,
  add column if not exists escalation_level      integer not null default 0,
  add column if not exists notified_at           timestamptz,
  add column if not exists notification_status   text,
  add column if not exists assigned_user_name    text;

-- ── 2. ops_tasks: SLA + overdue + notification ───────────────

alter table public.ops_tasks
  add column if not exists sla_due_at            timestamptz,
  add column if not exists overdue_at            timestamptz,
  add column if not exists escalated_at          timestamptz,
  add column if not exists escalation_level      integer not null default 0,
  add column if not exists notified_at           timestamptz,
  add column if not exists notification_status   text,
  add column if not exists assigned_user_name    text;

-- ── 3. ops_alerts: SLA + assignment + notification ───────────

alter table public.ops_alerts
  add column if not exists sla_due_at            timestamptz,
  add column if not exists escalated_at          timestamptz,
  add column if not exists escalation_level      integer not null default 0,
  add column if not exists notified_at           timestamptz,
  add column if not exists notification_status   text,
  add column if not exists assigned_to           uuid references public.profiles on delete set null,
  add column if not exists assigned_user_name    text;

-- ── 4. approval_items: SLA + notification ────────────────────

alter table public.approval_items
  add column if not exists sla_due_at            timestamptz,
  add column if not exists escalated_at          timestamptz,
  add column if not exists escalation_level      integer not null default 0,
  add column if not exists notified_at           timestamptz,
  add column if not exists notification_status   text,
  add column if not exists assigned_user_name    text;

-- ── 5. ops_notification_rules ────────────────────────────────

create table if not exists public.ops_notification_rules (
  id                uuid primary key default uuid_generate_v4(),
  business_id       uuid references public.businesses on delete cascade,
  name              text not null,
  description       text,
  trigger_type      text not null
    check (trigger_type in (
      'alert_created','task_created','approval_created','item_assigned',
      'sla_warning','sla_breached','escalation_created','automation_failed',
      'payment_failed','booking_failed','handoff_requested'
    )),
  source            text,
  severity          text,
  priority          text,
  status            text,
  channel           text not null default 'email'
    check (channel in ('email','dashboard','none')),
  recipient_type    text not null default 'owner'
    check (recipient_type in ('owner','assigned_user','all_admins','custom_email')),
  recipient_user_id uuid references public.profiles on delete set null,
  recipient_email   text,
  delay_minutes     integer not null default 0,
  is_enabled        boolean not null default true,
  metadata          jsonb not null default '{}',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'ops_notification_rules_updated_at') then
    create trigger ops_notification_rules_updated_at
      before update on public.ops_notification_rules
      for each row execute function public.handle_updated_at();
  end if;
end $$;

create index if not exists ops_notification_rules_business_idx
  on public.ops_notification_rules (business_id, is_enabled);

-- ── 6. ops_sla_policies ──────────────────────────────────────

create table if not exists public.ops_sla_policies (
  id                  uuid primary key default uuid_generate_v4(),
  business_id         uuid references public.businesses on delete cascade,
  name                text not null,
  target_type         text not null
    check (target_type in ('event','alert','task','approval','conversation')),
  source              text,
  severity            text,
  priority            text,
  response_minutes    integer not null,
  escalation_minutes  integer,
  is_enabled          boolean not null default true,
  metadata            jsonb not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'ops_sla_policies_updated_at') then
    create trigger ops_sla_policies_updated_at
      before update on public.ops_sla_policies
      for each row execute function public.handle_updated_at();
  end if;
end $$;

create index if not exists ops_sla_policies_business_idx
  on public.ops_sla_policies (business_id, is_enabled);

-- ── 7. ops_audit_trail ───────────────────────────────────────

create table if not exists public.ops_audit_trail (
  id             uuid primary key default uuid_generate_v4(),
  business_id    uuid references public.businesses on delete cascade,
  actor_user_id  uuid references public.profiles on delete set null,
  actor_label    text,
  action         text not null,
  target_table   text not null,
  target_id      uuid,
  before_state   jsonb,
  after_state    jsonb,
  metadata       jsonb not null default '{}',
  created_at     timestamptz not null default now()
);

create index if not exists ops_audit_trail_business_idx
  on public.ops_audit_trail (business_id, created_at desc);

create index if not exists ops_audit_trail_target_idx
  on public.ops_audit_trail (target_table, target_id, created_at desc);

-- ── 8. SLA indexes ───────────────────────────────────────────

create index if not exists ops_events_sla_idx
  on public.ops_events (business_id, sla_due_at)
  where sla_due_at is not null and status = 'open';

create index if not exists ops_tasks_sla_idx
  on public.ops_tasks (business_id, sla_due_at)
  where sla_due_at is not null and status not in ('completed','cancelled');

create index if not exists ops_alerts_sla_idx
  on public.ops_alerts (business_id, sla_due_at)
  where sla_due_at is not null and status = 'active';

create index if not exists approval_items_sla_idx
  on public.approval_items (business_id, sla_due_at)
  where sla_due_at is not null and status = 'pending';

-- ── 9. RLS ───────────────────────────────────────────────────

alter table public.ops_notification_rules enable row level security;
alter table public.ops_sla_policies       enable row level security;
alter table public.ops_audit_trail        enable row level security;

drop policy if exists "Business members read notification rules"   on public.ops_notification_rules;
drop policy if exists "Business members manage notification rules" on public.ops_notification_rules;
create policy "Business members read notification rules"
  on public.ops_notification_rules for select
  using (business_id is null or public.is_business_member(business_id));
create policy "Business members manage notification rules"
  on public.ops_notification_rules for all
  using (business_id is not null and public.is_business_member(business_id));

drop policy if exists "Business members read sla policies"   on public.ops_sla_policies;
drop policy if exists "Business members manage sla policies" on public.ops_sla_policies;
create policy "Business members read sla policies"
  on public.ops_sla_policies for select
  using (business_id is null or public.is_business_member(business_id));
create policy "Business members manage sla policies"
  on public.ops_sla_policies for all
  using (business_id is not null and public.is_business_member(business_id));

drop policy if exists "Business members read audit trail" on public.ops_audit_trail;
create policy "Business members read audit trail"
  on public.ops_audit_trail for select
  using (business_id is null or public.is_business_member(business_id));
