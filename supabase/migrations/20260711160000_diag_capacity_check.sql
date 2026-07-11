-- Temporary diagnostic RPC to check real connection/capacity limits before
-- answering a 200-concurrent-agent capacity question with real numbers
-- instead of guesses. Same throwaway-function pattern ARCHITECTURE.md
-- documents using before (_diag_fk_full, etc.) — dropped in the next
-- migration once read.
create or replace function _diag_capacity_check()
returns table(setting_name text, setting_value text)
language sql security definer as $$
  select 'max_connections', setting from pg_settings where name = 'max_connections'
  union all
  select 'current_connections', count(*)::text from pg_stat_activity
  union all
  select 'connections_by_application', string_agg(coalesce(application_name,'(none)') || '=' || cnt::text, ', ')
    from (select application_name, count(*) cnt from pg_stat_activity group by application_name) t
  union all
  select 'shared_buffers', setting from pg_settings where name = 'shared_buffers'
  union all
  select 'work_mem', setting from pg_settings where name = 'work_mem'
  union all
  select 'server_version', setting from pg_settings where name = 'server_version';
$$;
