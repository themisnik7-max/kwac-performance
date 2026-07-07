-- 027: meeting_valuations was missing blended_recommended, blended_confidence,
-- feedback_count, and last_feedback_sync entirely on the live database —
-- migration 006 added these via ALTER TABLE, but they never actually landed
-- (same drift pattern as several other tables this project has hit: the
-- migration file existed in the repo but the live schema disagreed).
--
-- Consequence: the meeting-valuation route's upsert has been including these
-- columns since they were added to the code, and every one of those upserts
-- has been failing outright — meaning valuations have not actually been
-- saving. The route previously didn't check this upsert's error, so it kept
-- reporting "success" while writing nothing (fixed alongside this migration).

alter table meeting_valuations add column if not exists blended_recommended numeric;
alter table meeting_valuations add column if not exists blended_confidence numeric;
alter table meeting_valuations add column if not exists feedback_count integer default 0;
alter table meeting_valuations add column if not exists last_feedback_sync timestamptz;

select 'meeting_valuations: added missing blended_*/feedback_* columns' as status;
