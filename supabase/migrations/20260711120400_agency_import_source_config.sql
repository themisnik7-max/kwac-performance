-- Per-agency import source config, replacing ingest-cron/pipeline-sync's
-- "pick the first agency ever created" fallback — a single-tenant shortcut
-- CLAUDE.md explicitly calls out as a bug class, not just these two routes.
--
-- ilist_export_url: each agency's own iList TSV export URL, used by
-- ingest-cron instead of the single global ILIST_EXPORT_URL env var.
--
-- wp_source_url: each agency's own WordPress site base URL, used by
-- pipeline-sync instead of the hardcoded zadeshome.com literal. Credentials
-- stay as global env vars for now (ZADESHOME_WP_USER/APP_PASSWORD) — there
-- is exactly one real WordPress-integrated agency today, so per-agency
-- encrypted credentials (mirroring lib/crypto.ts's GPI pattern) are a
-- when-a-second-one-actually-exists problem, not a build-it-now one.
--
-- Both nullable, both default null: an agency with neither column set
-- falls back to today's exact legacy behavior (single global source,
-- applied to whichever agency doesn't have its own config yet) so this
-- migration doesn't silently break the live nightly cron. Once any agency
-- sets its own value, that becomes authoritative for that agency and the
-- legacy fallback stops applying to it.

alter table agencies add column if not exists ilist_export_url text;
alter table agencies add column if not exists wp_source_url text;

select 'agencies.ilist_export_url + wp_source_url added' as status;
