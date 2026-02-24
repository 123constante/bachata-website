import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
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
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      const returnTo = `${location.pathname}${location.search}`;
      const needsSignup = location.pathname === "/profile" || location.pathname.startsWith("/create-");
      const targetMode = needsSignup ? "signup" : "signin";
      navigate(`/auth?mode=${targetMode}&returnTo=${encodeURIComponent(returnTo)}`);
    }
  }, [user, isLoading, navigate, location]);

  useEffect(() => {
    let cancelled = false;

    const verifyOnboarding = async () => {
      if (isLoading || !user) {
        setIsCheckingOnboarding(false);
        return;
      }
      if (!requiresCompletedOnboarding(location.pathname)) {
        setIsCheckingOnboarding(false);
        return;
      }

      setIsCheckingOnboarding(true);
      const { data: dancer } = await supabase
        .from("dancers")
        .select("first_name, city, city_id, meta_data")
        .eq("user_id", user.id)
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
  }, [isLoading, location.pathname, navigate, user]);

  if (isLoading || isCheckingOnboarding) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
};
