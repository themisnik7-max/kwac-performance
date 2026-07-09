-- 042: office-wide analog of gps_goals — one row per agency instead of per
-- agent. "GPS Γραφείου" tab in Intelligence OP reverse-engineers a target
-- office GCI into required weekly office-wide activity, the same way
-- individual GPS does for one agent, using the office's real aggregate
-- conversion rates (lib/officeMetrics.ts getOfficeConversionRates) instead
-- of one person's.
create table if not exists office_gps_goals (
  agency_id         uuid primary key references agencies(id),
  target_income     numeric,   -- target office GCI (gross commission income) per year
  avg_property_price numeric,
  commission_rate   numeric,   -- office commission %, no agent-split step at this level
  work_weeks        integer default 48,
  cr_call_appt1     numeric,
  cr_appt1_appt2    numeric,
  cr_appt2_listing  numeric,
  cr_listing_deal   numeric,
  updated_at        timestamptz default now()
);

alter table office_gps_goals enable row level security;
drop policy if exists "office_gps_goals_agency_isolation" on office_gps_goals;
create policy "office_gps_goals_agency_isolation" on office_gps_goals
  for all using (agency_id = current_agency_id());

select 'office_gps_goals ready' as status;
