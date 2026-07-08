create or replace function _diag_fk_full(p_table text)
returns table(constraint_name text, columns text[], target_table text, target_columns text[])
language sql stable security definer as $$
  select con.conname::text,
    (select array_agg(attname::text order by ord) from unnest(con.conkey) with ordinality as u(attnum, ord) join pg_attribute a on a.attrelid = con.conrelid and a.attnum = u.attnum),
    (select relname from pg_class where oid = con.confrelid)::text,
    (select array_agg(attname::text order by ord) from unnest(con.confkey) with ordinality as u(attnum, ord) join pg_attribute a on a.attrelid = con.confrelid and a.attnum = u.attnum)
  from pg_constraint con
  where con.conrelid = p_table::regclass and con.contype = 'f';
$$;
