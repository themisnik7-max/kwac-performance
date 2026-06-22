-- ================================================
-- KWAC OS — Multi-tenancy + RLS hardening
-- Run this in Supabase SQL Editor, AFTER schema_update.sql
-- Safe to re-run (idempotent): uses IF NOT EXISTS / IF EXISTS everywhere.
-- ================================================

-- 1. Agencies table (the tenant)
create table if not exists agencies (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  brevo_api_key_encrypted text,
  created_at timestamptz default now()
);

-- Seed the one agency that exists today. Safe to re-run — only inserts if empty.
insert into agencies (name)
select 'Default Agency'
where not exists (select 1 from agencies);

-- 2. Helper: add agency_id to a table only if that table exists, without erroring
-- if it doesn't (some of these may live only in the live Supabase project, not
-- fully captured in earlier migration files).
do $$
declare
  tbl text;
  tables text[] := array[
    'agents','properties','contacts','room_bookings','marketing_actions',
    'sprint_sessions','sprint_entries','open_house_volunteers','open_houses',
    'rooms','weekly_submissions','gps_goals','meeting_properties',
    'meeting_valuations','pipeline_properties','pipeline_events'
  ];
  default_agency uuid;
begin
  select id into default_agency from agencies order by created_at limit 1;

  foreach tbl in array tables loop
    if to_regclass('public.' || tbl) is not null then
      execute format('alter table %I add column if not exists agency_id uuid references agencies(id)', tbl);
      execute format('update %I set agency_id = %L where agency_id is null', tbl, default_agency);
    end if;
  end loop;
end $$;

-- 3. Helper functions for RLS policies — look up the calling user's agent row
-- by email (matches the pattern already used in lib/AppContext.tsx).
create or replace function current_agent_id() returns uuid
language sql stable security definer as $$
  select id from agents where email = auth.email() limit 1;
$$;

create or replace function current_agency_id() returns uuid
language sql stable security definer as $$
  select agency_id from agents where email = auth.email() limit 1;
$$;

create or replace function current_agent_role() returns text
language sql stable security definer as $$
  select role from agents where email = auth.email() limit 1;
$$;

create or replace function is_ceo_or_admin() returns boolean
language sql stable security definer as $$
  select coalesce(current_agent_role() in ('ceo','admin'), false);
$$;

-- 4. RLS — agency isolation everywhere, plus per-agent privacy on personal
-- performance data (Μετρησιμότητα / Sprint Calls / GPS goals), matching the
-- product spec: agents see their own numbers, CEO/Admin see everything in
-- their agency. No agent ever sees another agency's data, full stop.

-- Shared-within-agency tables: any agent in the agency can see/use these.
do $$
declare
  tbl text;
  tables text[] := array[
    'properties','contacts','room_bookings','marketing_actions',
    'sprint_sessions','open_house_volunteers','open_houses','rooms',
    'meeting_properties','meeting_valuations','pipeline_properties','pipeline_events'
  ];
begin
  foreach tbl in array tables loop
    if to_regclass('public.' || tbl) is not null then
      execute format('alter table %I enable row level security', tbl);
      execute format('drop policy if exists "%s_agency_isolation" on %I', tbl, tbl);
      execute format(
        'create policy "%s_agency_isolation" on %I for all using (agency_id = current_agency_id())',
        tbl, tbl
      );
    end if;
  end loop;
end $$;

-- Personal-performance tables: owner agent or CEO/Admin only.
do $$
declare
  tbl text;
  tables text[] := array['weekly_submissions','sprint_entries','gps_goals'];
begin
  foreach tbl in array tables loop
    if to_regclass('public.' || tbl) is not null then
      execute format('alter table %I enable row level security', tbl);
      execute format('drop policy if exists "%s_owner_or_admin" on %I', tbl, tbl);
      execute format(
        'create policy "%s_owner_or_admin" on %I for all using (agency_id = current_agency_id() and (agent_id = current_agent_id() or is_ceo_or_admin()))',
        tbl, tbl
      );
    end if;
  end loop;
end $$;

-- agents table itself: everyone in the agency can see colleague names (needed
-- for dropdowns/leaderboards), but only CEO/Admin can see everyone's full row
-- if you later add sensitive columns (commission %, salary, etc) — split that
-- out into a separate table when it exists rather than relying on column-level
-- security here.
alter table agents enable row level security;
drop policy if exists "agents_agency_isolation" on agents;
create policy "agents_agency_isolation" on agents for all using (agency_id = current_agency_id());

select 'Multi-tenancy + RLS migration applied' as status;
