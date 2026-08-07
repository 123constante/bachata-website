import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { shouldRedirectToAuth } from "@/lib/authResolution";
import { supabase } from "@/integrations/supabase/client";
import { inferOnboardingStatusFromDancer } from "@/lib/onboardingStatus";

const requiresCompletedOnboarding = (pathname: string) => {
  if (pathname === "/onboarding") return false;
  if (pathname === "/profile") return true;
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/vendor-dashboard")) return true;
  if (pathname === "/create-event") return true;
  return /^\/event\/[^/]+\/edit$/.test(pathname);
};

export const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading, authStatus, retryAuth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(false);

  useEffect(() => {
    // `authStatus === "ready"`, NOT `!isLoading` (supabase-defer arc, P5).
    // Those were the same test until auth resolution gained a failure mode:
    // acquiring the client is a runtime fetch now, and when it fails the
    // provider reports user=null with loading finished, which is indistinct
    // from a signed-out visitor. Redirecting on that bounced a genuinely
    // authenticated user to /auth over a transient chunk failure. Only a
    // RESOLVED absence of a user may redirect.
    if (shouldRedirectToAuth(authStatus, user)) {
      const returnTo = `${location.pathname}${location.search}`;
      const needsSignup = location.pathname === "/profile" || location.pathname.startsWith("/create-");
      const targetMode = needsSignup ? "signup" : "signin";
      navigate(`/auth?mode=${targetMode}&returnTo=${encodeURIComponent(returnTo)}`);
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
      const { data: dancer } = await supabase
        .from("dancer_profiles")
        .select("first_name, based_city_id, meta_data")
        .eq("created_by", user.id)
        .maybeSingle();

      if (cancelled) return;

      const onboardingStatus = inferOnboardingStatusFromDancer(dancer);
      if (onboardingStatus !== "completed") {
        navigate("/onboarding", { replace: true });
        return;
      }

      setIsCheckingOnboarding(false);
    };

    void verifyOnboarding();

    return () => {
      cancelled = true;
    };
  }, [authStatus, location.pathname, navigate, user]);

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
                  `/auth?mode=signin&returnTo=${encodeURIComponent(
                    `${location.pathname}${location.search}`,
                  )}`,
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
