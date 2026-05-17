-- ============================================================
-- HELIOS AI — Phase 21: Trust Controls, Booking Confirmation,
--   Customer Portal, AI Confidence, Conversation AI Pause
-- Idempotent migration — safe to run multiple times.
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── 1. chat_sessions: AI confidence + conversation pause ──────────

alter table public.chat_sessions
  add column if not exists ai_paused               boolean not null default false,
  add column if not exists ai_pause_reason         text,
  add column if not exists ai_confidence           text    not null default 'medium',
  add column if not exists ai_review_required      boolean not null default false,
  add column if not exists last_confidence_reason  text;

-- ── 2. bookings: confirmation step ───────────────────────────────

alter table public.bookings
  add column if not exists confirmation_status      text    not null default 'pending',
  add column if not exists confirmation_token       text,
  add column if not exists customer_portal_token    text,
  add column if not exists customer_portal_expires_at timestamptz,
  add column if not exists customer_confirmed_at    timestamptz,
  add column if not exists owner_confirmed_at       timestamptz,
  add column if not exists rejected_at              timestamptz,
  add column if not exists rejection_reason         text;

-- ── 3. booking_confirmation_events ───────────────────────────────

create table if not exists public.booking_confirmation_events (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null,
  booking_id    uuid not null,
  event_type    text not null,
  actor_type    text not null default 'system',
  safe_summary  text,
  metadata      jsonb not null default '{}',
  created_at    timestamptz not null default now()
);

-- ── 4. Indexes ────────────────────────────────────────────────────

create index if not exists chat_sessions_ai_paused_idx
  on public.chat_sessions (business_id, ai_paused)
  where ai_paused = true;

create index if not exists chat_sessions_ai_review_idx
  on public.chat_sessions (business_id, ai_review_required)
  where ai_review_required = true;

create index if not exists bookings_confirmation_status_idx
  on public.bookings (business_id, confirmation_status);

create index if not exists bookings_confirmation_token_idx
  on public.bookings (confirmation_token)
  where confirmation_token is not null;

create index if not exists bookings_portal_token_idx
  on public.bookings (customer_portal_token)
  where customer_portal_token is not null;

create index if not exists booking_confirmation_events_booking_idx
  on public.booking_confirmation_events (business_id, booking_id, created_at desc);

-- ── 5. RLS ────────────────────────────────────────────────────────

alter table public.booking_confirmation_events enable row level security;

do $$
begin
  -- Members read their own confirmation events
  if not exists (
    select 1 from pg_policies
    where tablename = 'booking_confirmation_events'
      and policyname = 'members_read_own_confirmation_events'
  ) then
    execute $p$
      create policy members_read_own_confirmation_events
        on public.booking_confirmation_events for select
        using (is_business_member(business_id))
    $p$;
  end if;

  -- Service role manages all
  if not exists (
    select 1 from pg_policies
    where tablename = 'booking_confirmation_events'
      and policyname = 'service_role_manage_confirmation_events'
  ) then
    execute $p$
      create policy service_role_manage_confirmation_events
        on public.booking_confirmation_events for all
        using (true) with check (true)
    $p$;
  end if;

end;
$$;
