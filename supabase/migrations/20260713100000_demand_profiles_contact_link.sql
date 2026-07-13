-- Personal Admin is getting a unified "client card" view: every contact
-- should show whether they have a property, a demand, both, or neither.
-- meeting_properties already links to contacts via owner_contact_id;
-- demand_profiles never got the equivalent — it only ever stored
-- denormalized client_name/client_phone/client_email text with no FK, so
-- there was no reliable way to ask "does this contact have an active
-- demand" beyond a fuzzy phone/email string match (see the now-replaced
-- "Πιθανές Ζητήσεις" section on app/contacts/[id]/page.tsx).

alter table demand_profiles add column if not exists contact_id uuid references contacts(id) on delete set null;

create index if not exists demand_profiles_contact_id_idx on demand_profiles(contact_id);

-- Backfill: match existing demand_profiles to an existing contact owned by
-- the same agent with the same phone (falling back to email) — same-agent
-- only, matching how contacts are otherwise scoped, so this never links a
-- client to a contact card belonging to a colleague.
update demand_profiles dp
set contact_id = c.id
from contacts c
where dp.contact_id is null
  and dp.agent_id = c.agent_id
  and dp.client_phone is not null
  and (c.phone = dp.client_phone or c.phone2 = dp.client_phone);

update demand_profiles dp
set contact_id = c.id
from contacts c
where dp.contact_id is null
  and dp.agent_id = c.agent_id
  and dp.client_email is not null
  and c.email = dp.client_email;

select 'demand_profiles.contact_id added, backfilled by same-agent phone/email match' as status;
