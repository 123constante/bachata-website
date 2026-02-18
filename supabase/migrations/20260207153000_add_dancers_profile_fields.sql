-- Migration: 20260207153000_add_dancers_profile_fields.sql
-- Description: Add missing profile fields to dancers.

ALTER TABLE public.dancers
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS instagram text,
  ADD COLUMN IF NOT EXISTS facebook text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS nationality text,
  ADD COLUMN IF NOT EXISTS dancing_start_date text,
  ADD COLUMN IF NOT EXISTS years_dancing text,
  ADD COLUMN IF NOT EXISTS partner_role text,
  ADD COLUMN IF NOT EXISTS favorite_styles text[],
  ADD COLUMN IF NOT EXISTS achievements text[],
  ADD COLUMN IF NOT EXISTS favorite_songs text[],
  ADD COLUMN IF NOT EXISTS festival_plans text[],
  ADD COLUMN IF NOT EXISTS looking_for_partner boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS partner_search_role text,
  ADD COLUMN IF NOT EXISTS partner_search_level text[],
  ADD COLUMN IF NOT EXISTS partner_practice_goals text[],
  ADD COLUMN IF NOT EXISTS partner_details jsonb,
  ADD COLUMN IF NOT EXISTS hide_surname boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS photo_url text[];

COMMENT ON COLUMN public.dancers.phone IS 'Optional phone contact number.';
COMMENT ON COLUMN public.dancers.website IS 'Optional website or linktree.';
COMMENT ON COLUMN public.dancers.instagram IS 'Optional Instagram handle.';
COMMENT ON COLUMN public.dancers.facebook IS 'Optional Facebook profile.';
COMMENT ON COLUMN public.dancers.city IS 'Optional city.';
COMMENT ON COLUMN public.dancers.nationality IS 'Optional nationality.';
COMMENT ON COLUMN public.dancers.dancing_start_date IS 'Text value for experience start date.';
COMMENT ON COLUMN public.dancers.years_dancing IS 'Legacy years dancing value.';
COMMENT ON COLUMN public.dancers.partner_role IS 'Leader/Follower/Both.';
COMMENT ON COLUMN public.dancers.favorite_styles IS 'Array of favorite dance styles.';
COMMENT ON COLUMN public.dancers.achievements IS 'Array of achievements.';
COMMENT ON COLUMN public.dancers.favorite_songs IS 'Array of favorite songs.';
COMMENT ON COLUMN public.dancers.festival_plans IS 'Array of festival plan ids.';
COMMENT ON COLUMN public.dancers.looking_for_partner IS 'Whether dancer is looking for a partner.';
COMMENT ON COLUMN public.dancers.partner_search_role IS 'Partner search role.';
COMMENT ON COLUMN public.dancers.partner_search_level IS 'Partner search level(s).';
COMMENT ON COLUMN public.dancers.partner_practice_goals IS 'Partner practice goals.';
COMMENT ON COLUMN public.dancers.partner_details IS 'Partner search details as jsonb.';
COMMENT ON COLUMN public.dancers.hide_surname IS 'Whether surname is hidden publicly.';
COMMENT ON COLUMN public.dancers.photo_url IS 'Profile photo URLs.';
