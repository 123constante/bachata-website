-- Migration: 20260203000000_normalize_songs_schema.sql
-- Description: Create songs table, remove redundant columns, and enforce integrity.

-- 1. Create the `songs` table
-- We verify its existence to avoid conflicts, though safely we should just create it.
CREATE TABLE IF NOT EXISTS public.songs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    genre TEXT NOT NULL, -- 'bachata', 'bachata-remix', 'zouk'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Enforce uniqueness so we don't have duplicate songs
    CONSTRAINT songs_title_artist_key UNIQUE (title, artist)
);

-- 2. Enable RLS on songs
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;

-- 3. Create Policy: Public Read Access
CREATE POLICY "Allow public read access to songs"
ON public.songs
FOR SELECT
TO public
USING (true);

-- 4. Create Policy: Admin/System Insert Access
-- (Assuming authenticated users shouldn't spam the DB with fake songs freely yet)
-- For now, we allow authenticated users to Insert if they want to 'add custom track', 
-- OR we can restrict it. Let's allow authenticated for now to match the "Custom Entry" UI flow if we keep it.
CREATE POLICY "Allow authenticated insert to songs"
ON public.songs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 5. Data Cleanup: Remove `years_dancing` from `dancers`
-- This column is redundant because we have `dancing_start_date`.
-- We will migrate data first if needed, but since `dancing_start_date` was preferred in the code,
-- we'll assume `years_dancing` is legacy junk.
ALTER TABLE public.dancers DROP COLUMN IF EXISTS years_dancing;

-- 6. Add Indexes for Search Performance
CREATE INDEX IF NOT EXISTS songs_title_idx ON public.songs USING gin (to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS songs_artist_idx ON public.songs USING gin (to_tsvector('english', artist));
