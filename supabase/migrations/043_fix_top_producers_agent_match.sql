-- 043: top_producers_by_area has never returned anyone. It joined on
-- properties.agent_email, but the ilist importer (app/import/page.jsx) only
-- ever populates properties.agent_name (column 23 of the GridExport — see
-- skills/data-importer/references/column-mapping.md) — agent_email is added
-- by an `alter table` in schema_update.sql but has no write path anywhere.
-- Every historical closed comp has agent_email = null, so the old
-- `a.email = p.agent_email` join matched zero rows, which meant:
--   - Meeting Ακινήτων never had real "top 3 producers" to invite for feedback
--   - top_producers_by_area's agent_id output was always empty, so
--     lib/pricingEngine.ts's producerWeightMap was always empty too, so no
--     meeting_comments feedback could ever count toward the blended price
--   - app/api/pricing-model/train's feedback_folded_in was 0 on every run
--
-- Fix: match on agent_name instead (the field that's actually populated),
-- normalized (trim + lowercase) since it's free text from an external export.
--
-- Known limitation, left as a product decision rather than guessed at here:
-- this is still a text match, not a stable FK. Greek name variants (accents,
-- "Επώνυμο Όνομα" vs "Όνομα Επώνυμο" ordering, nicknames) can still miss a
-- match. The durable fix is capturing a real agent_id on properties at
-- import time (resolved against agents by name, with a defined fallback for
-- ambiguous/no match) — that needs a decision on what happens on an
-- ambiguous match, so it's a follow-up, not part of this migration.
drop function if exists top_producers_by_area(text);

create function top_producers_by_area(p_area text)
returns table(agent_id uuid, agent_name text, deals_count bigint, avg_price_per_sqm numeric)
language sql stable as $$
  select a.id as agent_id, coalesce(a.full_name, p.agent_name) as agent_name,
    count(p.id) as deals_count,
    round(avg(case when p.sqm > 0 then coalesce(p.price_final, p.price_asking) / p.sqm else null end)::numeric, 0) as avg_price_per_sqm
  from properties p
    left join agents a
      on lower(btrim(a.full_name)) = lower(btrim(p.agent_name))
      and a.agency_id = p.agency_id
  where p.area = p_area and p.deal_type = 'sale'
    and coalesce(p.price_final, p.price_asking) > 0 and p.sqm > 0
    and p.created_at >= now() - interval '2 years'
  group by a.id, coalesce(a.full_name, p.agent_name)
  order by deals_count desc, avg_price_per_sqm desc limit 3;
$$;

select 'top_producers_by_area: now matches on agent_name (agent_email had no write path)' as status;
