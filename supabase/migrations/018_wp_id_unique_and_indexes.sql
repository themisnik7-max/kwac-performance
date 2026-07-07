-- 018: (a) unique constraint pipeline-sync's batched upsert(onConflict:'wp_id')
-- needs to actually work — the route used to do a manual exists-check per row
-- instead of a native upsert, so this constraint was never required before.
-- (b) composite indexes on the three highest-traffic tables for query shapes
-- already in the app code (see comments per index below).

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'pipeline_properties_wp_id_key'
  ) then
    alter table pipeline_properties add constraint pipeline_properties_wp_id_key unique (wp_id);
  end if;
end $$;

-- properties: comp lookup in meeting-valuation (agency_id + area + deal_type,
-- ordered by created_at) and dashboard/intelligence-agent (agent_id + status).
create index if not exists properties_agency_area_dealtype_created_idx
  on properties (agency_id, area, deal_type, created_at desc);
create index if not exists properties_agent_status_idx
  on properties (agent_id, status);
create index if not exists properties_agent_listed_idx
  on properties (agent_id, listed_at desc);

-- pipeline_properties: RLS-scoped list ordered by listed_at (app/pipeline/page.tsx).
create index if not exists pipeline_properties_agency_listed_idx
  on pipeline_properties (agency_id, listed_at desc);

-- contacts: phone lookup during voice-ingest owner matching (app/api/voice-ingest/route.ts).
create index if not exists contacts_agency_phone_idx on contacts (agency_id, phone);
create index if not exists contacts_agency_phone2_idx on contacts (agency_id, phone2);
