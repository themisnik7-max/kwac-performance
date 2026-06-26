-- ================================================================
-- 009_voice_profiles.sql
-- Voice Notes audit log + Property Scouted + Demand Profiles
-- ================================================================

-- Raw audit log — every voice submission is appended here
CREATE TABLE IF NOT EXISTS public.voice_notes (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id    UUID        NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  agent_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id      UUID        REFERENCES public.leads(id) ON DELETE SET NULL,
  property_id  UUID,
  meeting_id   UUID,
  transcript   TEXT        NOT NULL,
  extracted    JSONB       NOT NULL DEFAULT '{}',
  audio_sec    SMALLINT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.voice_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_own_voice_notes" ON public.voice_notes
  FOR ALL USING (agent_id = auth.uid());

CREATE POLICY "admin_all_voice_notes" ON public.voice_notes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.agents a
      WHERE a.id = auth.uid()
        AND a.agency_id = voice_notes.agency_id
        AND a.role IN ('admin', 'ceo')
    )
  );

CREATE INDEX idx_voice_notes_agent  ON public.voice_notes (agent_id, created_at DESC);
CREATE INDEX idx_voice_notes_agency ON public.voice_notes (agency_id, created_at DESC);


-- ── Property Scouted ─────────────────────────────────────────────
-- Ακίνητα που είδε ο agent αλλά δεν έχει αναλάβει ακόμα

CREATE TABLE IF NOT EXISTS public.property_scouted (
  id                UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id         UUID      NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  agent_id          UUID      NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  owner_name        TEXT,
  owner_phone       TEXT,
  owner_email       TEXT,

  transaction_type  TEXT      CHECK (transaction_type IN ('sale', 'rent')),
  address           TEXT,
  area              TEXT,
  floor             SMALLINT,
  size_sqm          SMALLINT,
  condition         TEXT,

  features          JSONB     NOT NULL DEFAULT '{}',
  -- { renovations:[{item,year}], security_door:bool, parking:bool, balcony:bool }

  asking_price      INTEGER,
  offers_received   JSONB     NOT NULL DEFAULT '[]',
  -- [{amount:170000}]
  seller_motivation TEXT,
  seller_reason     TEXT,

  ai_summary        TEXT,

  voice_note_ids    UUID[]    NOT NULL DEFAULT '{}',
  raw_transcript    TEXT      NOT NULL,

  status            TEXT      NOT NULL DEFAULT 'scouted'
                    CHECK (status IN ('scouted','contacted','listing_requested','listed','lost')),

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dedup: ο ίδιος agent δεν μπορεί να έχει δύο records για τον ίδιο ιδιοκτήτη
CREATE UNIQUE INDEX IF NOT EXISTS uq_scouted_agent_phone
  ON public.property_scouted (agent_id, owner_phone)
  WHERE owner_phone IS NOT NULL;

ALTER TABLE public.property_scouted ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_own_scouted" ON public.property_scouted
  FOR ALL USING (agent_id = auth.uid());

CREATE POLICY "admin_agency_scouted" ON public.property_scouted
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.agents a
      WHERE a.id = auth.uid()
        AND a.agency_id = property_scouted.agency_id
        AND a.role IN ('admin', 'ceo')
    )
  );

CREATE INDEX idx_scouted_agent  ON public.property_scouted (agent_id, updated_at DESC);
CREATE INDEX idx_scouted_agency ON public.property_scouted (agency_id, status);


-- ── Demand Profiles ──────────────────────────────────────────────
-- Ζητήσεις αγοράς ή μίσθωσης

CREATE TABLE IF NOT EXISTS public.demand_profiles (
  id                UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id         UUID      NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  agent_id          UUID      NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id           UUID      REFERENCES public.leads(id) ON DELETE SET NULL,

  client_name       TEXT,
  client_phone      TEXT,
  client_email      TEXT,

  transaction_type  TEXT      CHECK (transaction_type IN ('buy', 'rent')),
  property_type     TEXT,
  floor_min         SMALLINT,
  floor_max         SMALLINT,
  size_min          SMALLINT,
  size_max          SMALLINT,
  budget_eur        INTEGER,
  condition_req     TEXT,

  must_have         TEXT[]    NOT NULL DEFAULT '{}',
  nice_to_have      TEXT[]    NOT NULL DEFAULT '{}',
  areas_preferred   TEXT[]    NOT NULL DEFAULT '{}',

  ai_summary        TEXT,

  voice_note_ids    UUID[]    NOT NULL DEFAULT '{}',
  raw_transcript    TEXT      NOT NULL,

  status            TEXT      NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','matched','closed','inactive')),

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_demand_agent_phone
  ON public.demand_profiles (agent_id, client_phone)
  WHERE client_phone IS NOT NULL;

ALTER TABLE public.demand_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_own_demands" ON public.demand_profiles
  FOR ALL USING (agent_id = auth.uid());

CREATE POLICY "admin_agency_demands" ON public.demand_profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.agents a
      WHERE a.id = auth.uid()
        AND a.agency_id = demand_profiles.agency_id
        AND a.role IN ('admin', 'ceo')
    )
  );

CREATE INDEX idx_demands_agent  ON public.demand_profiles (agent_id, updated_at DESC);
CREATE INDEX idx_demands_agency ON public.demand_profiles (agency_id, status);


-- ── Shared triggers ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_scouted_updated BEFORE UPDATE ON public.property_scouted
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_demands_updated BEFORE UPDATE ON public.demand_profiles
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();


-- ── Array-append helpers (idempotent) ───────────────────────────

CREATE OR REPLACE FUNCTION append_voice_note_to_scouted(
  p_agent_id UUID, p_phone TEXT, p_note_id UUID
) RETURNS void LANGUAGE sql AS $$
  UPDATE public.property_scouted
  SET voice_note_ids = array_append(voice_note_ids, p_note_id)
  WHERE agent_id = p_agent_id
    AND owner_phone = p_phone
    AND NOT (p_note_id = ANY(voice_note_ids));
$$;

CREATE OR REPLACE FUNCTION append_voice_note_to_demand(
  p_agent_id UUID, p_phone TEXT, p_note_id UUID
) RETURNS void LANGUAGE sql AS $$
  UPDATE public.demand_profiles
  SET voice_note_ids = array_append(voice_note_ids, p_note_id)
  WHERE agent_id = p_agent_id
    AND client_phone = p_phone
    AND NOT (p_note_id = ANY(voice_note_ids));
$$;
