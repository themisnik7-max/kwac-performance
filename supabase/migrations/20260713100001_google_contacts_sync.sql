-- Schema for the new Google Contacts -> contacts sync (personal, per-agent
-- OAuth connection; an agent tags people "KWAC" in their own Google
-- Contacts and pulls them into Personal Admin). contacts.first_name/
-- last_name/sources/kwac_tag already existed from an earlier one-time
-- import (see lib/contacts.ts's comment) but there was never a live sync
-- mechanism — this is what actually builds it.

-- Stable per-person Google id, so repeat syncs update the same row instead
-- of inserting duplicates every time. Scoped to (agent_id, resource_name),
-- not global, since two different agents could each have their own KWAC-
-- tagged copy of the same person in their own separate Google accounts.
alter table contacts add column if not exists google_resource_name text;

create unique index if not exists contacts_agent_google_resource_uniq
  on contacts(agent_id, google_resource_name)
  where google_resource_name is not null;

-- One Google account connected per agent (their own personal Contacts,
-- not an agency-shared account — matches how contacts.agent_id already
-- scopes ownership per-agent, not per-agency). Only an encrypted refresh
-- token is stored at rest, same pattern as lib/gpi.ts's taxisnet
-- credentials (see lib/crypto.ts) — never a plaintext token in Postgres.
create table if not exists google_contacts_connections (
  agent_id            uuid primary key references agents(id) on delete cascade,
  agency_id           uuid not null references agencies(id),
  refresh_token_encrypted text not null,
  google_email        text,
  connected_at         timestamptz not null default now(),
  last_synced_at        timestamptz,
  last_sync_count       integer,
  last_sync_error       text
);

alter table google_contacts_connections enable row level security;

-- Own connection only, or admin/ceo (support/troubleshooting a stuck sync)
-- — same shape as every other agent-scoped table in this schema.
create policy "google_contacts_connections_own" on google_contacts_connections
  for all using (agent_id = current_agent_id() or is_ceo_or_admin())
  with check (agent_id = current_agent_id() or is_ceo_or_admin());

select 'google_contacts_connections created; contacts.google_resource_name added' as status;
