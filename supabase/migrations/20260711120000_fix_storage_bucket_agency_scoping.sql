-- 046: Close the storage-layer multi-tenancy gap on property-docs and
-- property-images.
--
-- Both buckets' storage.objects policies only checked auth.role() =
-- 'authenticated' — no agency check at all. The app's own API routes
-- (app/api/property-docs, app/api/property-photos) already scope every
-- request to caller.agency_id, but that check is bypassable entirely: any
-- authenticated agent, from any agency, can call the Supabase Storage SDK
-- directly from the browser with their own anon-key session and read,
-- upload to, or delete objects under ANY agency's folder, since RLS never
-- checked the folder at all. Uploads already write to `${agency_id}/...`
-- (see property-docs/route.ts, property-photos/route.ts), so this just
-- makes the RLS policy actually check the folder segment it already has —
-- the same pattern gpi-documents (migration 044) used correctly from day one.
--
-- Uploads/reads/deletes done through the app's own API routes are
-- unaffected (they use the service-role client, which bypasses RLS
-- entirely) — this only closes the direct-browser-access hole.

drop policy if exists "auth_upload_property_docs" on storage.objects;
create policy "auth_upload_property_docs" on storage.objects
  for insert with check (
    bucket_id = 'property-docs'
    and (storage.foldername(name))[1] = current_agency_id()::text
  );

drop policy if exists "auth_read_property_docs" on storage.objects;
create policy "auth_read_property_docs" on storage.objects
  for select using (
    bucket_id = 'property-docs'
    and (storage.foldername(name))[1] = current_agency_id()::text
  );

drop policy if exists "auth_delete_property_docs" on storage.objects;
create policy "auth_delete_property_docs" on storage.objects
  for delete using (
    bucket_id = 'property-docs'
    and (storage.foldername(name))[1] = current_agency_id()::text
  );

-- property-images: public read is intentional (marketing photos, by
-- design — app/api/property-photos uses getPublicUrl, not signed URLs).
-- Only the upload policy needs agency scoping; there's no DELETE policy at
-- all today, which already correctly denies direct-browser deletes by
-- default (RLS enabled, no permissive DELETE policy = denied).
drop policy if exists "auth_upload_property_images" on storage.objects;
create policy "auth_upload_property_images" on storage.objects
  for insert with check (
    bucket_id = 'property-images'
    and (storage.foldername(name))[1] = current_agency_id()::text
  );

select 'Storage bucket agency scoping fixed for property-docs + property-images' as status;
