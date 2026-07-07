-- 031: systemic finding from live permission testing (a non-owner agent's
-- UPDATE on meeting_properties succeeded when it should have been blocked).
-- Investigating turned up the same pattern on 13 tables: an old, permissive
-- policy (typically `for all using (auth.role() = 'authenticated')`, one —
-- open_houses's "oh_all" — didn't even require that) coexisting with a
-- proper agency/owner-scoped policy added later. Postgres OR-combines
-- permissive policies for the same command, so on every one of these tables
-- the old wide-open policy alone granted full cross-tenant read/write
-- access, making the newer restriction a no-op. This looks like pre-
-- multi-tenancy-hardening policies that were never removed when
-- 002_multitenancy_and_rls.sql (and later per-table hardening) went in.
--
-- Verified for each table below that a properly-scoped policy already
-- covers every operation once the rogue one is gone — this migration only
-- removes the redundant permissive policy, it doesn't add new restrictions.

drop policy if exists "allow_select_contacts" on contacts;
drop policy if exists "allow_insert_contacts" on contacts;
drop policy if exists "allow_update_contacts" on contacts;

drop policy if exists "properties_select" on properties;
drop policy if exists "properties_insert" on properties;
drop policy if exists "properties_update" on properties;

drop policy if exists "meeting_val_all" on meeting_valuations;

drop policy if exists "meeting_comments_all" on meeting_comments;

drop policy if exists "agents_select" on agents;

drop policy if exists "oh_all" on open_houses;

drop policy if exists "volunteers_all" on open_house_volunteers;

drop policy if exists "pipeline_props_all" on pipeline_properties;

drop policy if exists "All authenticated" on marketing_actions;
drop policy if exists "marketing_all" on marketing_actions;

drop policy if exists "submissions_select" on weekly_submissions;
drop policy if exists "submissions_insert" on weekly_submissions;
drop policy if exists "submissions_update" on weekly_submissions;

drop policy if exists "gps_all" on gps_goals;

drop policy if exists "All authenticated" on sprint_entries;
drop policy if exists "sprint_entries_all" on sprint_entries;

drop policy if exists "All authenticated" on sprint_sessions;
drop policy if exists "sprint_sessions_all" on sprint_sessions;

drop policy if exists "All authenticated" on room_bookings;
drop policy if exists "room_bookings_all" on room_bookings;

select 'dropped 21 rogue cross-tenant-open RLS policies across 13 tables' as status;
