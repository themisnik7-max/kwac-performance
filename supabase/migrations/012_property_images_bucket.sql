-- Create storage bucket for property images (public read, auth write)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'property-images',
  'property-images',
  true,
  15728640,   -- 15 MB per file
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/heic','image/heif']
)
ON CONFLICT (id) DO NOTHING;

-- Anyone can read (public URLs work without auth)
CREATE POLICY "public_read_property_images" ON storage.objects
  FOR SELECT USING (bucket_id = 'property-images');

-- Authenticated users can upload
CREATE POLICY "auth_upload_property_images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'property-images'
    AND auth.role() = 'authenticated'
  );

-- Delete is handled in the API route (checks uploaded_by = user.id in property_photos table)
