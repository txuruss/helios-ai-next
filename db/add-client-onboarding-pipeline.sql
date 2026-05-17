-- ============================================================
-- HELIOS AI — Phase 25: Client Onboarding Pipeline
--   client_onboarding_intake + client_delivery_tasks
-- Idempotent migration — safe to run multiple times.
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── 1. client_onboarding_intake ───────────────────────────────────

create table if not exists public.client_onboarding_intake (
  id                      uuid primary key default gen_random_uuid(),
  business_id             uuid not null,
  owner_name              text,
  owner_email             text,
  owner_phone             text,
  business_name           text,
  business_type           text,
  city                    text,
  country                 text,
  website_url             text,
  instagram_url           text,
  facebook_url            text,
  whatsapp_number         text,
  services_notes          text,
  faq_notes               text,
  booking_rules_notes     text,
  brand_notes             text,
  ai_persona_notes        text,
  notification_preferences text,
  launch_notes            text,
  status                  text not null default 'draft',
  submitted_at            timestamptz,
  reviewed_at             timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (business_id)
);

-- ── 2. client_delivery_tasks ─────────────────────────────────────

create table if not exists public.client_delivery_tasks (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null,
  intake_id       uuid,
  title           text not null,
  description     text,
  category        text not null,
  status          text not null default 'pending',
  priority        text not null default 'normal',
  assigned_to     uuid,
  due_at          timestamptz,
  completed_at    timestamptz,
  blocked_reason  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── 3. Indexes ────────────────────────────────────────────────────

create index if not exists client_onboarding_intake_business_idx
  on public.client_onboarding_intake (business_id);

create index if not exists client_onboarding_intake_status_idx
  on public.client_onboarding_intake (business_id, status);

create index if not exists client_delivery_tasks_business_idx
  on public.client_delivery_tasks (business_id);

create index if not exists client_delivery_tasks_category_idx
  on public.client_delivery_tasks (business_id, category);

create index if not exists client_delivery_tasks_status_idx
  on public.client_delivery_tasks (business_id, status);

create index if not exists client_delivery_tasks_priority_idx
  on public.client_delivery_tasks (business_id, priority);

-- ── 4. RLS ────────────────────────────────────────────────────────

alter table public.client_onboarding_intake enable row level security;
alter table public.client_delivery_tasks     enable row level security;

do $$
begin
  -- Onboarding intake: members read own
  if not exists (
    select 1 from pg_policies
    where tablename = 'client_onboarding_intake'
      and policyname = 'members_manage_own_intake'
  ) then
    execute $p$
      create policy members_manage_own_intake
        on public.client_onboarding_intake for all
        using (is_business_member(business_id))
        with check (is_business_member(business_id))
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'client_onboarding_intake'
      and policyname = 'service_role_manage_intake'
  ) then
    execute $p$
      create policy service_role_manage_intake
        on public.client_onboarding_intake for all
        using (true) with check (true)
    $p$;
  end if;

  -- Delivery tasks: members read own
  if not exists (
    select 1 from pg_policies
    where tablename = 'client_delivery_tasks'
      and policyname = 'members_manage_own_delivery_tasks'
  ) then
    execute $p$
      create policy members_manage_own_delivery_tasks
        on public.client_delivery_tasks for all
        using (is_business_member(business_id))
        with check (is_business_member(business_id))
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'client_delivery_tasks'
      and policyname = 'service_role_manage_delivery_tasks'
  ) then
    execute $p$
      create policy service_role_manage_delivery_tasks
        on public.client_delivery_tasks for all
        using (true) with check (true)
    $p$;
  end if;

end;
$$;
