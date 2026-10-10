import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { shouldRedirectToAuth } from "@/lib/authResolution";
import { buildSignInHref } from "@/lib/authRouting";
import { supabase } from "@/integrations/supabase/client";
import { inferOnboardingStatusFromDancer } from "@/lib/onboardingStatus";
import { myPersonaIdForReads } from "@/lib/myPersona";

const requiresCompletedOnboarding = (pathname: string) => {
  if (pathname === "/profile") return true;
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/vendor-dashboard")) return true;
  if (pathname === "/create-event") return true;
  return /^\/event\/[^/]+\/edit$/.test(pathname);
};

export const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading, authStatus, retryAuth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(false);
  // One redirect per mount. While the /auth navigation is still pending (a
  // slow route-manifest fetch), re-renders re-ran this effect and each
  // navigate() aborted the previous one: a loop that never reached /auth.
  const redirectedRef = useRef(false);

  useEffect(() => {
    // `authStatus === "ready"`, NOT `!isLoading` (supabase-defer arc, P5).
    // Those were the same test until auth resolution gained a failure mode:
    // acquiring the client is a runtime fetch now, and when it fails the
    // provider reports user=null with loading finished, which is indistinct
    // from a signed-out visitor. Redirecting on that bounced a genuinely
    // authenticated user to /auth over a transient chunk failure. Only a
    // RESOLVED absence of a user may redirect.
    if (!redirectedRef.current && shouldRedirectToAuth(authStatus, user)) {
      redirectedRef.current = true;
      const returnTo = `${location.pathname}${location.search}`;
      const needsSignup = location.pathname === "/profile" || location.pathname.startsWith("/create-");
      const targetMode = needsSignup ? "signup" : "signin";
      navigate(buildSignInHref(returnTo, targetMode));
    }
  }, [user, authStatus, navigate, location]);

  useEffect(() => {
    let cancelled = false;

    const verifyOnboarding = async () => {
      // Gate on the RESOLVED status, not merely on loading having finished.
      // A late auth event can set `user` while the status is still
      // `unavailable`, and this effect would then query the DB and possibly
      // navigate() the visitor away from a screen that is at that moment
      // telling them their sign-in could not be verified -- the render branch
      // below and this effect disagreeing about what state we are in.
      if (authStatus !== "ready" || !user) {
        setIsCheckingOnboarding(false);
        return;
      }
      if (!requiresCompletedOnboarding(location.pathname)) {
        setIsCheckingOnboarding(false);
        return;
      }

      setIsCheckingOnboarding(true);
      // OWNERSHIP, not authorship. `created_by` records who AUTHORED the row:
      // one admin account authored ten other people's profiles and none of its
      // own, so this gate resolved to a stranger set for them and to nothing
      // for all 18 other accounts -- bouncing every user to /onboarding.
      // The owned row is the RESOLVED persona (lib/myPersona): the admin-made
      // profile an account is linked to, else its own stub. Keyed on user.id a
      // linked person was judged on their empty stub and bounced home.
      // No persona = no row, the same answer this gate gave before for no row.
      const personaId = await myPersonaIdForReads(queryClient, user.id);
      if (cancelled) return;
      const { data: dancer } = personaId
        ? await supabase
            .from("dancer_profiles")
            .select("first_name, based_city_id, meta_data")
            .eq("id", personaId)
            .maybeSingle()
        : { data: null };

      if (cancelled) return;

      const onboardingStatus = inferOnboardingStatusFromDancer(dancer);
      if (onboardingStatus !== "completed") {
        // Home, not /onboarding: that route was retired on 2026-09-12 and is a
        // 404. Not back to this page either -- it is the one that just refused.
        navigate("/", { replace: true });
        return;
      }

      setIsCheckingOnboarding(false);
    };

    void verifyOnboarding();

    return () => {
      cancelled = true;
    };
  }, [authStatus, location.pathname, navigate, user, queryClient]);

  if (isLoading || isCheckingOnboarding) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Auth resolution FAILED (P5). Deliberately not a redirect and not a silent
  // signed-out render: the visitor may well be signed in, and we simply could
  // not find out -- most often a transient failure fetching the client chunk.
  // Public surfaces degrade to the signed-out look because there "we could not
  // tell" and "signed out" are indistinguishable to a visitor; here they are
  // not, because here the difference decides whether they lose the page.
  if (authStatus === "unavailable") {
    return (
      <div className="min-h-[60vh] w-full flex items-center justify-center px-4">
        <div className="max-w-xs w-full text-center space-y-3 rounded-lg border border-border p-3">
          <h1 className="text-base font-semibold text-foreground">
            Can&rsquo;t verify your sign-in
          </h1>
          <p className="text-sm text-muted-foreground">
            We couldn&rsquo;t reach the server to check whether you&rsquo;re signed in.
            Your session hasn&rsquo;t been lost &mdash; check your connection and try again.
          </p>
          <div className="flex flex-col gap-2">
            <Button size="sm" onClick={retryAuth}>
              Try again
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                navigate(
                  buildSignInHref(`${location.pathname}${location.search}`),
                )
              }
            >
              Sign in instead
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
};
