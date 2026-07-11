-- 048: property_photos.uploaded_by and property_documents.uploaded_by are
-- still FK'd to auth.users(id), but app/api/property-photos and
-- app/api/property-docs both insert caller.id (agents.id, from
-- getAuthedAgent) — the same class of bug fixed for demand_profiles
-- (migration 040) and voice_notes/property_scouted/meeting_properties
-- (migration 047). Confirmed live (pg_dump, 2026-07-11):
--   property_photos.uploaded_by    -> auth.users(id)
--   property_documents.uploaded_by -> auth.users(id)
-- Unlike the voice-profile tables, the app code here was already correct
-- (writing agents.id) — only the schema/RLS needed to catch up. This has
-- been a hard FK-violation (500 error) on every photo/document upload for
-- every real agent whose agents.id != auth.users.id, i.e. everyone except
-- the 3 original demo accounts.

alter table property_photos drop constraint if exists property_photos_uploaded_by_fkey;
alter table property_photos add constraint property_photos_uploaded_by_fkey
  foreign key (uploaded_by) references agents(id) on delete cascade;

alter table property_documents drop constraint if exists property_documents_uploaded_by_fkey;
alter table property_documents add constraint property_documents_uploaded_by_fkey
  foreign key (uploaded_by) references agents(id) on delete cascade;

drop policy if exists "agent_own_photos" on property_photos;
create policy "agent_own_photos" on property_photos
  for all using (agency_id = current_agency_id() and uploaded_by = current_agent_id());

drop policy if exists "admin_agency_photos" on property_photos;
create policy "admin_agency_photos" on property_photos
  for all using (agency_id = current_agency_id() and is_ceo_or_admin());

drop policy if exists "agent_own_docs" on property_documents;
create policy "agent_own_docs" on property_documents
  for all using (agency_id = current_agency_id() and uploaded_by = current_agent_id());

drop policy if exists "admin_agency_docs" on property_documents;
create policy "admin_agency_docs" on property_documents
  for all using (agency_id = current_agency_id() and is_ceo_or_admin());

select 'property_photos / property_documents uploaded_by repointed to agents(id) + RLS fixed' as status;
