-- Add created_by column to track event creators
ALTER TABLE public.events 
ADD COLUMN created_by uuid REFERENCES auth.users(id);

-- Create RLS policy for creators to update their own events
CREATE POLICY "Creator can update own events"
ON public.events
FOR UPDATE
USING (auth.uid() = created_by);

-- Create policy for admins to update any event
CREATE POLICY "Admin can update any event"
ON public.events
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  )
);

-- Allow creators to view their own drafts
CREATE POLICY "Creators can view own drafts"
ON public.events
FOR SELECT
USING (
  is_published = true 
  OR auth.uid() = created_by
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  )
);