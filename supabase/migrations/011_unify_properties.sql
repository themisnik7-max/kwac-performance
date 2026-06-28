-- ================================================================
-- 011_unify_properties.sql
-- Unify meeting_properties as the single property table.
-- Add voice/owner columns + property_photos table.
-- ================================================================

-- ── Extend meeting_properties ────────────────────────────────────

ALTER TABLE public.meeting_properties
  ADD COLUMN IF NOT EXISTS owner_name        TEXT,
  ADD COLUMN IF NOT EXISTS owner_phone       TEXT,
  ADD COLUMN IF NOT EXISTS owner_email       TEXT,
  ADD COLUMN IF NOT EXISTS owner_contact_id  UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS transaction_type  TEXT CHECK (transaction_type IN ('sale', 'rent')),
  ADD COLUMN IF NOT EXISTS condition         TEXT,
  ADD COLUMN IF NOT EXISTS year_renovated    SMALLINT,
  ADD COLUMN IF NOT EXISTS rooms             SMALLINT,
  ADD COLUMN IF NOT EXISTS balcony           BOOLEAN,
  ADD COLUMN IF NOT EXISTS parking           BOOLEAN,
  ADD COLUMN IF NOT EXISTS security_door     BOOLEAN,
  ADD COLUMN IF NOT EXISTS seller_motivation TEXT,
  ADD COLUMN IF NOT EXISTS seller_reason     TEXT,
  ADD COLUMN IF NOT EXISTS ai_summary        TEXT,
  ADD COLUMN IF NOT EXISTS raw_transcript    TEXT,
  ADD COLUMN IF NOT EXISTS voice_note_ids    UUID[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS agency_id         UUID REFERENCES public.agencies(id) ON DELETE CASCADE;

-- year_built already exists in meeting_properties (from Excel import)
-- sqm already exists (maps to size_sqm in voice)
-- asking_price already exists

-- ── Property Photos ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.property_photos (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id    UUID        NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  property_id  UUID        NOT NULL REFERENCES public.meeting_properties(id) ON DELETE CASCADE,
  uploaded_by  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path TEXT        NOT NULL,         -- path in supabase storage bucket property-images
  url          TEXT        NOT NULL,         -- public URL
  original_name TEXT,
  size_bytes   INTEGER,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.property_photos ENABLE ROW LEVEL SECURITY;

-- Agents see photos of their own properties; admin/ceo see all agency photos
CREATE POLICY "agent_own_photos" ON public.property_photos
  FOR ALL USING (uploaded_by = auth.uid());

CREATE POLICY "admin_agency_photos" ON public.property_photos
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.agents a
      WHERE a.id = auth.uid()
        AND a.agency_id = property_photos.agency_id
        AND a.role IN ('admin', 'ceo')
    )
  );

CREATE INDEX idx_photos_property ON public.property_photos (property_id, created_at DESC);

-- ── RLS on meeting_properties (if not already set) ───────────────
-- Agents see only own records in personal-admin; meeting page shows all (no RLS filter there)
-- We keep existing behaviour: no row-level filter for meeting_properties (shared meeting table).
-- personal-admin filters client-side by agent_id = current user.

-- ── Append voice note helper ─────────────────────────────────────

CREATE OR REPLACE FUNCTION append_voice_note_to_property(
  p_property_id UUID, p_note_id UUID
) RETURNS void LANGUAGE sql AS $$
  UPDATE public.meeting_properties
  SET voice_note_ids = array_append(voice_note_ids, p_note_id)
  WHERE id = p_property_id
    AND NOT (p_note_id = ANY(voice_note_ids));
$$;
