-- 024: probability-of-sale-within-6-months, alongside the existing point
-- estimate. Null when there isn't enough closed-sale history to trust a
-- number (see lib/valuation.ts estimateSaleProbability) — never a fabricated
-- percentage from a handful of data points.

alter table meeting_valuations add column if not exists sale_probability numeric;
alter table meeting_valuations add column if not exists sale_probability_sample_size integer;
