-- Confirmed via live schema dump (npx supabase db dump --linked, 2026-07-11)
-- that 11 tables have zero secondary indexes beyond what a PK/unique
-- constraint incidentally provides — every RLS check and hot-path query on
-- these tables is a sequential scan today. Harmless at current row counts,
-- but cheap to fix now rather than when it starts hurting.
--
-- Notable discovery while verifying this: meeting_comments has genuinely
-- ZERO indexes live, including ones the untracked loose file
-- supabase/006_meeting_dedup_and_feedback.sql claims to add (a unique
-- constraint on (agent_id, property_id), a partial index on unprocessed
-- feedback). That file's claims don't match live reality — treat every
-- pre-010 loose file's claims as unverified until checked against the live
-- schema, same as everything else, not as "already applied, just needs
-- tracking."
--
-- agency_id-leading indexes below target the one thing every RLS policy in
-- this schema filters on first (current_agency_id()); meeting_comments and
-- pipeline_events additionally get a property_id index since that's their
-- actual hottest lookup path (fetching a property's comments/timeline).

create index if not exists idx_meeting_properties_agency_status on meeting_properties (agency_id, status);
create index if not exists idx_meeting_properties_agency_agent  on meeting_properties (agency_id, agent_id);
create index if not exists idx_meeting_valuations_agency        on meeting_valuations (agency_id);
create index if not exists idx_meeting_comments_property         on meeting_comments (property_id);
create index if not exists idx_meeting_comments_agent            on meeting_comments (agent_id);
create index if not exists idx_weekly_submissions_agency         on weekly_submissions (agency_id);
create index if not exists idx_sprint_entries_agency             on sprint_entries (agency_id);
create index if not exists idx_sprint_sessions_agency            on sprint_sessions (agency_id);
create index if not exists idx_gps_goals_agency                  on gps_goals (agency_id);
create index if not exists idx_open_houses_agency                on open_houses (agency_id);
create index if not exists idx_room_bookings_agency              on room_bookings (agency_id);
create index if not exists idx_pipeline_events_agency            on pipeline_events (agency_id);
create index if not exists idx_pipeline_events_property          on pipeline_events (property_id);

select 'Missing indexes added to 11 tables' as status;
