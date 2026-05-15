-- ============================================================
-- HELIOS AI — Phase 11: Inbox Realtime, Unread Counts & Bulk
-- Idempotent migration — safe to run multiple times.
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── 1. chat_sessions: realtime and unread fields ──────────────

alter table public.chat_sessions
  add column if not exists unread_count          integer      not null default 0,
  add column if not exists last_read_at          timestamptz,
  add column if not exists last_message_at       timestamptz,
  add column if not exists last_message_preview  text,
  add column if not exists last_message_direction text
    check (last_message_direction in ('inbound','outbound')),
  add column if not exists resolved_at           timestamptz,
  add column if not exists archived_at           timestamptz;

-- ── 2. whatsapp_messages: delivery tracking ───────────────────

alter table public.whatsapp_messages
  add column if not exists read_at        timestamptz,
  add column if not exists delivered_at   timestamptz,
  add column if not exists failed_at      timestamptz;

-- ── 3. Indexes for inbox queries ──────────────────────────────

create index if not exists chat_sessions_inbox_status_idx
  on public.chat_sessions (business_id, channel, handoff_status, updated_at desc)
  where channel = 'whatsapp';

create index if not exists chat_sessions_inbox_msg_idx
  on public.chat_sessions (business_id, last_message_at desc nulls last)
  where channel = 'whatsapp';

create index if not exists chat_sessions_inbox_unread_idx
  on public.chat_sessions (business_id, unread_count desc)
  where channel = 'whatsapp' and unread_count > 0;

create index if not exists whatsapp_messages_session_time_idx
  on public.whatsapp_messages (chat_session_id, created_at desc);

-- ── 4. Atomic unread increment function ──────────────────────
-- Used by the webhook handler to safely increment per-session
-- unread count without a race condition.

create or replace function public.increment_chat_session_unread(p_session_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.chat_sessions
  set unread_count = coalesce(unread_count, 0) + 1
  where id = p_session_id;
$$;

-- ── 5. Enable Supabase Realtime for inbox tables ──────────────
-- Allows dashboard clients to subscribe to changes.
-- If already added, these are safe to run again (idempotent in modern Supabase).

do $$
begin
  begin
    alter publication supabase_realtime add table public.chat_sessions;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.whatsapp_messages;
  exception when duplicate_object then null;
  end;
end;
$$;
