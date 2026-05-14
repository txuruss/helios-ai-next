-- ============================================================
-- HELIOS AI — DATABASE SCHEMA
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- or: psql $DATABASE_URL -f db/schema.sql
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ── Utility: auto-update updated_at ──────────────────────────────
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── 1. profiles ──────────────────────────────────────────────────
-- Mirrors auth.users; created automatically via trigger below.
create table if not exists public.profiles (
  id           uuid references auth.users on delete cascade primary key,
  email        text unique not null,
  full_name    text,
  avatar_url   text,
  role         text not null default 'owner'
               check (role in ('owner', 'admin', 'member')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- Auto-create profile on sign-up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── 2. businesses ─────────────────────────────────────────────────
create table if not exists public.businesses (
  id                         uuid primary key default uuid_generate_v4(),
  name                       text not null,
  slug                       text unique not null,
  description                text,
  website_url                text,
  phone                      text,
  address                    text,
  city                       text,
  country                    text not null default 'Jamaica',
  timezone                   text not null default 'America/Jamaica',
  business_type              text,
  owner_notification_email   text,
  logo_url                   text,
  -- hours: { mon: { open:"09:00", close:"17:00", closed:false }, ... }
  hours                      jsonb not null default '{}',
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

create trigger businesses_updated_at
  before update on public.businesses
  for each row execute function public.handle_updated_at();

-- ── 3. business_members ───────────────────────────────────────────
create table if not exists public.business_members (
  id           uuid primary key default uuid_generate_v4(),
  business_id  uuid not null references public.businesses on delete cascade,
  user_id      uuid not null references public.profiles  on delete cascade,
  role         text not null default 'owner'
               check (role in ('owner', 'admin', 'member')),
  joined_at    timestamptz not null default now(),
  unique (business_id, user_id)
);

-- ── 4. services ───────────────────────────────────────────────────
create table if not exists public.services (
  id           uuid primary key default uuid_generate_v4(),
  business_id  uuid not null references public.businesses on delete cascade,
  name         text not null,
  description  text,
  price_cents  integer,               -- stored in cents, e.g. 12000 = $120.00
  duration_min integer,               -- duration in minutes
  is_active    boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger services_updated_at
  before update on public.services
  for each row execute function public.handle_updated_at();

-- ── 5. faqs ───────────────────────────────────────────────────────
create table if not exists public.faqs (
  id           uuid primary key default uuid_generate_v4(),
  business_id  uuid not null references public.businesses on delete cascade,
  question     text not null,
  answer       text not null,
  is_active    boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger faqs_updated_at
  before update on public.faqs
  for each row execute function public.handle_updated_at();

-- ── 6. agent_settings ─────────────────────────────────────────────
create table if not exists public.agent_settings (
  id              uuid primary key default uuid_generate_v4(),
  business_id     uuid not null unique references public.businesses on delete cascade,
  -- Agent persona
  agent_name      text not null default 'Helios AI Assistant',
  persona_prompt  text,
  language        text not null default 'en',
  -- Behaviour flags
  collect_name    boolean not null default true,
  collect_email   boolean not null default true,
  collect_phone   boolean not null default false,
  -- Phase 2: Anthropic model config goes here
  -- model           text not null default 'claude-3-5-haiku-20241022',
  -- temperature     numeric(3,2) not null default 0.3,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger agent_settings_updated_at
  before update on public.agent_settings
  for each row execute function public.handle_updated_at();

-- ── 7. chat_sessions ──────────────────────────────────────────────
create table if not exists public.chat_sessions (
  id            uuid primary key default uuid_generate_v4(),
  business_id   uuid not null references public.businesses on delete cascade,
  visitor_id    text,                  -- anonymous browser fingerprint
  lead_id       uuid,                  -- populated after lead captured
  status        text not null default 'active'
                check (status in ('active', 'completed', 'abandoned')),
  channel       text not null default 'widget'
                check (channel in ('widget', 'whatsapp', 'instagram', 'api')),
  metadata      jsonb not null default '{}',
  started_at    timestamptz not null default now(),
  ended_at      timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger chat_sessions_updated_at
  before update on public.chat_sessions
  for each row execute function public.handle_updated_at();

-- ── 8. chat_messages ──────────────────────────────────────────────
create table if not exists public.chat_messages (
  id           uuid primary key default uuid_generate_v4(),
  session_id   uuid not null references public.chat_sessions on delete cascade,
  business_id  uuid not null references public.businesses on delete cascade,
  role         text not null check (role in ('user', 'assistant', 'system')),
  content      text not null,
  -- Phase 2: token usage from Anthropic response goes here
  -- input_tokens  integer,
  -- output_tokens integer,
  metadata     jsonb not null default '{}',
  created_at   timestamptz not null default now()
);

create index chat_messages_session_idx on public.chat_messages (session_id, created_at);

-- ── 9. leads ──────────────────────────────────────────────────────
create table if not exists public.leads (
  id           uuid primary key default uuid_generate_v4(),
  business_id  uuid not null references public.businesses on delete cascade,
  session_id   uuid references public.chat_sessions on delete set null,
  -- Contact info
  name         text,
  email        text,
  phone        text,
  -- Classification
  source       text not null default 'widget'
               check (source in ('widget', 'whatsapp', 'form', 'manual', 'api')),
  status       text not null default 'new'
               check (status in ('new', 'qualified', 'contacted', 'proposal', 'won', 'lost')),
  intent       text,                   -- what they want (e.g. "book facial")
  score        integer check (score >= 0 and score <= 100),
  notes        text,
  metadata     jsonb not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger leads_updated_at
  before update on public.leads
  for each row execute function public.handle_updated_at();

-- ── 10. bookings ──────────────────────────────────────────────────
create table if not exists public.bookings (
  id               uuid primary key default uuid_generate_v4(),
  business_id      uuid not null references public.businesses on delete cascade,
  lead_id          uuid references public.leads on delete set null,
  service_id       uuid references public.services on delete set null,
  -- Customer
  customer_name    text,
  customer_email   text,
  customer_phone   text,
  -- Appointment
  scheduled_at     timestamptz,
  duration_min     integer,
  status           text not null default 'pending'
                   check (status in ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
  notes            text,
  -- Phase 2: Cal.com booking ID goes here
  -- calcom_booking_id  text,
  metadata         jsonb not null default '{}',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger bookings_updated_at
  before update on public.bookings
  for each row execute function public.handle_updated_at();

-- ── 11. calcom_connections ────────────────────────────────────────
-- Phase 2: Populated when Cal.com OAuth is connected.
create table if not exists public.calcom_connections (
  id              uuid primary key default uuid_generate_v4(),
  business_id     uuid not null unique references public.businesses on delete cascade,
  -- Phase 2: Cal.com OAuth tokens stored here (server-side only)
  -- access_token    text,  -- encrypted at rest
  -- refresh_token   text,  -- encrypted at rest
  -- expires_at      timestamptz,
  calcom_user_id  text,
  is_connected    boolean not null default false,
  connected_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger calcom_connections_updated_at
  before update on public.calcom_connections
  for each row execute function public.handle_updated_at();

-- ── 12. calcom_event_types ────────────────────────────────────────
create table if not exists public.calcom_event_types (
  id              uuid primary key default uuid_generate_v4(),
  business_id     uuid not null references public.businesses on delete cascade,
  calcom_id       integer unique,
  title           text not null,
  slug            text,
  duration_min    integer,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger calcom_event_types_updated_at
  before update on public.calcom_event_types
  for each row execute function public.handle_updated_at();

-- ── 13. service_event_mappings ────────────────────────────────────
-- Links a Helios service → a Cal.com event type
create table if not exists public.service_event_mappings (
  id                  uuid primary key default uuid_generate_v4(),
  business_id         uuid not null references public.businesses on delete cascade,
  service_id          uuid not null references public.services on delete cascade,
  calcom_event_type_id uuid references public.calcom_event_types on delete set null,
  created_at          timestamptz not null default now(),
  unique (service_id)
);

-- ── 14. widget_settings ───────────────────────────────────────────
create table if not exists public.widget_settings (
  id              uuid primary key default uuid_generate_v4(),
  business_id     uuid not null unique references public.businesses on delete cascade,
  -- Branding
  primary_color   text not null default '#ff7a18',
  bot_name        text not null default 'Helios AI',
  welcome_message text not null default 'Hi! How can I help you today?',
  placeholder_text text not null default 'Type a message…',
  -- Position & display
  position        text not null default 'bottom-right'
                  check (position in ('bottom-right', 'bottom-left')),
  is_enabled      boolean not null default true,
  -- Phase 2: custom CSS, font settings go here
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger widget_settings_updated_at
  before update on public.widget_settings
  for each row execute function public.handle_updated_at();

-- ── 15. notifications ─────────────────────────────────────────────
create table if not exists public.notifications (
  id           uuid primary key default uuid_generate_v4(),
  business_id  uuid not null references public.businesses on delete cascade,
  user_id      uuid references public.profiles on delete cascade,
  type         text not null,          -- 'new_lead', 'booking_confirmed', 'agent_error', etc.
  title        text not null,
  body         text,
  is_read      boolean not null default false,
  metadata     jsonb not null default '{}',
  created_at   timestamptz not null default now()
);

-- ── 16. audit_logs ────────────────────────────────────────────────
create table if not exists public.audit_logs (
  id           uuid primary key default uuid_generate_v4(),
  business_id  uuid references public.businesses on delete set null,
  user_id      uuid references public.profiles on delete set null,
  action       text not null,          -- 'business.update', 'service.create', etc.
  resource     text,                   -- table name
  resource_id  text,                   -- record id
  old_values   jsonb,
  new_values   jsonb,
  ip_address   text,
  user_agent   text,
  created_at   timestamptz not null default now()
);

-- ── 17. subscriptions ─────────────────────────────────────────────
-- Phase 2: Populated by Stripe webhook (server-side only).
create table if not exists public.subscriptions (
  id                  uuid primary key default uuid_generate_v4(),
  business_id         uuid not null unique references public.businesses on delete cascade,
  -- Phase 2: Stripe IDs stored here
  -- stripe_customer_id  text unique,
  -- stripe_sub_id       text unique,
  plan                text not null default 'free'
                      check (plan in ('free', 'starter', 'growth', 'command')),
  status              text not null default 'trialing'
                      check (status in ('trialing', 'active', 'past_due', 'cancelled')),
  trial_ends_at       timestamptz,
  current_period_end  timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.handle_updated_at();

-- ── Indexes ────────────────────────────────────────────────────────
create index if not exists leads_business_idx        on public.leads (business_id, created_at desc);
create index if not exists bookings_business_idx     on public.bookings (business_id, scheduled_at desc);
create index if not exists chat_sessions_business_idx on public.chat_sessions (business_id, started_at desc);
create index if not exists notifications_user_idx    on public.notifications (user_id, is_read, created_at desc);
create index if not exists audit_logs_business_idx   on public.audit_logs (business_id, created_at desc);
