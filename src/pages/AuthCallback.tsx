import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ensureDancerProfile } from "@/lib/ensureDancerProfile";

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
  const [error, setError] = useState<string | null>(null);
  const resolved = useRef(false);

  const sanitizeReturnTo = (value: string | null) => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
    if (trimmed === "/auth" || trimmed.startsWith("/auth/")) return null;
    return trimmed;
  };

  const safeReturnTo = sanitizeReturnTo(searchParams.get("returnTo"));

  const navigateToOnboardingFallback = (reason: "timeout" | "profile" | "metadata" | "lookup") => {
    navigate(`/onboarding?authFallback=${reason}`, { replace: true });
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
        navigateToOnboardingFallback("timeout");
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
        const meta = user.user_metadata || {};
        const preferredRole = resolveRolePreference(pendingRole, meta.user_type);

        if (safeReturnTo) {
          navigate(safeReturnTo, { replace: true });
          return;
        }

        const { data: dancer } = await supabase
          .from("dancers")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (dancer?.id) {
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

        if (firstName && city) {
          try {
            await ensureDancerProfile({
              userId: user.id,
              email: user.email,
              firstName,
              city,
            });

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
      void resolveSession(session);
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
  }, [navigate, safeReturnTo]);

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

