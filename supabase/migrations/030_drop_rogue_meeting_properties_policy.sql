-- 030: found via live testing (a non-owner agent's UPDATE succeeded when it
-- should have been blocked by 021's new policies) — meeting_properties had
-- a 5th policy, "meeting_props_all", never captured in any migration file,
-- granting `for all using (auth.role() = 'authenticated')`: full read/write
-- to every operation for ANY authenticated user, with no agency check at
-- all. Postgres OR-combines permissive policies for the same command, so
-- this one alone made every restriction in 021 (and the base agency
-- isolation from 002) completely moot — not just cross-agent within a
-- tenant, but cross-tenant entirely. Confirmed via _diag_list_policies
-- (029, now dropped below along with the diagnostic function).

drop policy if exists "meeting_props_all" on meeting_properties;
drop function if exists _diag_list_policies(text);

select 'dropped rogue meeting_props_all policy — meeting_properties is now actually agency+owner scoped' as status;
