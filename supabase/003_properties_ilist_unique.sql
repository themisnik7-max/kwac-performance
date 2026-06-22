-- ================================================
-- Unique constraint needed for the import page's upsert(onConflict:'ilist_id')
-- to actually dedupe instead of erroring or creating duplicates.
-- Run this in Supabase SQL Editor, after 002_multitenancy_and_rls.sql.
-- Safe to re-run.
-- ================================================

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'properties_ilist_id_key'
  ) then
    alter table properties add constraint properties_ilist_id_key unique (ilist_id);
  end if;
end $$;

-- Also track who imported a property (useful for debugging bad imports).
alter table properties add column if not exists imported_by uuid references agents(id);

-- property_valuations (the standalone /valuation tool's feedback log) needs
-- the same agent/agency attribution as everything else.
do $$
begin
  if to_regclass('public.property_valuations') is not null then
    alter table property_valuations add column if not exists agent_id uuid references agents(id);
    alter table property_valuations add column if not exists agency_id uuid references agencies(id);
    alter table property_valuations enable row level security;
    drop policy if exists "property_valuations_agency_isolation" on property_valuations;
    create policy "property_valuations_agency_isolation" on property_valuations for all using (agency_id = current_agency_id());
  end if;
end $$;

select 'ilist_id unique constraint + imported_by + property_valuations RLS applied' as status;
