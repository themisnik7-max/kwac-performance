create or replace function _diag_users_check()
returns table(relkind text, row_count bigint, rls_enabled boolean)
language plpgsql stable security definer as $$
declare
  k text;
  n bigint;
  r boolean;
begin
  select c.relkind::text, c.relrowsecurity into k, r from pg_class c where c.relname = 'users' and c.relnamespace = 'public'::regnamespace;
  execute 'select count(*) from public.users' into n;
  return query select k, n, r;
end;
$$;
