-- 045: Exclusive Leasing Agreement autofill for GPI.
--
-- Adds the unit-level fields the KWAC "Exclusive Representation Agreement
-- Lease/Rent" template needs that gpi_units didn't have yet (description,
-- notices, agreement duration — exclusive_agreement_date already existed
-- and is treated as the contract's signature date; expiry is computed from
-- date + duration rather than stored, to avoid two fields drifting apart).
--
-- gpi_agreement_shares is a magic-link table: emailing the filled agreement
-- to an external landlord (who has no login) means a public route needs to
-- resolve *some* identifier to the right client+unit without exposing raw
-- database IDs or embedding TIN/ID-number PII directly in the emailed URL
-- (unlike app/marketing/brochure's ?d= base64 pattern — fine for a property
-- brochure, not fine for a National ID number). A random, unguessable,
-- optionally-expiring token is the standard "magic link" answer to that.
--
-- demo=true on gpi_clients follows CLAUDE.md's "demo data must be clearly
-- marked" rule — this migration also seeds one demo client+unit so the
-- agreement template can be previewed end-to-end without real client data.

alter table gpi_units  add column if not exists description text;
alter table gpi_units  add column if not exists notices text;
alter table gpi_units  add column if not exists exclusive_agreement_duration_months integer;
alter table gpi_clients add column if not exists demo boolean not null default false;

create table if not exists gpi_agreement_shares (
  id           uuid default gen_random_uuid() primary key,
  agency_id    uuid not null references agencies(id) on delete cascade,
  unit_id      uuid not null references gpi_units(id) on delete cascade,
  token        text not null unique,
  sent_to_email text,
  created_by   uuid references agents(id) on delete set null,
  created_at   timestamptz default now(),
  expires_at   timestamptz,
  viewed_at    timestamptz
);

create index if not exists idx_gpi_agreement_shares_token on gpi_agreement_shares(token);

alter table gpi_agreement_shares enable row level security;

-- Defense-in-depth only — the public view route uses the service-role
-- client (bypasses RLS) because the recipient has no agent session at all;
-- the token match itself is the real access control there.
create policy "gpi_agreement_shares_owner_or_admin" on gpi_agreement_shares
  for all using (agency_id = current_agency_id() and (created_by = current_agent_id() or is_ceo_or_admin()));

-- ── Demo client + unit (idempotent) ─────────────────────────────────
do $$
declare
  default_agency uuid;
  demo_agent     uuid;
  demo_client    uuid;
begin
  select id into default_agency from agencies order by created_at limit 1;
  if default_agency is null then return; end if;

  select id into demo_agent from agents
    where agency_id = default_agency and (full_name ilike '%demo%agent%' or email ilike '%demo%')
    order by created_at limit 1;
  if demo_agent is null then
    select id into demo_agent from agents where agency_id = default_agency order by created_at limit 1;
  end if;

  select id into demo_client from gpi_clients
    where agency_id = default_agency and demo = true and full_name = 'Δημήτριος Παπαδόπουλος (DEMO)';

  if demo_client is null then
    insert into gpi_clients (
      agency_id, agent_id, demo, full_name, father_name, tin_number, id_passport_number,
      address, bank_account
    ) values (
      default_agency, demo_agent, true, 'Δημήτριος Παπαδόπουλος (DEMO)', 'Ιωάννης', '090000000', 'ΑΒ123456',
      'Λεωφόρος Κηφισίας 45, Αθήνα 115 23', 'GR16 0110 1250 0000 0125 4900 361'
    ) returning id into demo_client;

    insert into gpi_units (
      agency_id, client_id, agent_id, sqm, floor, project, address, unit_name, expected_rent,
      description, notices, exclusive_agreement_date, exclusive_agreement_duration_months
    ) values (
      default_agency, demo_client, demo_agent, 95, '3', 'Kolonaki Residences',
      'Πατριάρχου Ιωακείμ 12, Κολωνάκι, Αθήνα', 'Διαμέρισμα 3ου ορόφου', 1200,
      'Διαμπερές διαμέρισμα 95τ.μ., 2 υπνοδωμάτια, πλήρως ανακαινισμένο (2022), μπαλκόνι με θέα σε πράσινο.',
      'Κενό και διαθέσιμο από 01/09.', current_date, 6
    );
  end if;
end $$;

select 'GPI agreement fields + demo client seeded' as status;
