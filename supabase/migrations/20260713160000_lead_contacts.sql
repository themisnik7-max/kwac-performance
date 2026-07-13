-- Gmail lead capture: an inbound "expression of interest" email (Spitogatos/
-- xe.gr-style portal notification) names a specific listing, not an owner or
-- a buyer-side requirement — a third relationship contacts didn't have yet
-- (owner-of via meeting_properties.owner_contact_id, demand-for via
-- demand_profiles.contact_id, now interested-in).
alter table contacts add column if not exists interested_property_id uuid references meeting_properties(id) on delete set null;

create index if not exists contacts_interested_property_id_idx on contacts(interested_property_id);

select 'contacts.interested_property_id added for Gmail-lead capture' as status;
