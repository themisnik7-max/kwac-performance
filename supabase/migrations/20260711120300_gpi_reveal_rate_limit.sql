-- 049: rate-limit GPI credential reveals. Previously nothing stopped a
-- compromised admin/CEO session from looping POST /api/gpi/clients/[id]/reveal
-- over every client in the agency and exfiltrating every landlord's
-- taxisnet credentials in seconds — canAccessGpiClient() correctly lets an
-- admin/ceo caller through for every client in their agency (by design),
-- and the only trace was one gpi_credential_access_log row per call, which
-- nothing reads or alerts on. Same atomic-counter pattern as
-- ai_admin_usage_daily (migration 020), hourly-bucketed since reveal abuse
-- plays out in seconds-to-minutes, not a full day.

create table if not exists gpi_reveal_usage_hourly (
  agent_id     uuid not null references agents(id),
  agency_id    uuid not null references agencies(id),
  hour_bucket  timestamptz not null,
  reveal_count integer not null default 0,
  primary key (agent_id, hour_bucket)
);

create index if not exists idx_gpi_reveal_usage_agency on gpi_reveal_usage_hourly (agency_id, hour_bucket);

alter table gpi_reveal_usage_hourly enable row level security;
drop policy if exists "gpi_reveal_usage_hourly_agency_isolation" on gpi_reveal_usage_hourly;
create policy "gpi_reveal_usage_hourly_agency_isolation" on gpi_reveal_usage_hourly
  for all using (agency_id = current_agency_id());

create or replace function increment_gpi_reveal_usage(p_agent_id uuid, p_agency_id uuid)
returns integer
language plpgsql
as $$
declare
  new_count integer;
  bucket timestamptz := date_trunc('hour', now());
begin
  insert into gpi_reveal_usage_hourly (agent_id, agency_id, hour_bucket, reveal_count)
  values (p_agent_id, p_agency_id, bucket, 1)
  on conflict (agent_id, hour_bucket)
  do update set reveal_count = gpi_reveal_usage_hourly.reveal_count + 1
  returning reveal_count into new_count;
  return new_count;
end;
$$;

select 'GPI reveal rate limiting installed' as status;
