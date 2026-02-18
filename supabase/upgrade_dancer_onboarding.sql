-- UPGRADE DANCER ONBOARDING: Privacy & Storage
-- Run this in the Supabase SQL Editor

-- 1. Add Privacy Toggle to Dancers Table
ALTER TABLE dancers 
ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT true;

-- 2. Create 'avatars' Storage Bucket for Profile Photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Set Up RLS Policies for Storage (Allow Uploads)

-- Allow public access to view avatars
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );

-- Allow authenticated users to upload avatars
CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'avatars' );

-- Allow users to update/delete their own avatars (by name matching user folder convention if used, or simplified for now)
CREATE POLICY "Users can update their own avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'avatars' AND auth.uid() = owner );
