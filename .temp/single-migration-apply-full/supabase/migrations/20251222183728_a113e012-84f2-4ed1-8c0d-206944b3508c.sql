-- Allow public inserts to dancers table (temporary - until auth is implemented)
CREATE POLICY "Allow public dancer profile creation"
ON public.dancers
FOR INSERT
WITH CHECK (true);