-- 032: app/api/log-call/route.ts (pre-existing, not written this session)
-- references a `call_events` table and an `increment_weekly_call_count` RPC
-- that don't exist on the live database at all — found while verifying the
-- new AI Admin log_call tool, which is built on the same route's logic.
-- Neither was ever captured in any prior migration file.

create table if not exists call_events (
  id         uuid default gen_random_uuid() primary key,
  agent_id   uuid references agents(id),
  agency_id  uuid references agencies(id),
  contact_id uuid references contacts(id),
  phone      text not null,
  called_at  timestamptz not null default now()
);

create index if not exists call_events_agent_called_idx on call_events (agent_id, called_at desc);

create table if not exists call_counts_weekly (
  agent_id   uuid not null references agents(id),
  agency_id  uuid not null references agencies(id),
  week_start date not null,
  count      integer not null default 0,
  primary key (agent_id, week_start)
);

create or replace function increment_weekly_call_count(p_agent_id uuid, p_agency_id uuid, p_week_start date)
returns integer
language plpgsql
as $$
declare
  new_count integer;
begin
  insert into call_counts_weekly (agent_id, agency_id, week_start, count)
  values (p_agent_id, p_agency_id, p_week_start, 1)
  on conflict (agent_id, week_start)
  do update set count = call_counts_weekly.count + 1
  returning count into new_count;
  return new_count;
end;
$$;

alter table call_events enable row level security;
drop policy if exists "call_events_agency_isolation" on call_events;
create policy "call_events_agency_isolation" on call_events
  for all using (agency_id = current_agency_id());

alter table call_counts_weekly enable row level security;
drop policy if exists "call_counts_weekly_owner_or_admin" on call_counts_weekly;
create policy "call_counts_weekly_owner_or_admin" on call_counts_weekly
  for all using (agency_id = current_agency_id() and (agent_id = current_agent_id() or is_ceo_or_admin()));

select 'call_events + increment_weekly_call_count created' as status;
