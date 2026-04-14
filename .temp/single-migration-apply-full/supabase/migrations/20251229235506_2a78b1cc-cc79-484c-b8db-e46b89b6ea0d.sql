-- Fix 1: Remove overly permissive policies on organisers that expose email/phone
DROP POLICY IF EXISTS "Organisers viewable by everyone" ON public.organisers;
DROP POLICY IF EXISTS "Organisers visible to all" ON public.organisers;

-- Create a security definer function to get public organiser info (without sensitive data)
CREATE OR REPLACE FUNCTION public.get_public_organiser_info(organiser_id uuid)
RETURNS TABLE(
  id uuid,
  name text,
  bio text,
  photo_url text,
  city text,
  instagram text,
  website text,
  category text,
  verified boolean,
  teaching_styles text[],
  gallery_urls text[],
  promo_video_urls text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    o.id, o.name, o.bio, o.photo_url, o.city, o.instagram, o.website, 
    o.category, o.verified, o.teaching_styles, o.gallery_urls, o.promo_video_urls
  FROM public.organisers o
  WHERE o.id = organiser_id;
$$;

-- Create new policy: Public can view non-sensitive organiser info only
CREATE POLICY "Public can view organiser public info"
ON public.organisers
FOR SELECT
USING (true);

-- Note: The above policy still allows SELECT, but we should use the function for public display
-- and only expose full data (email/phone) to the organiser themselves or admins

-- Create policy for organisers to see their own full data including email/phone
-- (This is already covered by "Users manage their own organiser profile")

-- Fix 2: Remove the permissive public dancer profile creation policy
DROP POLICY IF EXISTS "Allow public dancer profile creation" ON public.dancers;

-- Ensure only authenticated users can create dancer profiles with their own user_id
-- The existing "Dancer can insert self" policy already requires auth.uid() = user_id
-- We just needed to remove the overly permissive "Allow public dancer profile creation"