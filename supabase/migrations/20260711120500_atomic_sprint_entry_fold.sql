-- app/api/sprint/entry's fold into weekly_submissions was a JS
-- read-modify-write: read sprint_entries/weekly_submissions, compute a
-- delta in Node, upsert the whole row. Two near-simultaneous requests
-- (double-tap on a slow connection, two devices on one account, or two
-- different fields updated close together) read the same pre-write
-- snapshot and the second upsert silently clobbers the first's just-
-- written value — an agent's real activity/XP quietly under-counted with
-- no error. The codebase already has the correct atomic pattern
-- (increment_weekly_call_count, migration 007) — this just applies it here
-- too instead of reusing a JS-side read-then-write.
--
-- Row-locks the sprint_entries row (SELECT ... FOR UPDATE) so the delta
-- computation and both writes happen against a single consistent,
-- serialized snapshot per (sprint_id, agent_id) — concurrent calls queue
-- on the lock instead of racing.

create or replace function upsert_sprint_entry_and_fold(
  p_sprint_id   uuid,
  p_agent_id    uuid,
  p_agency_id   uuid,
  p_field       text,
  p_value       integer,
  p_week_column text,
  p_xp_weight   integer,
  p_week_number integer,
  p_year        integer
) returns integer
language plpgsql
as $$
declare
  v_old_value integer;
  v_delta     integer;
begin
  if p_field not in ('calls', 'leads', 'appointments') then
    raise exception 'invalid sprint field %', p_field;
  end if;
  if p_week_column not in ('cold_calls', 'leads_cold', 'meet1_seller_phone') then
    raise exception 'invalid weekly_submissions column %', p_week_column;
  end if;

  insert into sprint_entries (sprint_id, agent_id, agency_id, calls, leads, appointments, updated_at)
  values (p_sprint_id, p_agent_id, p_agency_id, 0, 0, 0, now())
  on conflict (sprint_id, agent_id) do nothing;

  execute format('select %I from sprint_entries where sprint_id = $1 and agent_id = $2 for update', p_field)
    into v_old_value using p_sprint_id, p_agent_id;

  v_delta := p_value - coalesce(v_old_value, 0);

  execute format('update sprint_entries set %I = $1, updated_at = now() where sprint_id = $2 and agent_id = $3', p_field)
    using p_value, p_sprint_id, p_agent_id;

  if v_delta <> 0 then
    execute format(
      'insert into weekly_submissions (agent_id, agency_id, week_number, year, %I, xp_earned, is_editable, updated_at)
       values ($1, $2, $3, $4, $5, $6, true, now())
       on conflict (agent_id, week_number, year)
       do update set %I = coalesce(weekly_submissions.%I, 0) + $5,
                      xp_earned = coalesce(weekly_submissions.xp_earned, 0) + $6,
                      updated_at = now()',
      p_week_column, p_week_column, p_week_column
    ) using p_agent_id, p_agency_id, p_week_number, p_year, v_delta, v_delta * p_xp_weight;
  end if;

  return v_delta;
end;
$$;

select 'upsert_sprint_entry_and_fold installed' as status;
