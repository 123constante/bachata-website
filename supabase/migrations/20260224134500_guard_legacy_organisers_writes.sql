-- Guard legacy organisers table against future writes.
-- Canonical source is public.entities where type = 'organiser'.

-- 1) Revoke direct write permissions
REVOKE INSERT, UPDATE ON TABLE public.organisers FROM PUBLIC;
REVOKE INSERT, UPDATE ON TABLE public.organisers FROM anon;
REVOKE INSERT, UPDATE ON TABLE public.organisers FROM authenticated;
REVOKE INSERT, UPDATE ON TABLE public.organisers FROM service_role;

-- 2) Hard guard trigger for any write attempt that still reaches table-level checks
CREATE OR REPLACE FUNCTION public.block_legacy_organisers_writes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Writes to public.organisers are blocked. Use public.entities (type=''organiser'') as canonical source.';
END;
$$;

DROP TRIGGER IF EXISTS trg_block_legacy_organisers_writes ON public.organisers;
CREATE TRIGGER trg_block_legacy_organisers_writes
BEFORE INSERT OR UPDATE ON public.organisers
FOR EACH ROW
EXECUTE FUNCTION public.block_legacy_organisers_writes();
