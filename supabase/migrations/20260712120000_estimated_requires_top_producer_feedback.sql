-- write_valuation_result unconditionally set meeting_properties.status =
-- 'estimated' on every valuation write — including the very first automatic
-- one, fired synchronously the instant a property enters for_appraisal (see
-- app/api/meeting-properties/set-status). In practice this meant a property
-- jumped pending -> for_appraisal -> estimated within a single request,
-- with no real "awaiting review" window: the undo button in both
-- app/meeting/page.tsx and Personal Admin only shows for
-- pending/for_appraisal, so it became unreachable almost immediately, and
-- the property barely spent any visible time in Meeting Ακινήτων's queue
-- before looking "done."
--
-- By explicit product decision: a property should only be considered
-- estimated once a top producer (top_producers_by_area, same set that
-- already weights the price blend in lib/pricingEngine.ts) has also
-- reviewed it and left feedback — the AI number alone isn't enough. That
-- transition now happens in app/api/meeting-comments/route.ts instead.

create or replace function write_valuation_result(
  p_property_id uuid,
  p_valuation   jsonb,
  p_calibration jsonb
) returns void
language plpgsql
as $$
begin
  perform pg_advisory_xact_lock(hashtext(p_property_id::text));

  insert into meeting_valuations (
    property_id, agency_id, ai_min, ai_max, ai_recommended, ai_price_per_sqm,
    ai_reasoning, comparables, top_producers, confidence_score,
    blended_recommended, blended_confidence, feedback_count, last_feedback_sync,
    sale_probability, sale_probability_sample_size, updated_at
  )
  select
    p_property_id,
    (p_valuation->>'agency_id')::uuid,
    (p_valuation->>'ai_min')::numeric,
    (p_valuation->>'ai_max')::numeric,
    (p_valuation->>'ai_recommended')::numeric,
    (p_valuation->>'ai_price_per_sqm')::numeric,
    p_valuation->>'ai_reasoning',
    p_valuation->'comparables',
    p_valuation->'top_producers',
    (p_valuation->>'confidence_score')::numeric,
    (p_valuation->>'blended_recommended')::numeric,
    (p_valuation->>'blended_confidence')::numeric,
    (p_valuation->>'feedback_count')::integer,
    now(),
    (p_valuation->>'sale_probability')::numeric,
    (p_valuation->>'sale_probability_sample_size')::integer,
    now()
  on conflict (property_id) do update set
    agency_id = excluded.agency_id, ai_min = excluded.ai_min, ai_max = excluded.ai_max,
    ai_recommended = excluded.ai_recommended, ai_price_per_sqm = excluded.ai_price_per_sqm,
    ai_reasoning = excluded.ai_reasoning, comparables = excluded.comparables,
    top_producers = excluded.top_producers, confidence_score = excluded.confidence_score,
    blended_recommended = excluded.blended_recommended, blended_confidence = excluded.blended_confidence,
    feedback_count = excluded.feedback_count, last_feedback_sync = excluded.last_feedback_sync,
    sale_probability = excluded.sale_probability, sale_probability_sample_size = excluded.sale_probability_sample_size,
    updated_at = excluded.updated_at;

  insert into valuation_calibration_log (
    agency_id, property_id, comp_recommended, comp_confidence, comp_count,
    agent_consensus, feedback_count, blend_comp_weight, blend_feedback_weight,
    blend_nn_weight, nn_recommended, pricing_model_run_id, producer_weight_map,
    blended_recommended, blended_confidence
  )
  select
    (p_calibration->>'agency_id')::uuid,
    p_property_id,
    (p_calibration->>'comp_recommended')::numeric,
    (p_calibration->>'comp_confidence')::numeric,
    (p_calibration->>'comp_count')::integer,
    (p_calibration->>'agent_consensus')::numeric,
    (p_calibration->>'feedback_count')::integer,
    (p_calibration->>'blend_comp_weight')::numeric,
    (p_calibration->>'blend_feedback_weight')::numeric,
    (p_calibration->>'blend_nn_weight')::numeric,
    (p_calibration->>'nn_recommended')::numeric,
    nullif(p_calibration->>'pricing_model_run_id', '')::uuid,
    p_calibration->'producer_weight_map',
    (p_calibration->>'blended_recommended')::numeric,
    (p_calibration->>'blended_confidence')::numeric;

  if coalesce((p_calibration->>'feedback_count')::integer, 0) > 0 then
    update meeting_comments set feedback_processed = true
      where property_id = p_property_id and agent_estimate is not null;
  end if;

  -- status intentionally NOT touched here anymore — see header.
end;
$$;

select 'write_valuation_result no longer auto-sets estimated' as status;
