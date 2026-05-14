-- ============================================================
-- HELIOS AI — SEED DATA (development / demo only)
-- Run AFTER schema.sql and policies.sql.
-- WARNING: Do NOT run in production.
-- ============================================================

-- This seed creates demo business data for a test user.
-- Replace <YOUR_USER_UUID> with the UUID from auth.users after signing up.

-- Usage:
--   1. Sign up at http://localhost:3000/signup
--   2. Copy your user UUID from Supabase Dashboard → Authentication → Users
--   3. Replace <YOUR_USER_UUID> below
--   4. Run this file in Supabase SQL Editor

do $$
declare
  v_user_id    uuid := '<YOUR_USER_UUID>';
  v_biz_id     uuid := uuid_generate_v4();
  v_svc_1      uuid := uuid_generate_v4();
  v_svc_2      uuid := uuid_generate_v4();
  v_svc_3      uuid := uuid_generate_v4();
begin

  -- ── Business ──
  insert into public.businesses (id, name, slug, description, business_type,
    city, country, owner_notification_email, hours)
  values (
    v_biz_id,
    'Island Glow Beauty Studio',
    'island-glow',
    'Premium beauty studio offering facials, lash lifts, and skin treatments.',
    'Beauty / Spa',
    'Kingston',
    'Jamaica',
    'owner@islandglow.com',
    '{
      "mon": {"open":"09:00","close":"17:00","closed":false},
      "tue": {"open":"09:00","close":"17:00","closed":false},
      "wed": {"open":"09:00","close":"17:00","closed":false},
      "thu": {"open":"09:00","close":"17:00","closed":false},
      "fri": {"open":"09:00","close":"18:00","closed":false},
      "sat": {"open":"09:00","close":"16:00","closed":false},
      "sun": {"open":"00:00","close":"00:00","closed":true}
    }'::jsonb
  );

  -- ── Business member (owner) ──
  insert into public.business_members (business_id, user_id, role)
  values (v_biz_id, v_user_id, 'owner');

  -- ── Services ──
  insert into public.services (id, business_id, name, description, price_cents, duration_min, sort_order)
  values
    (v_svc_1, v_biz_id, 'Signature Facial',   'Deep cleansing + hydration facial treatment.', 12000, 60, 1),
    (v_svc_2, v_biz_id, 'Hydra Glow Facial',  'Advanced hydration with hyaluronic infusion.',   16000, 75, 2),
    (v_svc_3, v_biz_id, 'Lash Lift & Tint',   'Natural-looking lash lift with colour tint.',     8500, 45, 3);

  -- ── Agent settings ──
  insert into public.agent_settings (business_id, agent_name, persona_prompt)
  values (
    v_biz_id,
    'Island Glow AI',
    'You are the friendly AI assistant for Island Glow Beauty Studio. Help customers book appointments, answer questions about services, and capture their contact details.'
  );

  -- ── Widget settings ──
  insert into public.widget_settings (business_id, bot_name, welcome_message)
  values (
    v_biz_id,
    'Island Glow AI',
    'Hi! Welcome to Island Glow. How can I help you today?'
  );

  -- ── Subscription (free tier) ──
  insert into public.subscriptions (business_id, plan, status)
  values (v_biz_id, 'free', 'trialing');

  -- ── Demo leads ──
  insert into public.leads (business_id, name, email, phone, source, status, intent, score)
  values
    (v_biz_id, 'Marcus Thompson',  'marcus@email.com', '+1876555001', 'widget',  'qualified', 'Book Signature Facial',  92),
    (v_biz_id, 'Alicia Brown',     'alicia@email.com', '+1876555002', 'whatsapp','new',       'Price for lash lift',    78),
    (v_biz_id, 'Devon Clarke',     'devon@email.com',  '+1876555003', 'widget',  'contacted', 'Saturday availability',  85),
    (v_biz_id, 'Simone Reid',      null,               '+1876555004', 'form',    'proposal',  'Monthly facial package', 91);

  -- ── Demo bookings ──
  insert into public.bookings (business_id, service_id, customer_name, customer_email, scheduled_at, duration_min, status)
  values
    (v_biz_id, v_svc_1, 'Jane Doe',    'jane@email.com',  now() + interval '2 days' + interval '11 hours 30 minutes', 60, 'confirmed'),
    (v_biz_id, v_svc_2, 'Sarah Mills', 'sarah@email.com', now() + interval '3 days' + interval '14 hours',             75, 'pending'),
    (v_biz_id, v_svc_3, 'Kim Chen',    'kim@email.com',   now() + interval '5 days' + interval '10 hours',             45, 'confirmed');

  raise notice 'Seed complete for business: %', v_biz_id;
end $$;
