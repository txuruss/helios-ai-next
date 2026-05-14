-- ============================================================
-- HELIOS AI — ROW LEVEL SECURITY POLICIES
-- Apply AFTER schema.sql.
-- Run as: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── Enable RLS on every table ─────────────────────────────────────
alter table public.profiles            enable row level security;
alter table public.businesses          enable row level security;
alter table public.business_members    enable row level security;
alter table public.services            enable row level security;
alter table public.faqs                enable row level security;
alter table public.agent_settings      enable row level security;
alter table public.chat_sessions       enable row level security;
alter table public.chat_messages       enable row level security;
alter table public.leads               enable row level security;
alter table public.bookings            enable row level security;
alter table public.calcom_connections  enable row level security;
alter table public.calcom_event_types  enable row level security;
alter table public.service_event_mappings enable row level security;
alter table public.widget_settings     enable row level security;
alter table public.notifications       enable row level security;
alter table public.audit_logs          enable row level security;
alter table public.subscriptions       enable row level security;

-- ── Helper function: is the current user a member of a business? ──
create or replace function public.is_business_member(bid uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.business_members
    where business_id = bid
      and user_id = auth.uid()
  );
$$;

-- ── profiles ──────────────────────────────────────────────────────
-- Users can read and update their own profile only.
create policy "profiles: own read"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles: own update"
  on public.profiles for update
  using (id = auth.uid());

-- System can insert profiles (via handle_new_user trigger).
-- No direct INSERT policy needed for end users.

-- ── businesses ────────────────────────────────────────────────────
-- Members can read the business they belong to.
create policy "businesses: members read"
  on public.businesses for select
  using (public.is_business_member(id));

-- Owners/admins can update their business.
create policy "businesses: owners update"
  on public.businesses for update
  using (public.is_business_member(id));

-- Authenticated users can create a business (they become the owner).
create policy "businesses: auth insert"
  on public.businesses for insert
  with check (auth.uid() is not null);

-- Owners can delete their business.
create policy "businesses: owners delete"
  on public.businesses for delete
  using (
    exists (
      select 1 from public.business_members
      where business_id = id
        and user_id = auth.uid()
        and role = 'owner'
    )
  );

-- ── business_members ──────────────────────────────────────────────
create policy "business_members: members read"
  on public.business_members for select
  using (public.is_business_member(business_id));

create policy "business_members: owners manage"
  on public.business_members for all
  using (
    exists (
      select 1 from public.business_members bm
      where bm.business_id = business_id
        and bm.user_id = auth.uid()
        and bm.role = 'owner'
    )
  );

-- Allow new owner to insert their own membership when creating a business.
create policy "business_members: self insert"
  on public.business_members for insert
  with check (user_id = auth.uid());

-- ── services ──────────────────────────────────────────────────────
create policy "services: members read"
  on public.services for select
  using (public.is_business_member(business_id));

create policy "services: members write"
  on public.services for all
  using (public.is_business_member(business_id));

-- ── faqs ──────────────────────────────────────────────────────────
create policy "faqs: members read"
  on public.faqs for select
  using (public.is_business_member(business_id));

create policy "faqs: members write"
  on public.faqs for all
  using (public.is_business_member(business_id));

-- ── agent_settings ────────────────────────────────────────────────
create policy "agent_settings: members read"
  on public.agent_settings for select
  using (public.is_business_member(business_id));

create policy "agent_settings: members write"
  on public.agent_settings for all
  using (public.is_business_member(business_id));

-- ── chat_sessions ─────────────────────────────────────────────────
-- Dashboard users (members) can read their business's sessions.
create policy "chat_sessions: members read"
  on public.chat_sessions for select
  using (public.is_business_member(business_id));

-- Phase 2: The AI widget creates sessions as anonymous / service-role.
-- No anonymous INSERT policy here — widget API uses service role server-side.

-- ── chat_messages ─────────────────────────────────────────────────
create policy "chat_messages: members read"
  on public.chat_messages for select
  using (public.is_business_member(business_id));

-- ── leads ─────────────────────────────────────────────────────────
create policy "leads: members read"
  on public.leads for select
  using (public.is_business_member(business_id));

create policy "leads: members write"
  on public.leads for all
  using (public.is_business_member(business_id));

-- ── bookings ──────────────────────────────────────────────────────
create policy "bookings: members read"
  on public.bookings for select
  using (public.is_business_member(business_id));

create policy "bookings: members write"
  on public.bookings for all
  using (public.is_business_member(business_id));

-- ── calcom_connections ────────────────────────────────────────────
-- Readable by members; writable only by service role (Phase 2 OAuth flow).
create policy "calcom_connections: members read"
  on public.calcom_connections for select
  using (public.is_business_member(business_id));

-- ── calcom_event_types ────────────────────────────────────────────
create policy "calcom_event_types: members read"
  on public.calcom_event_types for select
  using (public.is_business_member(business_id));

-- ── service_event_mappings ────────────────────────────────────────
create policy "service_event_mappings: members read"
  on public.service_event_mappings for select
  using (public.is_business_member(business_id));

create policy "service_event_mappings: members write"
  on public.service_event_mappings for all
  using (public.is_business_member(business_id));

-- ── widget_settings ───────────────────────────────────────────────
create policy "widget_settings: members read"
  on public.widget_settings for select
  using (public.is_business_member(business_id));

create policy "widget_settings: members write"
  on public.widget_settings for all
  using (public.is_business_member(business_id));

-- Phase 2: Public (unauthenticated) SELECT for widget embed to read branding.
-- Uncomment when widget is live:
-- create policy "widget_settings: public read enabled"
--   on public.widget_settings for select
--   using (is_enabled = true);

-- ── notifications ─────────────────────────────────────────────────
create policy "notifications: own read"
  on public.notifications for select
  using (user_id = auth.uid());

create policy "notifications: own update"
  on public.notifications for update
  using (user_id = auth.uid());

-- ── audit_logs ────────────────────────────────────────────────────
-- Read-only for business members; no direct writes from client.
create policy "audit_logs: members read"
  on public.audit_logs for select
  using (public.is_business_member(business_id));

-- ── subscriptions ─────────────────────────────────────────────────
create policy "subscriptions: members read"
  on public.subscriptions for select
  using (public.is_business_member(business_id));

-- Phase 2: Stripe webhook (service role) writes subscriptions.
-- No client INSERT/UPDATE policy needed.
