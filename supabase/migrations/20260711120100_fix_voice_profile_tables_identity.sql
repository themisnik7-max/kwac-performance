-- 047: voice_notes, demand_profiles, property_scouted, and
-- meeting_properties.first_registered_by all have the same identity bug
-- migration 040 already fixed once for demand_profiles.agent_id's FK, but
-- never followed through on the RLS side, and never touched the sibling
-- tables from the same file (009_voice_profiles.sql / the identically-named
-- migrations/20260626120000_voice_profiles.sql).
--
-- Root cause: these columns/policies were hand-written against auth.uid()
-- instead of reusing current_agent_id()/current_agency_id() (migration
-- 002's helpers, keyed by email — the pattern every other table in this
-- schema correctly uses). agents.id is its own independent uuid, matched
-- to an auth user by email, NOT equal to auth.users.id except for the 3
-- original demo accounts — so both the FK and the RLS policy silently only
-- ever worked for those 3 accounts.
--
-- Confirmed live (pg_dump, 2026-07-11) before writing this:
--   demand_profiles.agent_id        -> agents(id)      [FK already fixed, migration 040]
--   voice_notes.agent_id            -> auth.users(id)   [broken]
--   property_scouted.agent_id       -> auth.users(id)   [broken; table has no live write path today, fixing anyway]
--   meeting_properties.first_registered_by -> auth.users(id) [drift: migration 006 says agents(id)]
-- All five RLS policies below (demand_profiles x2, voice_notes x2,
-- property_scouted x2) still compare against auth.uid() regardless of FK
-- state.
--
-- This migration is paired with a code fix to app/api/voice-ingest/route.ts
-- (switches from an ad-hoc auth.users lookup to getAuthedAgent, and writes
-- agents.id everywhere these columns expect it) — shipping one without the
-- other would just move the break, not fix it.

-- ── FK repoints ──────────────────────────────────────────────────

alter table voice_notes drop constraint if exists voice_notes_agent_id_fkey;
alter table voice_notes add constraint voice_notes_agent_id_fkey
  foreign key (agent_id) references agents(id) on delete cascade;

alter table property_scouted drop constraint if exists property_scouted_agent_id_fkey;
alter table property_scouted add constraint property_scouted_agent_id_fkey
  foreign key (agent_id) references agents(id) on delete cascade;

alter table meeting_properties drop constraint if exists meeting_properties_first_registered_by_fkey;
alter table meeting_properties add constraint meeting_properties_first_registered_by_fkey
  foreign key (first_registered_by) references agents(id) on delete set null;

-- ── RLS: rewrite to use current_agent_id()/current_agency_id()/is_ceo_or_admin() ──

drop policy if exists "agent_own_demands" on demand_profiles;
create policy "agent_own_demands" on demand_profiles
  for all using (agency_id = current_agency_id() and agent_id = current_agent_id());

drop policy if exists "admin_agency_demands" on demand_profiles;
create policy "admin_agency_demands" on demand_profiles
  for all using (agency_id = current_agency_id() and is_ceo_or_admin());

drop policy if exists "agent_own_voice_notes" on voice_notes;
create policy "agent_own_voice_notes" on voice_notes
  for all using (agency_id = current_agency_id() and agent_id = current_agent_id());

drop policy if exists "admin_all_voice_notes" on voice_notes;
create policy "admin_all_voice_notes" on voice_notes
  for all using (agency_id = current_agency_id() and is_ceo_or_admin());

drop policy if exists "agent_own_scouted" on property_scouted;
create policy "agent_own_scouted" on property_scouted
  for all using (agency_id = current_agency_id() and agent_id = current_agent_id());

drop policy if exists "admin_agency_scouted" on property_scouted;
create policy "admin_agency_scouted" on property_scouted
  for all using (agency_id = current_agency_id() and is_ceo_or_admin());

select 'voice_notes / demand_profiles / property_scouted identity + RLS fixed; meeting_properties.first_registered_by FK repointed to agents(id)' as status;
