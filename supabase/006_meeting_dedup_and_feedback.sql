-- KWAC OS — Migration 006: Meeting dedup + feedback loop hardening
-- Run in Supabase SQL Editor. Fully idempotent.

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'meeting_properties_ilist_id_agency_id_key') then
    alter table meeting_properties add constraint meeting_properties_ilist_id_agency_id_key unique (ilist_id, agency_id);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'meeting_comments_agent_property_key') then
    alter table meeting_comments add constraint meeting_comments_agent_property_key unique (agent_id, property_id);
  end if;
end $$;

create index if not exists idx_meeting_comments_unprocessed on meeting_comments (property_id) where feedback_processed = false;

alter table meeting_properties add column if not exists first_registered_by uuid references agents(id);
alter table meeting_properties add column if not exists co_import_count integer default 0;

update meeting_properties set first_registered_by = agent_id where first_registered_by is null and agent_id is not null;

alter table meeting_valuations add column if not exists blended_recommended numeric;
alter table meeting_valuations add column if not exists blended_confidence numeric;
alter table meeting_valuations add column if not exists feedback_count integer default 0;
alter table meeting_valuations add column if not exists last_feedback_sync timestamptz;

create or replace function top_producers_by_area(p_area text)
returns table(agent_id uuid, agent_name text, deals_count bigint, avg_price_per_sqm numeric)
language sql stable as $$
  select a.id as agent_id, coalesce(a.full_name, p.agent_name) as agent_name,
    count(p.id) as deals_count,
    round(avg(case when p.sqm > 0 then p.price / p.sqm else null end)::numeric, 0) as avg_price_per_sqm
  from properties p left join agents a on a.email = p.agent_email
  where p.area = p_area and p.deal_type = 'sale' and p.price > 0 and p.sqm > 0
    and p.created_at >= now() - interval '2 years'
  group by a.id, coalesce(a.full_name, p.agent_name)
  order by deals_count desc, avg_price_per_sqm desc limit 3;
$$;

select '006_meeting_dedup_and_feedback applied' as status;