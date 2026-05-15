-- ============================================================
-- HELIOS AI — Phase 10: WhatsApp Handoff, Inbox & Media
-- Idempotent migration — safe to run multiple times.
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── 1. chat_sessions: handoff and inbox fields ────────────────

alter table public.chat_sessions
  add column if not exists handoff_status text not null default 'ai'
    check (handoff_status in ('ai','human_requested','human','resolved','archived')),
  add column if not exists assigned_to uuid,
  add column if not exists last_customer_message_at timestamptz,
  add column if not exists last_agent_reply_at timestamptz,
  add column if not exists priority text not null default 'normal'
    check (priority in ('low','normal','high','urgent')),
  add column if not exists tags text[] not null default '{}',
  add column if not exists internal_notes text;

-- Indexes for inbox queries
create index if not exists chat_sessions_handoff_idx
  on public.chat_sessions (business_id, channel, handoff_status, updated_at desc)
  where channel = 'whatsapp';

create index if not exists chat_sessions_assigned_idx
  on public.chat_sessions (assigned_to)
  where assigned_to is not null;

-- ── 2. whatsapp_messages: media and handoff fields ────────────

alter table public.whatsapp_messages
  add column if not exists media_id text,
  add column if not exists media_url text,
  add column if not exists media_mime_type text,
  add column if not exists template_name text,
  add column if not exists template_language text,
  add column if not exists sent_by_user_id uuid,
  add column if not exists is_internal_note boolean not null default false;

-- ── 3. conversation_assignments ───────────────────────────────

create table if not exists public.conversation_assignments (
  id               uuid primary key default uuid_generate_v4(),
  business_id      uuid not null references public.businesses on delete cascade,
  chat_session_id  uuid not null references public.chat_sessions on delete cascade,
  assigned_to      uuid not null references public.profiles on delete cascade,
  assigned_by      uuid references public.profiles on delete set null,
  status           text not null default 'active'
                   check (status in ('active', 'released')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'conversation_assignments_updated_at'
  ) then
    create trigger conversation_assignments_updated_at
      before update on public.conversation_assignments
      for each row execute function public.handle_updated_at();
  end if;
end $$;

create index if not exists conversation_assignments_session_idx
  on public.conversation_assignments (chat_session_id, status);

create index if not exists conversation_assignments_user_idx
  on public.conversation_assignments (assigned_to, status);

-- ── 4. RLS for conversation_assignments ──────────────────────

alter table public.conversation_assignments enable row level security;

drop policy if exists "Business members can read assignments" on public.conversation_assignments;
create policy "Business members can read assignments"
  on public.conversation_assignments
  for select
  using (public.is_business_member(business_id));

drop policy if exists "Business members can insert assignments" on public.conversation_assignments;
create policy "Business members can insert assignments"
  on public.conversation_assignments
  for insert
  with check (public.is_business_member(business_id));

drop policy if exists "Business members can update assignments" on public.conversation_assignments;
create policy "Business members can update assignments"
  on public.conversation_assignments
  for update
  using (public.is_business_member(business_id));
