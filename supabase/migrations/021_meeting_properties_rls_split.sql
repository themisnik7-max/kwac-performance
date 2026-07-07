-- 021: meeting_properties had one blanket "for all" RLS policy (agency
-- isolation only) since migration 002 — any agent in the agency could
-- select/update/delete ANY other agent's property, including still-private
-- 'pending' ones. app/meeting/page.tsx even had a comment claiming "RLS
-- already enforces non-owners see only for_appraisal" — that was never
-- actually true. Splitting into real per-operation policies:
--   SELECT: your own properties at any stage, everyone else's once they're
--           past 'pending' (i.e. promoted to the shared Meeting Ακινήτων
--           review), or anything if you're CEO/Admin.
--   UPDATE/DELETE: owner or CEO/Admin only — closes the "no one has editing
--           permission [on properties they don't own]" gap.
--   INSERT: any agent in the agency (creating their own new property).

drop policy if exists "meeting_properties_agency_isolation" on meeting_properties;

create policy "meeting_properties_select" on meeting_properties
  for select using (
    agency_id = current_agency_id()
    and (agent_id = current_agent_id() or status <> 'pending' or is_ceo_or_admin())
  );

create policy "meeting_properties_insert" on meeting_properties
  for insert with check (agency_id = current_agency_id());

create policy "meeting_properties_update" on meeting_properties
  for update using (
    agency_id = current_agency_id()
    and (agent_id = current_agent_id() or is_ceo_or_admin())
  );

create policy "meeting_properties_delete" on meeting_properties
  for delete using (
    agency_id = current_agency_id()
    and (agent_id = current_agent_id() or is_ceo_or_admin())
  );

select 'meeting_properties RLS split into per-operation policies' as status;
