-- Account lookup helper for onboarding flows (role -> email -> account routing)
-- Security definer is required to check auth.users from client-invoked RPC.

CREATE OR REPLACE FUNCTION public.account_exists_by_email(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE lower(trim(u.email)) = lower(trim(coalesce(p_email, '')))
  );
$$;

REVOKE ALL ON FUNCTION public.account_exists_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.account_exists_by_email(text) TO anon;
GRANT EXECUTE ON FUNCTION public.account_exists_by_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.account_exists_by_email(text) TO service_role;
