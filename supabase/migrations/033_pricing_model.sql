-- 033: schema for the small neural-net pricing model (lib/miniNet.ts,
-- lib/pricingFeatures.ts). Adds the columns the model's feature set needs
-- but the live schema didn't have (balcony/utilization_score weren't on
-- properties at all; no table had lat/lng except properties, which is
-- ~unpopulated), plus a table to persist trained weights per agency so
-- inference doesn't retrain on every valuation call.

alter table properties add column if not exists balcony boolean;
alter table properties add column if not exists utilization_score smallint check (utilization_score between 1 and 5);

alter table meeting_properties add column if not exists lat double precision;
alter table meeting_properties add column if not exists lng double precision;
alter table meeting_properties add column if not exists utilization_score smallint check (utilization_score between 1 and 5);

-- One row per training run, most recent is_active=true row per agency is
-- what meeting-valuation loads. Kept append-only (old runs stay, marked
-- inactive) so accuracy trend over time is visible, matching the pattern
-- already used for valuation_backtest_results.
create table if not exists pricing_model_runs (
  id                uuid default gen_random_uuid() primary key,
  agency_id         uuid references agencies(id),
  trained_at        timestamptz default now(),
  seed              integer not null,
  feature_names     text[] not null,
  model_json        jsonb not null,       -- MiniNet.toJSON()
  train_sample_size integer not null,
  holdout_sample_size integer not null,
  feedback_sample_size integer not null default 0, -- agent-estimate rows folded into training
  holdout_mae_pct   numeric,               -- median abs % error on held-out real sales
  holdout_r2        numeric,
  is_active         boolean not null default true
);

create index if not exists pricing_model_runs_agency_active_idx
  on pricing_model_runs (agency_id, is_active, trained_at desc);

alter table pricing_model_runs enable row level security;
drop policy if exists "pricing_model_runs_agency_isolation" on pricing_model_runs;
create policy "pricing_model_runs_agency_isolation" on pricing_model_runs
  for all using (agency_id = current_agency_id());

select 'pricing_model schema ready' as status;
