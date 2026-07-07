-- 017: holdout validation results for the comp-based pricing model.
-- CLAUDE.md requires the pricing model be "validated against a holdout set."
-- Each row is one backtest run: predict sold properties' prices using only
-- comps that existed before their own sale date, compare to actual price.

create table if not exists valuation_backtest_results (
  id                    uuid default gen_random_uuid() primary key,
  agency_id             uuid references agencies(id),
  run_at                timestamptz default now(),
  sample_size           integer not null,
  skipped_insufficient_comps integer not null default 0,
  mean_pct_error        numeric,   -- signed — positive means the model overshoots on average
  mean_abs_pct_error    numeric,
  median_abs_pct_error  numeric,
  pct_within_10         numeric,   -- fraction of predictions within 10% of actual sale price
  pct_within_20         numeric,
  details               jsonb      -- per-property {property_area, predicted, actual, pct_error} for spot-checking
);

create index if not exists valuation_backtest_results_agency_idx
  on valuation_backtest_results (agency_id, run_at desc);

alter table valuation_backtest_results enable row level security;
drop policy if exists "valuation_backtest_results_agency_isolation" on valuation_backtest_results;
create policy "valuation_backtest_results_agency_isolation" on valuation_backtest_results
  for all using (agency_id = current_agency_id());
