-- 040: demand_profiles.agent_id FK'd to Supabase's internal auth.users(id),
-- not agents(id) — inconsistent with every other agent_id column in this
-- schema (weekly_submissions, meeting_properties, properties, etc. all
-- reference agents.id). agents.id is its own independent uuid, matched to
-- an auth user by email (see lib/auth.ts getAuthedAgent), NOT shared with
-- auth.users.id — except for the original 3 demo accounts, which happened
-- to be seeded with agents.id == their auth.users.id, making this bug
-- invisible until a normally-created agent (Xenofon Zades, Katerina, etc.)
-- tried to write a demand_profiles row via Personal Admin's Ζητήσεις tab
-- and silently got an FK violation. Found via _diag_fk_full (038) while
-- seeding ZadesHome team demo data.
alter table demand_profiles drop constraint if exists demand_profiles_agent_id_fkey;
alter table demand_profiles add constraint demand_profiles_agent_id_fkey
  foreign key (agent_id) references agents(id);

drop function if exists _diag_fk_target(text, text);
drop function if exists _diag_fk_full(text);
drop function if exists _diag_users_check();

select 'demand_profiles.agent_id now correctly references agents.id' as status;
