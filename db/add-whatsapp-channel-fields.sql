-- ============================================================
-- HELIOS AI — Phase 9: WhatsApp Business API
-- Idempotent migration — safe to run multiple times.
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── 1. whatsapp_connections ──────────────────────────────────
-- Stores the Meta/WhatsApp Business API connection per business.

create table if not exists public.whatsapp_connections (
  id                   uuid primary key default uuid_generate_v4(),
  business_id          uuid not null unique references public.businesses on delete cascade,
  phone_number_id      text,        -- WHATSAPP_PHONE_NUMBER_ID (Meta)
  business_account_id  text,        -- WHATSAPP_BUSINESS_ACCOUNT_ID
  display_phone_number text,        -- e.g. +1 555-123-4567
  status               text not null default 'disconnected'
                       check (status in ('connected', 'disconnected', 'error')),
  is_enabled           boolean not null default false,
  metadata             jsonb not null default '{}',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'whatsapp_connections_updated_at'
  ) then
    create trigger whatsapp_connections_updated_at
      before update on public.whatsapp_connections
      for each row execute function public.handle_updated_at();
  end if;
end $$;

create index if not exists whatsapp_connections_business_idx
  on public.whatsapp_connections (business_id);

-- ── 2. whatsapp_messages ──────────────────────────────────────
-- Stores incoming and outgoing WhatsApp messages for audit and display.
-- content_summary stores first 200 chars only — not full message content.

create table if not exists public.whatsapp_messages (
  id                   uuid primary key default uuid_generate_v4(),
  business_id          uuid not null references public.businesses on delete cascade,
  lead_id              uuid references public.leads on delete set null,
  chat_session_id      uuid references public.chat_sessions on delete set null,
  whatsapp_message_id  text not null,         -- Meta message ID
  from_phone           text not null,
  to_phone             text not null,
  direction            text not null check (direction in ('inbound', 'outbound')),
  message_type         text not null default 'text',
  content_summary      text,                  -- truncated preview — never full content
  status               text not null default 'received'
                       check (status in ('received', 'sent', 'failed', 'read')),
  metadata             jsonb not null default '{}',
  created_at           timestamptz not null default now()
);

create index if not exists whatsapp_messages_business_idx
  on public.whatsapp_messages (business_id, created_at desc);

create index if not exists whatsapp_messages_session_idx
  on public.whatsapp_messages (chat_session_id);

create unique index if not exists whatsapp_messages_msg_id_idx
  on public.whatsapp_messages (whatsapp_message_id);

-- ── 3. chat_sessions: add external_thread_id ──────────────────
-- Allows linking a chat session to a WhatsApp phone number
-- so the same conversation thread is reused across messages.

alter table public.chat_sessions
  add column if not exists external_thread_id text;

create index if not exists chat_sessions_external_thread_idx
  on public.chat_sessions (business_id, external_thread_id)
  where external_thread_id is not null;

-- ── 4. RLS policies ───────────────────────────────────────────

alter table public.whatsapp_connections enable row level security;
alter table public.whatsapp_messages    enable row level security;

-- whatsapp_connections: business members can read their own connection
drop policy if exists "Business members can read own WhatsApp connection" on public.whatsapp_connections;
create policy "Business members can read own WhatsApp connection"
  on public.whatsapp_connections
  for select
  using (public.is_business_member(business_id));

drop policy if exists "Business members can update own WhatsApp connection" on public.whatsapp_connections;
create policy "Business members can update own WhatsApp connection"
  on public.whatsapp_connections
  for update
  using (public.is_business_member(business_id));

drop policy if exists "Business members can insert own WhatsApp connection" on public.whatsapp_connections;
create policy "Business members can insert own WhatsApp connection"
  on public.whatsapp_connections
  for insert
  with check (public.is_business_member(business_id));

-- whatsapp_messages: business members can read their own messages
drop policy if exists "Business members can read own WhatsApp messages" on public.whatsapp_messages;
create policy "Business members can read own WhatsApp messages"
  on public.whatsapp_messages
  for select
  using (public.is_business_member(business_id));

-- Webhook writes use service role — no insert policy needed for anon/user role
