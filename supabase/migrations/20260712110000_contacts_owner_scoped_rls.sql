-- contacts had exactly one policy: "contacts_agency_isolation" (cmd ALL,
-- USING agency_id = current_agency_id()) — every agent in the agency could
-- read AND write every other agent's owner/client contacts, full PII
-- included (phone, email). contacts already had an agent_id column that
-- nothing populated or enforced. Backfill it from the earliest linking
-- meeting_properties row where inferable, then replace the open policy with
-- owner/admin-scoped ones. Contacts with no inferable owner (general leads
-- pool, not yet tied to a specific listing) stay NULL and remain
-- agency-wide visible/editable — same treatment meeting_properties already
-- gives a null agent_id.

update contacts c
set agent_id = mp.agent_id
from (
  select distinct on (owner_contact_id) owner_contact_id, agent_id
  from meeting_properties
  where owner_contact_id is not null and agent_id is not null
  order by owner_contact_id, created_at asc
) mp
where c.id = mp.owner_contact_id
  and c.agent_id is null;

drop policy if exists "contacts_agency_isolation" on contacts;

create policy "contacts_insert" on contacts
  for insert with check (agency_id = current_agency_id());

create policy "contacts_select" on contacts
  for select using (
    agency_id = current_agency_id()
    and (agent_id is null or agent_id = current_agent_id() or is_ceo_or_admin())
  );

create policy "contacts_update" on contacts
  for update using (
    agency_id = current_agency_id()
    and (agent_id is null or agent_id = current_agent_id() or is_ceo_or_admin())
  );

create policy "contacts_delete" on contacts
  for delete using (
    agency_id = current_agency_id()
    and (agent_id is null or agent_id = current_agent_id() or is_ceo_or_admin())
  );
