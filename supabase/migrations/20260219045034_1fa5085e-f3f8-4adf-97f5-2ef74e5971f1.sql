
-- =====================================================
-- FIX: Remove overly permissive RLS policies
-- These "catch-all" policies effectively disable RLS
-- by allowing ALL operations with USING(true)
-- =====================================================

-- === dj_profiles: Drop dangerous catch-all policies ===
DROP POLICY IF EXISTS "Admin Full Access" ON public.dj_profiles;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.dj_profiles;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.dj_profiles;
DROP POLICY IF EXISTS "anon_all_access" ON public.dj_profiles;
-- Keep: "Public can view DJ profiles", "DJ can insert own profile", "DJ can update own profile", admin SELECT policies

-- Add proper admin management policy for dj_profiles
CREATE POLICY "Admins can manage dj_profiles"
ON public.dj_profiles FOR ALL
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid() AND profiles.is_admin = true
))
WITH CHECK (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid() AND profiles.is_admin = true
));

-- Add DELETE policy for DJ profile owners
CREATE POLICY "DJ can delete own profile"
ON public.dj_profiles FOR DELETE
USING (auth.uid() = user_id);

-- === organisers: Drop dangerous catch-all policies ===
DROP POLICY IF EXISTS "Admin Full Access" ON public.organisers;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.organisers;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.organisers;
-- Keep: "Public can view organiser public info", "Organiser can insert self", "Organiser can update own", admin SELECT, "Users manage their own organiser profile"

-- Add proper admin management policy for organisers
CREATE POLICY "Admins can manage organisers"
ON public.organisers FOR ALL
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid() AND profiles.is_admin = true
))
WITH CHECK (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid() AND profiles.is_admin = true
));

-- === teacher_profiles: Drop dangerous catch-all policies ===
DROP POLICY IF EXISTS "Admin Full Access" ON public.teacher_profiles;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.teacher_profiles;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.teacher_profiles;
-- Keep: "Public can view teacher profiles", "Teacher can insert own profile", "Teacher can update own profile", admin SELECT policies

-- Add proper admin management policy for teacher_profiles
CREATE POLICY "Admins manage teacher_profiles"
ON public.teacher_profiles FOR ALL
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid() AND profiles.is_admin = true
))
WITH CHECK (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid() AND profiles.is_admin = true
));

-- Add DELETE policy for teacher profile owners
CREATE POLICY "Teacher can delete own profile"
ON public.teacher_profiles FOR DELETE
USING (auth.uid() = user_id);

-- === vendors: Drop dangerous catch-all policies ===
DROP POLICY IF EXISTS "Admin Full Access" ON public.vendors;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.vendors;
-- Keep: "Public Read", "Auth insert", "Owner update", "Owner delete"

-- Add proper admin management policy for vendors
CREATE POLICY "Admins can manage vendors"
ON public.vendors FOR ALL
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid() AND profiles.is_admin = true
))
WITH CHECK (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid() AND profiles.is_admin = true
));

-- === videographers: Drop dangerous catch-all policies ===
DROP POLICY IF EXISTS "Admin Full Access" ON public.videographers;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.videographers;
-- Keep: "Public Read", "Auth insert", "Owner update", "Owner delete"

-- Add proper admin management policy for videographers
CREATE POLICY "Admins can manage videographers"
ON public.videographers FOR ALL
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid() AND profiles.is_admin = true
))
WITH CHECK (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid() AND profiles.is_admin = true
));

-- === events: Drop dangerous catch-all policies ===
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.events;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.events;
-- Keep all the specific policies (creator, admin, organiser, public read)
