-- Two independent changes requested together:
--
-- 1. Personal Admin should show everyone's properties + demand profiles
-- (edit stays owner/admin-only). Live policy check (see the now-dropped
-- _diag_list_policies) showed meeting_properties already does exactly this
-- shape today — a plain agent can SELECT their own rows regardless of
-- status, plus any agency row once its status isn't 'pending' (021's
-- private-draft design) — so it needs no RLS change, just a client query
-- change (app/personal-admin/page.tsx).
--
-- demand_profiles has no equivalent: its only two policies (agent_own_demands,
-- admin_agency_demands) are both `for all`, so a plain agent cannot SELECT a
-- colleague's row at all today. Adding a SELECT-only, agency-wide policy
-- fixes this. Postgres OR-combines permissive policies for the same command
-- (the same mechanic that caused the rogue-policy incidents in migrations
-- 029-036) — here that's deliberate and scoped to SELECT only: the existing
-- two `for all` policies still fully govern INSERT/UPDATE/DELETE unchanged,
-- so only the owning agent or admin/ceo can ever write a row. Read = agency,
-- write = owner. This does not touch the existing policies at all.
create policy "demand_profiles_agency_select" on demand_profiles
  for select using (agency_id = current_agency_id());

-- 2. GPI should be locked to a designated account per agency, not the whole
-- agency the way properties/contacts are. A dedicated per-agent flag (not a
-- hardcoded email in application code) so a second agency can designate its
-- own GPI account later without a code change — hardcoding one agency's
-- email would be exactly the single-tenant shortcut CLAUDE.md flags as a
-- recurring bug class. admin/ceo keep their existing override on top of this
-- (unchanged — they already bypass via is_ceo_or_admin() everywhere else).
alter table agents add column if not exists gpi_access boolean not null default false;

update agents set gpi_access = true where email = 'demo@kwac.gr';

select 'demand_profiles agency-wide SELECT + agents.gpi_access added' as status;
