-- 041: enable pgvector — forward-looking infrastructure only, no consumer
-- yet. Product direction (2026-07): ai_admin_actions_log, meeting_comments,
-- valuation_calibration_log etc. are being kept as the durable "company
-- soul" — training data for a future fine-tuned open-source model and/or a
-- pgvector-backed retrieval layer so Claude can recall what actually worked
-- historically. See ARCHITECTURE.md's "AI data as company soul" section.
--
-- Deliberately NOT creating an embeddings table yet: current real (non-demo)
-- row counts across every candidate source table are in the single-to-low-
-- double digits — building an embedding-generation pipeline and similarity
-- search against that little data would be dead code with nothing to
-- retrieve. Extension-only for now; the table comes when there's enough
-- volume for retrieval to actually return something useful.
create extension if not exists vector;

select 'pgvector enabled' as status;
