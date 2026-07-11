-- Throwaway diagnostic, same pattern as 029/030, 037/038, 20260711160000/100.
-- Lists live RLS policies for two tables before changing Personal Admin's
-- visibility rules — this project's own drift log says migration files
-- can't be trusted for what's actually enforced, only a live check can.
create or replace function _diag_list_policies(p_table text)
returns table(policyname text, cmd text, qual text, with_check text)
language sql security definer as $$
  select polname::text, case polcmd when 'r' then 'SELECT' when 'a' then 'INSERT' when 'w' then 'UPDATE' when 'd' then 'DELETE' else '*' end,
         pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid)
  from pg_policy where polrelid = p_table::regclass;
$$;
