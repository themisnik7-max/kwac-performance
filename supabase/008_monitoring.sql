-- 008_monitoring.sql

CREATE TABLE IF NOT EXISTS public.page_views (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    uuid        NOT NULL REFERENCES public.agents(id)   ON DELETE CASCADE,
  agency_id   uuid        NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  route       text        NOT NULL,
  viewed_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_page_views_agent_time  ON public.page_views (agent_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_agency_route ON public.page_views (agency_id, route, viewed_at DESC);

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_insert_own_views" ON public.page_views FOR INSERT WITH CHECK (agent_id = current_agent_id());
CREATE POLICY "ceo_read_agency_views"  ON public.page_views FOR SELECT USING (agency_id = current_agency_id() AND is_ceo_or_admin());

ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

CREATE OR REPLACE VIEW public.agent_feature_usage AS
SELECT pv.agency_id, pv.agent_id, pv.route,
  COUNT(*) AS visit_count, MAX(pv.viewed_at) AS last_visit,
  COUNT(*) FILTER (WHERE pv.viewed_at > now() - INTERVAL '7 days')  AS visits_7d,
  COUNT(*) FILTER (WHERE pv.viewed_at > now() - INTERVAL '30 days') AS visits_30d
FROM public.page_views pv
GROUP BY pv.agency_id, pv.agent_id, pv.route;