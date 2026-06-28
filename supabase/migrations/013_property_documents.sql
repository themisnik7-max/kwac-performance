-- ================================================================
-- 013_property_documents.sql
-- Document management per property (PDFs and other files)
-- ================================================================

CREATE TABLE IF NOT EXISTS public.property_documents (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id     UUID        NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  property_id   UUID        NOT NULL REFERENCES public.meeting_properties(id) ON DELETE CASCADE,
  uploaded_by   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category      TEXT        NOT NULL
                CHECK (category IN (
                  'title_deed',         -- Τίτλος ιδιοκτησίας
                  'floor_plan',         -- Κατόψεις
                  'constitution',       -- Σύσταση
                  'regulations',        -- Κανονισμός πολυκατοικίας
                  'topographic',        -- Τοπογραφικό
                  'assignment',         -- Εντολή ανάθεσης
                  'viewing',            -- Έντυπο υπόδειξης
                  'offer',              -- Έντυπο προσφοράς
                  'deposit',            -- Προκαταβολή
                  'contract',           -- Συμβόλαιο
                  'other'               -- Άλλο
                )),
  storage_path  TEXT        NOT NULL,
  url           TEXT        NOT NULL,
  original_name TEXT,
  size_bytes    INTEGER,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.property_documents ENABLE ROW LEVEL SECURITY;

-- Agent sees own property docs; admin/ceo see all agency docs
CREATE POLICY "agent_own_docs" ON public.property_documents
  FOR ALL USING (uploaded_by = auth.uid());

CREATE POLICY "admin_agency_docs" ON public.property_documents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.agents a
      WHERE a.id = auth.uid()
        AND a.agency_id = property_documents.agency_id
        AND a.role IN ('admin', 'ceo')
    )
  );

CREATE INDEX idx_docs_property  ON public.property_documents (property_id, category, created_at DESC);
CREATE INDEX idx_docs_agency    ON public.property_documents (agency_id, category);

-- ── Storage bucket for property documents ────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'property-docs',
  'property-docs',
  false,   -- private: URLs require signed tokens
  52428800, -- 50 MB per file
  ARRAY[
    'application/pdf',
    'image/jpeg','image/jpg','image/png','image/webp','image/heic',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload
CREATE POLICY "auth_upload_property_docs" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'property-docs'
    AND auth.role() = 'authenticated'
  );

-- Authenticated users can read (access control enforced at API level via property_documents table)
CREATE POLICY "auth_read_property_docs" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'property-docs'
    AND auth.role() = 'authenticated'
  );

-- Authenticated users can delete their own uploads (enforced at API level)
CREATE POLICY "auth_delete_property_docs" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'property-docs'
    AND auth.role() = 'authenticated'
  );
