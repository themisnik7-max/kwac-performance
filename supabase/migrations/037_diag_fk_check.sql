-- Temporary diagnostic — dropped in the next migration once used.
create or replace function _diag_fk_target(p_table text, p_column text)
returns table(constraint_name text, target_table text, target_column text)
language sql stable security definer as $$
  select con.conname::text,
    (select relname from pg_class where oid = con.confrelid)::text,
    (select attname from pg_attribute where attrelid = con.confrelid and attnum = con.confkey[1])::text
  from pg_constraint con
  join pg_attribute att on att.attrelid = con.conrelid and att.attnum = con.conkey[1]
  where con.conrelid = p_table::regclass and con.contype = 'f' and att.attname = p_column;
$$;
