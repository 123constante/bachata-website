import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ensureDancerProfile } from "@/lib/ensureDancerProfile";
import { AUTH_PENDING_RETURN_TO_KEY, sanitizeReturnTo, stashPendingReturnTo } from "@/lib/authRouting";
import { inferOnboardingStatusFromDancer } from "@/lib/onboardingStatus";

const VALID_ROLES: Record<string, string> = {
  organiser: "/create-organiser-profile",
  teacher: "/create-teacher-profile",
  dj: "/create-dj-profile",
  videographer: "/create-videographer-profile",
  vendor: "/create-vendor-profile",
};

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error] = useState<string | null>(null);
  const resolved = useRef(false);

  const safeReturnTo = sanitizeReturnTo(searchParams.get("returnTo"));
  const callbackMode = searchParams.get("mode");

  const navigateToOnboardingFallback = (reason: "timeout" | "profile" | "metadata" | "lookup" | "incomplete") => {
    if (safeReturnTo) {
      stashPendingReturnTo(safeReturnTo);
    }
    navigate(`/onboarding?authFallback=${reason}`, { replace: true });
  };

  const navigateToSignInFallback = (reason: "expired" | "invalid" | "manual" | "timeout") => {
    navigate(`/auth?mode=signin&callbackError=${reason}`, { replace: true });
  };

  const resolveRolePreference = (pendingRole: string | null, metaRoleRaw: unknown) => {
    const normalizedMetaRole = typeof metaRoleRaw === "string" ? metaRoleRaw.trim().toLowerCase() : "";
    const metaRole = normalizedMetaRole === "dancer" || VALID_ROLES[normalizedMetaRole] ? normalizedMetaRole : null;
    const preferredRole = pendingRole || metaRole;

    if (!pendingRole && preferredRole) {
      localStorage.setItem("pending_profile_role", preferredRole);
    }

    return preferredRole;
  };

  useEffect(() => {
    if (resolved.current) return;

    const timeout = setTimeout(() => {
      if (!resolved.current) {
        resolved.current = true;
        navigateToSignInFallback("timeout");
      }
    }, 15000);

    const resolveSession = async (session: any) => {
      if (resolved.current) return;
      if (!session?.user) return;

      resolved.current = true;
      clearTimeout(timeout);

      const user = session.user;

      try {
        const pendingRole = localStorage.getItem("pending_profile_role");
        const isSignupFlow = callbackMode === "signup" || (callbackMode !== "signin" && Boolean(pendingRole));
        const meta = user.user_metadata || {};
        const preferredRole = resolveRolePreference(pendingRole, meta.user_type);

        const { data: dancer } = await supabase
          .from("dancers")
          .select("id, first_name, city, city_id, meta_data")
          .eq("user_id", user.id)
          .maybeSingle();

        if (dancer?.id) {
          const onboardingStatus = inferOnboardingStatusFromDancer(dancer);
          if (onboardingStatus !== "completed") {
            navigateToOnboardingFallback("incomplete");
            return;
          }

          if (!isSignupFlow && safeReturnTo) {
            navigate(safeReturnTo, { replace: true });
            return;
          }

          const pendingReturnTo = sanitizeReturnTo(localStorage.getItem(AUTH_PENDING_RETURN_TO_KEY));
          if (pendingReturnTo) {
            localStorage.removeItem(AUTH_PENDING_RETURN_TO_KEY);
            navigate(pendingReturnTo, { replace: true });
            return;
          }

          if (preferredRole && preferredRole !== "dancer" && VALID_ROLES[preferredRole]) {
            navigate(`/create-${preferredRole}-profile`, { replace: true });
          } else {
            navigate("/profile", { replace: true });
          }
          localStorage.removeItem("pending_profile_role");
          return;
        }

        const firstName = meta.first_name as string | undefined;
        const city = meta.city as string | undefined;
        const cityId = meta.city_id as string | undefined;

        if (firstName && (city || cityId)) {
          try {
            await ensureDancerProfile({
              userId: user.id,
              email: user.email,
              firstName,
              city,
              cityId,
            });

            const { data: ensuredDancer } = await supabase
              .from("dancers")
              .select("id, meta_data")
              .eq("user_id", user.id);

            const dancerRow = Array.isArray(ensuredDancer) ? ensuredDancer[0] : null;
            const existingMeta = (dancerRow?.meta_data && typeof dancerRow.meta_data === "object")
              ? (dancerRow.meta_data as Record<string, unknown>)
              : {};

            if (dancerRow?.id) {
              await supabase
                .from("dancers")
                .update({
                  meta_data: {
                    ...existingMeta,
                    onboarding_status: "completed",
                  },
                })
                .eq("id", dancerRow.id);
            }

            if (!isSignupFlow && safeReturnTo) {
              navigate(safeReturnTo, { replace: true });
              return;
            }

            const pendingReturnTo = sanitizeReturnTo(localStorage.getItem(AUTH_PENDING_RETURN_TO_KEY));
            if (pendingReturnTo) {
              localStorage.removeItem(AUTH_PENDING_RETURN_TO_KEY);
              navigate(pendingReturnTo, { replace: true });
              return;
            }

            if (preferredRole && preferredRole !== "dancer" && VALID_ROLES[preferredRole]) {
              navigate(`/create-${preferredRole}-profile`, { replace: true });
            } else {
              navigate("/profile", { replace: true });
            }
            localStorage.removeItem("pending_profile_role");
            return;
          } catch (profileErr) {
            console.error("AuthCallback auto-create profile failed:", profileErr);
            navigateToOnboardingFallback("profile");
            return;
          }
        }

        navigateToOnboardingFallback("metadata");
      } catch (err) {
        console.error("AuthCallback dancer check failed:", err);
        navigateToOnboardingFallback("lookup");
      }
    };

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        void resolveSession(session);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        void resolveSession(session);
      }
    );

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [callbackMode, navigate, safeReturnTo]);

  useEffect(() => {
    if (resolved.current) return;

    const fallbackTimer = setTimeout(async () => {
      if (resolved.current) return;

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) return;

      resolved.current = true;
      const hasAuthParams = Boolean(window.location.hash) || Boolean(searchParams.get("code"));
      navigateToSignInFallback(hasAuthParams ? "expired" : "manual");
    }, 9000);

    return () => clearTimeout(fallbackTimer);
  }, [navigate, searchParams]);

  if (error) {
    return (
      <div className="min-h-screen pt-20 px-4">
        <div className="max-w-sm mx-auto text-center space-y-4">
          <h1 className="text-xl font-semibold text-foreground">Authentication failed</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button onClick={() => navigate("/auth?mode=signin", { replace: true })}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 px-4">
      <div className="max-w-md mx-auto space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
        <p className="text-center text-sm text-muted-foreground">Signing you in…</p>
      </div>
    </div>
  );
};

export default AuthCallback;

