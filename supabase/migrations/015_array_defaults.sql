-- 015: set DEFAULT '{}' on all not-null array columns in demand_profiles
ALTER TABLE public.demand_profiles
  ALTER COLUMN must_have       SET DEFAULT '{}',
  ALTER COLUMN nice_to_have    SET DEFAULT '{}',
  ALTER COLUMN areas_preferred SET DEFAULT '{}';

-- Backfill any existing nulls (shouldn't exist but just in case)
UPDATE public.demand_profiles SET must_have       = '{}' WHERE must_have       IS NULL;
UPDATE public.demand_profiles SET nice_to_have    = '{}' WHERE nice_to_have    IS NULL;
UPDATE public.demand_profiles SET areas_preferred = '{}' WHERE areas_preferred IS NULL;
