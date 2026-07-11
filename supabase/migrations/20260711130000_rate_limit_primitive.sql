-- No rate limiting existed anywhere in this codebase before this migration
-- (confirmed by a full-repo grep during the 2026-07-11 production-readiness
-- audit) beyond the GPI reveal endpoint's own bespoke hourly counter
-- (migration 20260711120300) and the AI Admin chat's DAILY action cap. A
-- per-minute cap was missing entirely, meaning any authenticated-but-
-- compromised or scripted session could exhaust a day's worth of AI Admin
-- calls, or hammer OpenAI Whisper transcription, in seconds.
--
-- Generic fixed-window counter, reusable by any route: check_rate_limit(key,
-- window_seconds, limit) atomically increments the counter for the current
-- window and returns whether the caller is still within it. Old windows are
-- opportunistically pruned on every call (1hr retention) so this table
-- can't grow unbounded the way several audit findings flagged elsewhere —
-- this is ephemeral bookkeeping, not an AI-decision log, so pruning it is
-- correct (unlike ai_admin_actions_log/valuation_calibration_log/etc,
-- which must never be deleted per CLAUDE.md).

create table if not exists rate_limit_counters (
  rl_key       text not null,
  window_start timestamptz not null,
  count        integer not null default 0,
  primary key (rl_key, window_start)
);

create index if not exists idx_rate_limit_counters_window on rate_limit_counters (window_start);

alter table rate_limit_counters enable row level security;
-- No policies: only ever touched via the service-role client (bypasses
-- RLS) or the RPC below, matching every other server-internal table in
-- this schema. Deny-by-default is correct here, not an oversight.

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

  delete from rate_limit_counters where window_start < now() - interval '1 hour';

  return v_count <= p_limit;
end;
$$;

select 'check_rate_limit + rate_limit_counters installed' as status;
