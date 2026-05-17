-- ============================================================
-- HELIOS AI — Phase 20: Client Setup Progress + AI Pause
-- Idempotent migration — safe to run multiple times.
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── 1. client_setup_progress ─────────────────────────────────────

create table if not exists public.client_setup_progress (
  id                            uuid primary key default gen_random_uuid(),
  business_id                   uuid not null unique,
  business_profile_completed    boolean not null default false,
  services_added                boolean not null default false,
  faqs_added                    boolean not null default false,
  booking_rules_added           boolean not null default false,
  calcom_connected              boolean not null default false,
  whatsapp_connected            boolean not null default false,
  widget_installed              boolean not null default false,
  test_conversation_completed   boolean not null default false,
  owner_notification_tested     boolean not null default false,
  launch_approved               boolean not null default false,
  demo_mode_active              boolean not null default false,
  demo_loaded_at                timestamptz,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now()
);

-- Add missing columns safely
alter table public.client_setup_progress
  add column if not exists demo_mode_active  boolean not null default false,
  add column if not exists demo_loaded_at    timestamptz;

-- ── 2. Add AI pause to businesses ────────────────────────────────

alter table public.businesses
  add column if not exists ai_paused             boolean not null default false,
  add column if not exists ai_paused_at          timestamptz,
  add column if not exists ai_paused_reason      text,
  add column if not exists ai_paused_by          uuid;

-- ── 3. Indexes ────────────────────────────────────────────────────

create index if not exists client_setup_progress_business_idx
  on public.client_setup_progress (business_id);

create index if not exists client_setup_progress_launch_idx
  on public.client_setup_progress (launch_approved, business_id);

-- ── 4. RLS ────────────────────────────────────────────────────────

alter table public.client_setup_progress enable row level security;

do $$
begin
  -- Members read their own setup progress
  if not exists (
    select 1 from pg_policies
    where tablename = 'client_setup_progress'
      and policyname = 'members_read_own_setup_progress'
  ) then
    execute $p$
      create policy members_read_own_setup_progress
        on public.client_setup_progress for select
        using (is_business_member(business_id))
    $p$;
  end if;

  -- Members update their own setup progress
  if not exists (
    select 1 from pg_policies
    where tablename = 'client_setup_progress'
      and policyname = 'members_update_own_setup_progress'
  ) then
    execute $p$
      create policy members_update_own_setup_progress
        on public.client_setup_progress for update
        using (is_business_member(business_id))
    $p$;
  end if;

  -- Service role manages all
  if not exists (
    select 1 from pg_policies
    where tablename = 'client_setup_progress'
      and policyname = 'service_role_manage_setup_progress'
  ) then
    execute $p$
      create policy service_role_manage_setup_progress
        on public.client_setup_progress for all
        using (true) with check (true)
    $p$;
  end if;
end;
$$;
