-- 036: found via _diag_list_policies (035) — announcements had exactly the
-- same rogue-policy pattern discovered agency-wide earlier this session
-- (migrations 030-031): a single policy "ann_all" with `using (true)` for
-- ALL commands — unrestricted cross-tenant read/write, no agency check at
-- all. This predates announcements even having an agency_id column, so it's
-- been wide open since the table was created. Replacing with the same
-- agency-scoped pattern used everywhere else (open_houses, pricing_model_runs).

drop policy if exists "ann_all" on announcements;
alter table announcements enable row level security;
create policy "announcements_agency_isolation" on announcements
  for all using (agency_id = current_agency_id());

drop function if exists _diag_list_policies(text);

select 'announcements is now actually agency-scoped' as status;
