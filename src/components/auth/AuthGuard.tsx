import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

export const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      const returnTo = `${location.pathname}${location.search}`;
      const needsSignup = location.pathname === "/profile" || location.pathname.startsWith("/create-");
      const targetMode = needsSignup ? "signup" : "signin";
      navigate(`/auth?mode=${targetMode}&returnTo=${encodeURIComponent(returnTo)}`);
    }
  }, [user, isLoading, navigate, location]);

  if (isLoading) {
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
