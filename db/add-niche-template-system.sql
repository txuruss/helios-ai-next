-- ============================================================
-- HELIOS AI — Phase 27: Niche Template System
-- Idempotent migration — safe to run multiple times.
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── 1. business_niche_templates ──────────────────────────────────

create table if not exists public.business_niche_templates (
  id                   uuid primary key default gen_random_uuid(),
  template_key         text unique not null,
  name                 text not null,
  business_type        text not null,
  description          text,
  recommended_plan     text not null default 'pro',
  setup_complexity     text not null default 'standard',
  estimated_setup_time text,
  ideal_for            text[] not null default '{}',
  services             jsonb not null default '[]',
  faqs                 jsonb not null default '[]',
  booking_rules        jsonb not null default '{}',
  ai_persona           jsonb not null default '{}',
  lead_capture         jsonb not null default '{}',
  widget_copy          jsonb not null default '{}',
  whatsapp_copy        jsonb not null default '{}',
  audit_assumptions    jsonb not null default '{}',
  demo_messages        jsonb not null default '[]',
  is_active            boolean not null default true,
  sort_order           integer not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ── 2. business_template_applications ────────────────────────────

create table if not exists public.business_template_applications (
  id                      uuid primary key default gen_random_uuid(),
  business_id             uuid not null,
  template_key            text not null,
  applied_by              uuid,
  apply_mode              text not null default 'append',
  services_created        integer not null default 0,
  faqs_created            integer not null default 0,
  business_fields_updated boolean not null default false,
  widget_updated          boolean not null default false,
  ai_persona_updated      boolean not null default false,
  status                  text not null default 'completed',
  safe_summary            text,
  metadata                jsonb not null default '{}',
  created_at              timestamptz not null default now()
);

-- ── 3. Indexes ────────────────────────────────────────────────────

create index if not exists business_niche_templates_key_idx
  on public.business_niche_templates (template_key);

create index if not exists business_niche_templates_type_idx
  on public.business_niche_templates (business_type);

create index if not exists business_niche_templates_plan_idx
  on public.business_niche_templates (recommended_plan);

create index if not exists business_template_applications_business_idx
  on public.business_template_applications (business_id);

create index if not exists business_template_applications_key_idx
  on public.business_template_applications (template_key);

create index if not exists business_template_applications_created_idx
  on public.business_template_applications (business_id, created_at desc);

-- ── 4. RLS ────────────────────────────────────────────────────────

alter table public.business_niche_templates       enable row level security;
alter table public.business_template_applications enable row level security;

do $$
begin
  -- Templates: all authenticated members can read active templates
  if not exists (select 1 from pg_policies where tablename='business_niche_templates' and policyname='members_read_active_templates') then
    execute $p$ create policy members_read_active_templates on public.business_niche_templates for select using (is_active = true) $p$;
  end if;
  if not exists (select 1 from pg_policies where tablename='business_niche_templates' and policyname='service_role_manage_templates') then
    execute $p$ create policy service_role_manage_templates on public.business_niche_templates for all using (true) with check (true) $p$;
  end if;

  -- Applications: members read own
  if not exists (select 1 from pg_policies where tablename='business_template_applications' and policyname='members_read_own_applications') then
    execute $p$ create policy members_read_own_applications on public.business_template_applications for select using (is_business_member(business_id)) $p$;
  end if;
  if not exists (select 1 from pg_policies where tablename='business_template_applications' and policyname='service_role_manage_applications') then
    execute $p$ create policy service_role_manage_applications on public.business_template_applications for all using (true) with check (true) $p$;
  end if;
end;
$$;

-- ── 5. Seed templates (idempotent upsert) ─────────────────────────

insert into public.business_niche_templates
  (template_key, name, business_type, description, recommended_plan, setup_complexity, estimated_setup_time, ideal_for, sort_order)
values
  ('barbershop',       'Barbershop',       'Barbershop',        'Classic barbershop setup with haircut services, booking rules, and friendly AI assistant.',         'pro',     'standard', '2–3 days', array['Walk-in and appointment barbershops','Solo barbers','Multi-chair shops'],           1),
  ('hair_salon',       'Hair Salon',       'Hair Salon',        'Full-service salon setup with styling, coloring, and treatment services.',                          'pro',     'standard', '2–3 days', array['Female-focused salons','Natural hair studios','Full-service hair salons'],         2),
  ('beauty_spa',       'Beauty Spa',       'Spa',               'Relaxation-focused spa setup with treatments, packages, and gift card FAQ support.',                'pro',     'standard', '2–3 days', array['Day spas','Nail bars','Lash studios','Wellness centers'],                         3),
  ('clinic',           'Clinic',           'Clinic',            'Appointment-based healthcare clinic setup with safety guidelines and human review controls.',        'scale',   'advanced', '3–5 days', array['GP clinics','Aesthetic clinics','Physiotherapy','Dental practices'],               4),
  ('cleaning_company', 'Cleaning Company', 'Cleaning',          'Residential and commercial cleaning booking setup with address and room count collection.',         'starter', 'simple',   '1–2 days', array['Residential cleaning','Office cleaning','Post-construction cleaning'],             5),
  ('auto_repair',      'Auto Repair Shop', 'Auto Repair',       'Vehicle service booking setup with make/model collection and diagnosis request handling.',          'pro',     'standard', '2–3 days', array['Mechanic shops','Tyre centres','Auto detailing','Car service businesses'],         6),
  ('tutor',            'Tutor / Education','Education',         'Online and in-person tutoring session booking with subject and age group collection.',              'starter', 'simple',   '1–2 days', array['Private tutors','Online tutoring centres','Exam prep services','Study groups'],    7)
on conflict (template_key) do update set
  name                 = excluded.name,
  business_type        = excluded.business_type,
  description          = excluded.description,
  recommended_plan     = excluded.recommended_plan,
  setup_complexity     = excluded.setup_complexity,
  estimated_setup_time = excluded.estimated_setup_time,
  ideal_for            = excluded.ideal_for,
  sort_order           = excluded.sort_order,
  updated_at           = now();
