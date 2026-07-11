-- check_rate_limit (migration 20260711130000) ran its housekeeping DELETE
-- unconditionally on every single call — a full prune of rate_limit_counters
-- competing for I/O on every rate-limited request platform-wide, regardless
-- of which tenant triggered it. Cost scaled with total cross-tenant traffic,
-- not the calling tenant's own traffic: the one piece of infrastructure that
-- exists to stop a noisy neighbor was itself becoming one as tenant count
-- grows (CLAUDE.md's multi-tenant mandate).
--
-- Pruning old windows only needs to happen often enough to keep the table
-- small, not on every call. Same insert/count/return logic, just gates the
-- delete behind a low-probability check instead of running it inline every
-- time.
create or replace function check_rate_limit(p_key text, p_window_seconds integer, p_limit integer)
returns boolean
language plpgsql
as $$
declare
  v_window timestamptz;
  v_count  integer;
begin
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into rate_limit_counters (rl_key, window_start, count)
  values (p_key, v_window, 1)
  on conflict (rl_key, window_start) do update set count = rate_limit_counters.count + 1
  returning count into v_count;

  -- ~1-in-50 calls, not every call. At any realistic rate-limit call volume
  -- this still prunes far more often than the 1-hour retention window needs.
  if random() < 0.02 then
    delete from rate_limit_counters where window_start < now() - interval '1 hour';
  end if;

  return v_count <= p_limit;
end;
$$;

select 'check_rate_limit cleanup moved off the hot path' as status;
