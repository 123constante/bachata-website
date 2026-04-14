-- Create event_permissions table for explicit event editing rights
CREATE TABLE public.event_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'editor',
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- Enable RLS
ALTER TABLE public.event_permissions ENABLE ROW LEVEL SECURITY;

-- Public can read permissions (needed to check if user has access)
CREATE POLICY "Users can view their own permissions"
ON public.event_permissions
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all permissions
CREATE POLICY "Admins can view all permissions"
ON public.event_permissions
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
));

-- Event creators can manage permissions for their events
CREATE POLICY "Event creators can manage permissions"
ON public.event_permissions
FOR ALL
USING (EXISTS (
  SELECT 1 FROM events WHERE events.id = event_permissions.event_id AND events.created_by = auth.uid()
));

-- Admins can manage all permissions
CREATE POLICY "Admins can manage all permissions"
ON public.event_permissions
FOR ALL
USING (EXISTS (
  SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
));