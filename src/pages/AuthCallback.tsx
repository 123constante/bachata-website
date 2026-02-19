import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
  const [error, setError] = useState<string | null>(null);
  const resolved = useRef(false);

  useEffect(() => {
    if (resolved.current) return;

    const timeout = setTimeout(() => {
      if (!resolved.current) {
        setError("Authentication timed out. Please try again.");
      }
    }, 15000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (resolved.current) return;
        if (!session?.user) return;

        resolved.current = true;
        clearTimeout(timeout);

        const user = session.user;

        try {
          const { data: dancer } = await supabase
            .from("dancers")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();

          const pendingRole = localStorage.getItem("pending_profile_role");
          const meta = user.user_metadata || {};

          if (dancer?.id) {
            // Existing dancer — route based on pending role
            if (pendingRole && pendingRole !== "dancer" && VALID_ROLES[pendingRole]) {
              navigate(`/create-${pendingRole}-profile`, { replace: true });
            } else {
              navigate("/profile", { replace: true });
            }
            localStorage.removeItem("pending_profile_role");
          } else {
            // No dancer profile — try to auto-create from metadata
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

                if (pendingRole && pendingRole !== "dancer" && VALID_ROLES[pendingRole]) {
                  navigate(`/create-${pendingRole}-profile`, { replace: true });
                } else {
                  navigate("/profile", { replace: true });
                }
                localStorage.removeItem("pending_profile_role");
              } catch (profileErr) {
                console.error("AuthCallback auto-create profile failed:", profileErr);
                navigate("/onboarding", { replace: true });
              }
            } else {
              // Missing metadata — fall back to onboarding
              navigate("/onboarding", { replace: true });
            }
          }
        } catch (err) {
          console.error("AuthCallback dancer check failed:", err);
          navigate("/onboarding", { replace: true });
        }
      }
    );

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [navigate]);

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

