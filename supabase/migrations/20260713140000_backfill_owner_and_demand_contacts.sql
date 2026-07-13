-- "Every property owner and every demand client is also a client" — a
-- one-time catch-up so every EXISTING meeting_properties/demand_profiles
-- row gets a real contacts card, not just new ones going forward (voice-
-- ingest's find-or-create already covers new rows as of the previous two
-- migrations today). Same matching rule as the app code: same agent's
-- existing contact by phone first, else create one — never agency-wide,
-- to avoid the cross-agent contact leak fixed earlier today.
--
-- Scoped to rows that have a phone number — that's the only reliable dedup
-- key available (matches voice-ingest's own `if (phone && ...)` gate; a
-- name with no phone has no way to distinguish "same person mentioned
-- twice" from "two different people who share a name").

-- ── Property owners ──────────────────────────────────────────────────
update meeting_properties mp
set owner_contact_id = c.id
from contacts c
where mp.owner_contact_id is null
  and mp.owner_phone is not null
  and mp.agent_id = c.agent_id
  and (c.phone = mp.owner_phone or c.phone2 = mp.owner_phone);

with to_create as (
  select distinct on (agent_id, owner_phone) agent_id, agency_id, owner_phone, owner_name, owner_email
  from meeting_properties
  where owner_contact_id is null and owner_phone is not null and agent_id is not null
  order by agent_id, owner_phone, created_at asc
),
inserted as (
  insert into contacts (agency_id, agent_id, full_name, phone, email, type, sources)
  select agency_id, agent_id, owner_name, owner_phone, owner_email, 'contact', array['meeting_properties_backfill']
  from to_create
  returning id, agent_id, phone
)
update meeting_properties mp
set owner_contact_id = i.id
from inserted i
where mp.owner_contact_id is null
  and mp.agent_id = i.agent_id
  and mp.owner_phone = i.phone;

-- ── Demand clients ───────────────────────────────────────────────────
update demand_profiles dp
set contact_id = c.id
from contacts c
where dp.contact_id is null
  and dp.client_phone is not null
  and dp.agent_id = c.agent_id
  and (c.phone = dp.client_phone or c.phone2 = dp.client_phone);

with to_create as (
  select distinct on (agent_id, client_phone) agent_id, agency_id, client_phone, client_name, client_email
  from demand_profiles
  where contact_id is null and client_phone is not null and agent_id is not null
  order by agent_id, client_phone, created_at asc
),
inserted as (
  insert into contacts (agency_id, agent_id, full_name, phone, email, type, sources)
  select agency_id, agent_id, client_name, client_phone, client_email, 'contact', array['demand_profiles_backfill']
  from to_create
  returning id, agent_id, phone
)
update demand_profiles dp
set contact_id = i.id
from inserted i
where dp.contact_id is null
  and dp.agent_id = i.agent_id
  and dp.client_phone = i.phone;

-- ── Close the loop ───────────────────────────────────────────────────
-- Contacts created by either block above might match an UNLINKED row on
-- the OTHER side sharing the same (agent, phone) — e.g. a demand backfill
-- just created a contact for a phone that also owns a property nobody had
-- linked yet. Re-run both link-only passes once more now that both sets of
-- new contacts exist.
update meeting_properties mp
set owner_contact_id = c.id
from contacts c
where mp.owner_contact_id is null
  and mp.owner_phone is not null
  and mp.agent_id = c.agent_id
  and (c.phone = mp.owner_phone or c.phone2 = mp.owner_phone);

update demand_profiles dp
set contact_id = c.id
from contacts c
where dp.contact_id is null
  and dp.client_phone is not null
  and dp.agent_id = c.agent_id
  and (c.phone = dp.client_phone or c.phone2 = dp.client_phone);

select 'owner + demand-client contact backfill complete' as status;
