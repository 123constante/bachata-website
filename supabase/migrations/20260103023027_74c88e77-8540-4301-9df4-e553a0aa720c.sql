-- Create generic entities table
CREATE TABLE public.entities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL, -- 'organiser', 'teacher', 'dj', 'photographer'
  name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  city TEXT,
  socials JSONB DEFAULT '{}'::jsonb, -- {instagram, website, facebook, etc}
  claimed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create event_entities junction table
CREATE TABLE public.event_entities (
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- 'organiser', 'teacher', 'dj', 'performer'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, entity_id, role)
);

-- Enable RLS on both tables
ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_entities ENABLE ROW LEVEL SECURITY;

-- Entities: Public read access
CREATE POLICY "Entities are publicly viewable"
ON public.entities FOR SELECT
USING (true);

-- Entities: Claimed user can update their own entity
CREATE POLICY "Claimed user can update entity"
ON public.entities FOR UPDATE
USING (auth.uid() = claimed_by);

-- Entities: Claiming - any authenticated user can claim unclaimed entity
CREATE POLICY "Authenticated can claim unclaimed entity"
ON public.entities FOR UPDATE
USING (claimed_by IS NULL AND auth.uid() IS NOT NULL)
WITH CHECK (claimed_by = auth.uid());

-- Entities: Admin can manage all
CREATE POLICY "Admins can manage entities"
ON public.entities FOR ALL
USING (EXISTS (
  SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true
));

-- Event entities: Public read
CREATE POLICY "Event entities are publicly viewable"
ON public.event_entities FOR SELECT
USING (true);

-- Event entities: Admin can manage
CREATE POLICY "Admins can manage event entities"
ON public.event_entities FOR ALL
USING (EXISTS (
  SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true
));

-- Create index for faster lookups
CREATE INDEX idx_entities_type ON public.entities(type);
CREATE INDEX idx_entities_claimed_by ON public.entities(claimed_by);
CREATE INDEX idx_event_entities_event_id ON public.event_entities(event_id);
CREATE INDEX idx_event_entities_entity_id ON public.event_entities(entity_id);

-- Migrate existing organisers data to entities
INSERT INTO public.entities (id, type, name, avatar_url, bio, city, socials, claimed_by, created_at)
SELECT 
  id,
  'organiser',
  name,
  photo_url,
  bio,
  city,
  jsonb_build_object(
    'instagram', instagram,
    'website', website,
    'email', email
  ),
  user_id,
  created_at
FROM public.organisers;

-- Migrate event_organisers to event_entities
INSERT INTO public.event_entities (event_id, entity_id, role, created_at)
SELECT 
  event_id,
  organiser_id,
  'organiser',
  created_at
FROM public.event_organisers;