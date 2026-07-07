-- 016: append-only log of every AI valuation blend — CLAUDE.md requires
-- calibration-from-feedback to be "logged, not silently overwritten." Until
-- now nothing recorded what weights produced a given price or how it moved
-- when meeting_valuations was upserted. This is history only; it does not
-- change how weights are chosen.

create table if not exists valuation_calibration_log (
  id                     uuid default gen_random_uuid() primary key,
  agency_id              uuid references agencies(id),
  property_id            uuid references meeting_properties(id),
  comp_recommended       numeric,       -- comp-based estimate before blending (null = no comps)
  comp_confidence        numeric,
  comp_count             integer,
  agent_consensus        numeric,       -- weighted agent-feedback estimate (null if <2 feedback rows)
  feedback_count         integer,
  blend_comp_weight      numeric,       -- e.g. 0.60 (null when agent-consensus-only)
  blend_feedback_weight  numeric,       -- e.g. 0.40 (null when agent-consensus-only)
  producer_weight_map    jsonb,         -- snapshot of {agent_id: weight} used this run
  blended_recommended    numeric,
  blended_confidence     numeric,
  created_at             timestamptz default now()
);

create index if not exists valuation_calibration_log_property_idx
  on valuation_calibration_log (property_id, created_at desc);

alter table valuation_calibration_log enable row level security;
drop policy if exists "valuation_calibration_log_agency_isolation" on valuation_calibration_log;
create policy "valuation_calibration_log_agency_isolation" on valuation_calibration_log
  for all using (agency_id = current_agency_id());
