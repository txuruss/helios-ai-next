-- ============================================================
-- HELIOS AI — Phase 22: Booking Review, WhatsApp AI Pause,
--   AI Confidence Persistence, Confirmation Expiry
-- Idempotent migration — safe to run multiple times.
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── 1. bookings: owner review + confirmation expiry ──────────────

alter table public.bookings
  add column if not exists owner_review_status                   text        not null default 'pending',
  add column if not exists owner_reviewed_by                     uuid,
  add column if not exists owner_reviewed_at                     timestamptz,
  add column if not exists customer_confirmation_email_sent_at   timestamptz,
  add column if not exists customer_confirmation_email_status    text,
  add column if not exists confirmation_expires_at               timestamptz,
  add column if not exists expired_by_cron_at                    timestamptz;

-- ── 2. chat_sessions: AI confidence persistence ───────────────────

alter table public.chat_sessions
  add column if not exists last_ai_response_at              timestamptz,
  add column if not exists last_ai_confidence_updated_at    timestamptz,
  add column if not exists ai_review_approval_id            uuid;

-- ── 3. approval_items: session/booking source links ───────────────

alter table public.approval_items
  add column if not exists source_session_id  uuid,
  add column if not exists source_booking_id  uuid,
  add column if not exists review_reason      text;

-- ── 4. booking_confirmation_email_logs ───────────────────────────

create table if not exists public.booking_confirmation_email_logs (
  id                   uuid primary key default gen_random_uuid(),
  business_id          uuid not null,
  booking_id           uuid not null,
  recipient_masked     text,
  email_status         text not null default 'pending',
  provider             text not null default 'resend',
  provider_message_id  text,
  error_summary        text,
  sent_at              timestamptz,
  failed_at            timestamptz,
  created_at           timestamptz not null default now()
);

-- ── 5. Indexes ────────────────────────────────────────────────────

create index if not exists bookings_confirmation_status_v2_idx
  on public.bookings (business_id, confirmation_status);

create index if not exists bookings_owner_review_idx
  on public.bookings (business_id, owner_review_status);

create index if not exists bookings_confirmation_expires_idx
  on public.bookings (confirmation_expires_at)
  where confirmation_expires_at is not null;

create index if not exists chat_sessions_ai_review_v2_idx
  on public.chat_sessions (business_id, ai_review_required)
  where ai_review_required = true;

create index if not exists booking_confirmation_email_logs_booking_idx
  on public.booking_confirmation_email_logs (business_id, booking_id, created_at desc);

-- ── 6. RLS ────────────────────────────────────────────────────────

alter table public.booking_confirmation_email_logs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'booking_confirmation_email_logs'
      and policyname = 'members_read_own_confirmation_email_logs'
  ) then
    execute $p$
      create policy members_read_own_confirmation_email_logs
        on public.booking_confirmation_email_logs for select
        using (is_business_member(business_id))
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'booking_confirmation_email_logs'
      and policyname = 'service_role_manage_confirmation_email_logs'
  ) then
    execute $p$
      create policy service_role_manage_confirmation_email_logs
        on public.booking_confirmation_email_logs for all
        using (true) with check (true)
    $p$;
  end if;
end;
$$;
