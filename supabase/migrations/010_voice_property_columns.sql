-- 010_voice_property_columns.sql
-- Promote frequently-queried JSONB fields to proper columns on property_scouted

ALTER TABLE public.property_scouted
  ADD COLUMN IF NOT EXISTS year_built     SMALLINT,
  ADD COLUMN IF NOT EXISTS year_renovated SMALLINT,
  ADD COLUMN IF NOT EXISTS rooms          SMALLINT,
  ADD COLUMN IF NOT EXISTS balcony        BOOLEAN,
  ADD COLUMN IF NOT EXISTS parking        BOOLEAN,
  ADD COLUMN IF NOT EXISTS security_door  BOOLEAN;
