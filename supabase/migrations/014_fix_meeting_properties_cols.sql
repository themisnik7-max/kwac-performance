-- 014: add missing columns to meeting_properties that voice-ingest expects
ALTER TABLE public.meeting_properties
  ADD COLUMN IF NOT EXISTS updated_at          TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS first_registered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS owner_email         TEXT;

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION touch_mp_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_mp_updated ON public.meeting_properties;
CREATE TRIGGER trg_mp_updated BEFORE UPDATE ON public.meeting_properties
  FOR EACH ROW EXECUTE FUNCTION touch_mp_updated_at();
