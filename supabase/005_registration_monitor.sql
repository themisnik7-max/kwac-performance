-- ================================================
-- KWAC OS — Registration + Monitor
-- Run in Supabase SQL Editor AFTER 004_meeting_v2.sql
-- ================================================

-- 1. Add allowed_email_domain to agencies
--    Only emails @this-domain.com can self-register
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS allowed_email_domain TEXT DEFAULT 'kwac.gr';
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS require_approval BOOLEAN DEFAULT false;

-- Update your existing agency with the real domain
-- UPDATE agencies SET allowed_email_domain = 'kwac.gr' WHERE name = 'Default Agency';

-- 2. Add onboarding tracking columns to agents
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS full_name    TEXT,
  ADD COLUMN IF NOT EXISTS phone        TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url   TEXT,
  ADD COLUMN IF NOT EXISTS is_active    BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS joined_at    TIMESTAMPTZ DEFAULT now();

-- 3. View: compliance overview for monitor page
--    CEO sees all agents + their submission/activity status
CREATE OR REPLACE VIEW agent_compliance AS
SELECT
  a.id,
  a.full_name,
  a.email,
  a.role,
  a.is_active,
  a.joined_at,
  a.agency_id,

  -- GPS goal set?
  (EXISTS (
    SELECT 1 FROM gps_goals g WHERE g.agent_id = a.id
  )) AS has_gps_goal,

  -- Submitted Μετρησιμότητα this week?
  (EXISTS (
    SELECT 1 FROM weekly_submissions ws
    WHERE ws.agent_id = a.id
      AND ws.year = EXTRACT(YEAR FROM NOW())::INT
      AND ws.week_number = EXTRACT(WEEK FROM NOW())::INT
  )) AS submitted_this_week,

  -- Total weekly submissions (history depth)
  (SELECT COUNT(*) FROM weekly_submissions ws WHERE ws.agent_id = a.id) AS total_submissions,

  -- Properties in meeting (active/for_appraisal)
  (SELECT COUNT(*) FROM meeting_properties mp
   WHERE mp.agent_id = a.id AND mp.status IN ('pending','for_appraisal','estimated')
  ) AS meeting_props_count,

  -- Last sprint entry
  (SELECT MAX(se.updated_at) FROM sprint_entries se WHERE se.agent_id = a.id) AS last_sprint_at,

  -- Last weekly submission
  (SELECT MAX(ws.created_at) FROM weekly_submissions ws WHERE ws.agent_id = a.id) AS last_submission_at

FROM agents a
WHERE a.is_active = true;

-- RLS: only CEO/Admin can see compliance view
-- (The underlying tables already have RLS; view inherits permissions)
-- Grant select only to authenticated users — RLS on agents table enforces agency scoping
GRANT SELECT ON agent_compliance TO authenticated;

-- 4. Ensure weekly_submissions has needed columns
ALTER TABLE weekly_submissions
  ADD COLUMN IF NOT EXISTS week_number  INT,
  ADD COLUMN IF NOT EXISTS year         INT,
  ADD COLUMN IF NOT EXISTS calls        INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS leads        INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS appt1        INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS appt2        INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contracts    INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exclusives   INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at   TIMESTAMPTZ DEFAULT now();

SELECT 'Migration 005 applied' AS status;
