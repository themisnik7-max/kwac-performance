-- 020: AI Admin action-execution — usage cap, audit log, contacts.full_name.
-- Every chat turn is logged (proposed/executed/blocked/error) so admins have
-- full visibility into what the assistant did on an agent's behalf, and a
-- daily per-agent counter caps how many Claude calls it can burn through.

alter table contacts add column if not exists full_name text;

create table if not exists ai_admin_usage_daily (
  agent_id     uuid not null references agents(id),
  agency_id    uuid not null references agencies(id),
  usage_date   date not null default current_date,
  action_count integer not null default 0,
  primary key (agent_id, usage_date)
);

create or replace function increment_ai_admin_usage(p_agent_id uuid, p_agency_id uuid)
returns integer
language plpgsql
as $$
declare
  new_count integer;
begin
  insert into ai_admin_usage_daily (agent_id, agency_id, usage_date, action_count)
  values (p_agent_id, p_agency_id, current_date, 1)
  on conflict (agent_id, usage_date)
  do update set action_count = ai_admin_usage_daily.action_count + 1
  returning action_count into new_count;
  return new_count;
end;
$$;

create table if not exists ai_admin_actions_log (
  id             uuid default gen_random_uuid() primary key,
  agency_id      uuid references agencies(id),
  agent_id       uuid references agents(id),
  input_text     text,
  tool_name      text,      -- null = plain Q&A, no action proposed
  tool_args      jsonb,
  status         text not null check (status in ('answered','proposed','executed','confirmed_executed','blocked_cap','error')),
  result_summary text,
  created_at     timestamptz default now()
);

create index if not exists ai_admin_actions_log_agency_idx on ai_admin_actions_log (agency_id, created_at desc);
create index if not exists ai_admin_usage_daily_agency_idx on ai_admin_usage_daily (agency_id, usage_date);

alter table ai_admin_usage_daily enable row level security;
drop policy if exists "ai_admin_usage_daily_agency_isolation" on ai_admin_usage_daily;
create policy "ai_admin_usage_daily_agency_isolation" on ai_admin_usage_daily
  for all using (agency_id = current_agency_id());

alter table ai_admin_actions_log enable row level security;
drop policy if exists "ai_admin_actions_log_agency_isolation" on ai_admin_actions_log;
create policy "ai_admin_actions_log_agency_isolation" on ai_admin_actions_log
  for all using (agency_id = current_agency_id());
