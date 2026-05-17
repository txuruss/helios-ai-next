-- ============================================================
-- HELIOS AI — Phase 26: Deployment Score & Audit Engine
-- Idempotent migration — safe to run multiple times.
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── 1. business_audits ───────────────────────────────────────────

create table if not exists public.business_audits (
  id                             uuid primary key default gen_random_uuid(),
  business_id                    uuid not null,
  audit_name                     text not null,
  business_name                  text,
  website_url                    text,
  business_type                  text,
  city                           text,
  country                        text,
  source                         text not null default 'manual',
  status                         text not null default 'draft',
  overall_score                  integer not null default 0,
  response_score                 integer not null default 0,
  booking_score                  integer not null default 0,
  lead_capture_score             integer not null default 0,
  trust_score                    integer not null default 0,
  automation_score               integer not null default 0,
  recommended_plan               text,
  estimated_monthly_lead_risk    integer,
  estimated_monthly_booking_risk integer,
  estimated_revenue_risk         text,
  summary                        text,
  created_by                     uuid,
  completed_at                   timestamptz,
  metadata                       jsonb not null default '{}',
  created_at                     timestamptz not null default now(),
  updated_at                     timestamptz not null default now()
);

-- ── 2. business_audit_findings ───────────────────────────────────

create table if not exists public.business_audit_findings (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null,
  audit_id        uuid not null,
  category        text not null,
  severity        text not null default 'medium',
  title           text not null,
  description     text,
  recommendation  text,
  related_plan    text,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now()
);

-- ── 3. business_audit_recommendations ────────────────────────────

create table if not exists public.business_audit_recommendations (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null,
  audit_id          uuid not null,
  recommended_plan  text not null,
  setup_fee         text,
  monthly_fee       text,
  reason            text,
  included_features text[] not null default '{}',
  next_steps        text[] not null default '{}',
  created_at        timestamptz not null default now()
);

-- ── 4. audit_report_exports ──────────────────────────────────────

create table if not exists public.audit_report_exports (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null,
  audit_id     uuid not null,
  export_type  text not null,
  status       text not null default 'created',
  file_name    text,
  safe_summary text,
  created_by   uuid,
  created_at   timestamptz not null default now()
);

-- ── 5. Indexes ────────────────────────────────────────────────────

create index if not exists business_audits_business_status_idx
  on public.business_audits (business_id, status);

create index if not exists business_audits_business_created_idx
  on public.business_audits (business_id, created_at desc);

create index if not exists business_audits_recommended_plan_idx
  on public.business_audits (business_id, recommended_plan)
  where recommended_plan is not null;

create index if not exists business_audit_findings_audit_idx
  on public.business_audit_findings (business_id, audit_id);

create index if not exists business_audit_findings_severity_idx
  on public.business_audit_findings (audit_id, severity);

create index if not exists business_audit_recommendations_audit_idx
  on public.business_audit_recommendations (business_id, audit_id);

create index if not exists audit_report_exports_audit_idx
  on public.audit_report_exports (business_id, audit_id);

-- ── 6. RLS ────────────────────────────────────────────────────────

alter table public.business_audits               enable row level security;
alter table public.business_audit_findings       enable row level security;
alter table public.business_audit_recommendations enable row level security;
alter table public.audit_report_exports          enable row level security;

do $$
begin
  -- business_audits
  if not exists (select 1 from pg_policies where tablename='business_audits' and policyname='members_manage_own_audits') then
    execute $p$ create policy members_manage_own_audits on public.business_audits for all using (is_business_member(business_id)) with check (is_business_member(business_id)) $p$;
  end if;
  if not exists (select 1 from pg_policies where tablename='business_audits' and policyname='service_role_manage_audits') then
    execute $p$ create policy service_role_manage_audits on public.business_audits for all using (true) with check (true) $p$;
  end if;

  -- business_audit_findings
  if not exists (select 1 from pg_policies where tablename='business_audit_findings' and policyname='members_read_own_findings') then
    execute $p$ create policy members_read_own_findings on public.business_audit_findings for select using (is_business_member(business_id)) $p$;
  end if;
  if not exists (select 1 from pg_policies where tablename='business_audit_findings' and policyname='service_role_manage_findings') then
    execute $p$ create policy service_role_manage_findings on public.business_audit_findings for all using (true) with check (true) $p$;
  end if;

  -- business_audit_recommendations
  if not exists (select 1 from pg_policies where tablename='business_audit_recommendations' and policyname='members_read_own_recommendations') then
    execute $p$ create policy members_read_own_recommendations on public.business_audit_recommendations for select using (is_business_member(business_id)) $p$;
  end if;
  if not exists (select 1 from pg_policies where tablename='business_audit_recommendations' and policyname='service_role_manage_recommendations') then
    execute $p$ create policy service_role_manage_recommendations on public.business_audit_recommendations for all using (true) with check (true) $p$;
  end if;

  -- audit_report_exports
  if not exists (select 1 from pg_policies where tablename='audit_report_exports' and policyname='members_read_own_exports') then
    execute $p$ create policy members_read_own_exports on public.audit_report_exports for select using (is_business_member(business_id)) $p$;
  end if;
  if not exists (select 1 from pg_policies where tablename='audit_report_exports' and policyname='service_role_manage_exports') then
    execute $p$ create policy service_role_manage_exports on public.audit_report_exports for all using (true) with check (true) $p$;
  end if;
end;
$$;
