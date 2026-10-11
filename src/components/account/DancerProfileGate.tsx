import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfileCompletion } from "@/hooks/useProfileCompletion";
import { dancerGate } from "@/lib/accountRouting";
import { finishProfileHref } from "@/lib/profileCompletion";

/**
 * Dancer first, then organiser (owner decision 2026-10-11): the ONE guard in
 * front of every account and organiser page -- /account, /account/dancer,
 * /account/o/* and /invite (lib/accountRouting isDancerGatedPath lists them).
 * While the dancer profile is unfinished it replaces the page with
 * /finish-profile?returnTo=<the page they wanted>; the Finish screen sees a
 * gated returnTo, says why and offers no Skip, and saving the last field sends
 * them on to that page. Decided by dancerGate() alone.
 *
 * Mount it INSIDE AuthGuard (signed out passes through to it) and inside the
 * page's lazy chunk, as AuthGuard is: nothing here joins the public first load.
 */
export function DancerProfileGate({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const completion = useProfileCompletion();
  const { pathname, search, hash } = useLocation();
  const gate = dancerGate(completion.status);
  if (gate === "gate") return <Navigate to={finishProfileHref(`${pathname}${search}${hash}`)} replace />;
  if (gate === "wait") {
    return (
      fallback ?? (
        <div className="mx-auto w-full max-w-md space-y-3 px-4 pt-3" aria-busy="true" data-testid="dancer-gate-checking">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      )
    );
  }
  return <>{children}</>;
}
