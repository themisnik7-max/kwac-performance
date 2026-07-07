-- 034: track the NN model's blend weight alongside the existing comp/
-- feedback weights already logged in valuation_calibration_log, so the
-- audit trail for a valuation shows all three signal weights, not two.
alter table valuation_calibration_log add column if not exists blend_nn_weight numeric;
alter table valuation_calibration_log add column if not exists nn_recommended numeric;
alter table valuation_calibration_log add column if not exists pricing_model_run_id uuid references pricing_model_runs(id);

select 'valuation_calibration_log nn columns ready' as status;
