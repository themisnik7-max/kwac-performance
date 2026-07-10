-- 044: GPI — long-term rental / property-management client tracking.
-- New domain, deliberately not linked to the sales/valuation tables. Client
-- (the owner) and unit (a specific property/lease they have in the program)
-- are separate, linked tables since one owner can have multiple units.
--
-- Sensitive fields — taxisnet username/password, authentication key —
-- are encrypted application-side (lib/crypto.ts, AES-256-GCM) before they
-- ever reach this table; Postgres never sees the plaintext, and no browser
-- request ever receives the ciphertext either (see lib/gpi.ts's
-- redactGpiClient — plaintext only ever leaves the server via the separate,
-- logged /api/gpi/clients/[id]/reveal route).
--
-- Access is restricted to the assigned agent + admin/ceo only (tighter than
-- the agency-wide sharing pattern used for properties/contacts), matching
-- weekly_submissions/sprint_entries/gps_goals' "owner or admin" RLS shape
-- from migration 002.

create table if not exists gpi_clients (
  id                          uuid default gen_random_uuid() primary key,
  agency_id                   uuid not null references agencies(id) on delete cascade,
  agent_id                    uuid references agents(id) on delete set null,
  full_name                   text not null,
  father_name                 text,
  tin_number                  text,
  id_passport_number          text,
  id_passport_photo_path      text,   -- storage path in the private gpi-documents bucket, not a URL — signed URLs are generated on read, never persisted (they expire)
  address                     text,
  bank_account                text,
  taxisnet_username_encrypted text,
  taxisnet_password_encrypted text,
  taxisnet_auth_key_encrypted text,
  created_at                  timestamptz default now(),
  updated_at                  timestamptz default now()
);

create table if not exists gpi_units (
  id                        uuid default gen_random_uuid() primary key,
  agency_id                 uuid not null references agencies(id) on delete cascade,
  client_id                 uuid not null references gpi_clients(id) on delete cascade,
  agent_id                  uuid references agents(id) on delete set null,   -- denormalized from gpi_clients.agent_id at insert time, so RLS here doesn't need a join
  sqm                       numeric,
  floor                     text,
  project                   text,
  address                   text,
  unit_name                 text,
  expected_rent             numeric,
  brochure_sent             boolean default false,
  exclusive_agreement_sent  boolean default false,
  exclusive_agreement_date  date,
  rented                    boolean default false,
  energy_certificate        boolean default false,
  advertisement             boolean default false,
  ad_link                   text,
  project_delivered         boolean default false,
  keys_received             boolean default false,
  created_at                timestamptz default now(),
  updated_at                timestamptz default now()
);

-- Audit trail for every time a taxisnet credential is decrypted and shown —
-- these are live AADE login credentials, so who-looked-when is worth keeping
-- even though nothing reads this table in the UI yet (admin/ceo can query it directly if needed).
create table if not exists gpi_credential_access_log (
  id           uuid default gen_random_uuid() primary key,
  agency_id    uuid not null references agencies(id) on delete cascade,
  client_id    uuid not null references gpi_clients(id) on delete cascade,
  accessed_by  uuid references agents(id) on delete set null,
  accessed_at  timestamptz default now()
);

create index if not exists idx_gpi_units_client  on gpi_units(client_id);
create index if not exists idx_gpi_clients_agency on gpi_clients(agency_id);
create index if not exists idx_gpi_units_agency   on gpi_units(agency_id);
create index if not exists idx_gpi_credential_log_client on gpi_credential_access_log(client_id);

alter table gpi_clients enable row level security;
alter table gpi_units enable row level security;
alter table gpi_credential_access_log enable row level security;

-- Reuses current_agency_id()/current_agent_id()/is_ceo_or_admin() from
-- migration 002 — same helpers the rest of this codebase's RLS relies on.
create policy "gpi_clients_owner_or_admin" on gpi_clients
  for all using (agency_id = current_agency_id() and (agent_id = current_agent_id() or is_ceo_or_admin()));

create policy "gpi_units_owner_or_admin" on gpi_units
  for all using (agency_id = current_agency_id() and (agent_id = current_agent_id() or is_ceo_or_admin()));

-- Audit log: admin/ceo can read it (it's an audit trail, not something an
-- agent browses); any authenticated caller in the agency can insert into it
-- (the reveal route inserts as the accessing agent, whoever that is).
create policy "gpi_credential_log_admin_read" on gpi_credential_access_log
  for select using (agency_id = current_agency_id() and is_ceo_or_admin());

create policy "gpi_credential_log_insert" on gpi_credential_access_log
  for insert with check (agency_id = current_agency_id());

-- ── Storage bucket for ID/passport photos ──────────────────────────
-- Private (no public URLs). All actual reads/writes go through
-- app/api/gpi/** using the service-role client (bypasses RLS, enforces
-- canAccessGpiClient itself) — these storage.objects policies are
-- defense-in-depth, scoped to the caller's own agency via the object path's
-- first folder segment (uploads are written to `${agency_id}/${client_id}/...`).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gpi-documents',
  'gpi-documents',
  false,
  15728640,
  array['image/jpeg','image/jpg','image/png','image/webp','image/heic','image/heif','application/pdf']
)
on conflict (id) do nothing;

create policy "gpi_documents_read_own_agency" on storage.objects
  for select using (bucket_id = 'gpi-documents' and (storage.foldername(name))[1] = current_agency_id()::text);

create policy "gpi_documents_upload_own_agency" on storage.objects
  for insert with check (bucket_id = 'gpi-documents' and (storage.foldername(name))[1] = current_agency_id()::text);

create policy "gpi_documents_delete_own_agency" on storage.objects
  for delete using (bucket_id = 'gpi-documents' and (storage.foldername(name))[1] = current_agency_id()::text);

select 'GPI tables + storage created' as status;
