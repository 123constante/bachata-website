-- Allow public read access to published events only
CREATE POLICY "Public can view published events"
ON public.events
FOR SELECT
USING (is_published = true);

-- Allow creators to view their own draft events
CREATE POLICY "Creators can view own drafts"
ON public.events
FOR SELECT
USING (auth.uid() = created_by);

-- Allow admins to view all events
CREATE POLICY "Admins can view all events"
ON public.events
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  )
);