-- ============================================================
-- HELIOS AI — Phase 23: Booking Reliability, Owner Notifications,
--   Cal.com Availability, Realtime Updates, Demo QA Checklist
-- Idempotent migration — safe to run multiple times.
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── 1. bookings: owner notification + resend + Cal.com availability ──

alter table public.bookings
  add column if not exists owner_confirmation_email_sent_at       timestamptz,
  add column if not exists owner_confirmation_email_status        text,
  add column if not exists customer_confirmation_email_resend_count integer not null default 0,
  add column if not exists customer_confirmation_email_last_resent_at timestamptz,
  add column if not exists calcom_availability_checked_at         timestamptz,
  add column if not exists calcom_availability_status             text,
  add column if not exists calcom_availability_error              text;

-- ── 2. client_setup_progress: QA checklist tracking ─────────────

alter table public.client_setup_progress
  add column if not exists qa_checklist_completed boolean not null default false,
  add column if not exists demo_flow_verified     boolean not null default false,
  add column if not exists production_ready       boolean not null default false;

-- ── 3. client_demo_qa_checks ─────────────────────────────────────

create table if not exists public.client_demo_qa_checks (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null,
  check_key    text not null,
  check_label  text not null,
  check_status text not null default 'pending',
  notes        text,
  checked_by   uuid,
  checked_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (business_id, check_key)
);

-- ── 4. Indexes ────────────────────────────────────────────────────

create index if not exists bookings_availability_status_idx
  on public.bookings (business_id, calcom_availability_status)
  where calcom_availability_status is not null;

create index if not exists client_demo_qa_checks_business_key_idx
  on public.client_demo_qa_checks (business_id, check_key);

create index if not exists client_demo_qa_checks_business_status_idx
  on public.client_demo_qa_checks (business_id, check_status);

-- ── 5. RLS ────────────────────────────────────────────────────────

alter table public.client_demo_qa_checks enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'client_demo_qa_checks'
      and policyname = 'members_manage_own_qa_checks'
  ) then
    execute $p$
      create policy members_manage_own_qa_checks
        on public.client_demo_qa_checks for all
        using (is_business_member(business_id))
        with check (is_business_member(business_id))
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'client_demo_qa_checks'
      and policyname = 'service_role_manage_qa_checks'
  ) then
    execute $p$
      create policy service_role_manage_qa_checks
        on public.client_demo_qa_checks for all
        using (true) with check (true)
    $p$;
  end if;
end;
$$;
