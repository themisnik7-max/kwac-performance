-- 029: temporary diagnostic RPC to see exactly what RLS policies actually
-- exist on meeting_properties on the live database — migration 021's DROP
-- POLICY may have targeted a name that doesn't match what's actually there
-- (same drift pattern hit repeatedly this session), which would explain why
-- a non-owner update just succeeded when it should have been blocked.

create or replace function _diag_list_policies(p_table text)
returns table(policyname text, cmd text, qual text, with_check text)
language sql stable security definer as $$
  select polname::text, case polcmd when 'r' then 'SELECT' when 'a' then 'INSERT' when 'w' then 'UPDATE' when 'd' then 'DELETE' else '*' end,
    pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid)
  from pg_policy
  where polrelid = p_table::regclass;
$$;
