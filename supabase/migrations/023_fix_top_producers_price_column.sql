-- 023: top_producers_by_area referenced properties.price, which doesn't
-- exist on the live schema (price_asking/price_final do) — every call to
-- this function has been erroring, so "top producers" has never actually
-- returned anyone. Fixes the column reference; the separate issue that
-- agent_email is null on every historical closed comp (so the join to
-- agents still won't attribute anyone until that gets captured going
-- forward) is a data-completeness gap, not something this migration can
-- backfill.

-- The live function's return signature differs from what's in migration 006
-- (drift — same pattern seen elsewhere in this project), so CREATE OR REPLACE
-- fails with "cannot change return type." Drop and recreate instead.
drop function if exists top_producers_by_area(text);

create function top_producers_by_area(p_area text)
returns table(agent_id uuid, agent_name text, deals_count bigint, avg_price_per_sqm numeric)
language sql stable as $$
  select a.id as agent_id, coalesce(a.full_name, p.agent_name) as agent_name,
    count(p.id) as deals_count,
    round(avg(case when p.sqm > 0 then coalesce(p.price_final, p.price_asking) / p.sqm else null end)::numeric, 0) as avg_price_per_sqm
  from properties p left join agents a on a.email = p.agent_email
  where p.area = p_area and p.deal_type = 'sale'
    and coalesce(p.price_final, p.price_asking) > 0 and p.sqm > 0
    and p.created_at >= now() - interval '2 years'
  group by a.id, coalesce(a.full_name, p.agent_name)
  order by deals_count desc, avg_price_per_sqm desc limit 3;
$$;

select 'top_producers_by_area: fixed price column reference' as status;
