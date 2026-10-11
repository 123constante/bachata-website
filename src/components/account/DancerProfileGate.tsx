import { useRef, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useProfileCompletion } from "@/hooks/useProfileCompletion";
import { dancerGate } from "@/lib/accountRouting";
import { finishProfileHref } from "@/lib/profileCompletion";

/**
 * The dancer-first gate (owner decision 2026-10-11): the ONE route wrapper in
 * front of every /account* page -- the dancer home, My attendance, the
 * organiser home, its onboarding and every /account/o* page. Only a complete
 * dancer profile passes; anyone else goes to /finish-profile with returnTo =
 * the page they wanted, marked gated (no Skip). lib/accountRouting decides.
 *
 * Sits INSIDE AuthGuard and inside each page's lazy chunk, so it adds nothing
 * to the public first load. The completeness read is the same cached
 * `profile-completion` query the banner and the rating card use; the Finish
 * screen refetches it after a save, so returning through here passes at once.
 */
export function DancerProfileGate({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const { status } = useProfileCompletion();
  const { pathname, search, hash } = useLocation();
  const decision = dancerGate(status);
  // Once a page is let through, a read back in flight never takes it away (only a
  // definite "unfinished" does). Without this, a FAILED read looped: the page's own
  // observers re-fetch an errored query on mount, which puts it back to loading,
  // which unmounted the page, which mounted it again on the next error.
  const passed = useRef(false);
  if (decision === "pass") passed.current = true;
  if (decision === "finish") return <Navigate to={finishProfileHref(`${pathname}${search}${hash}`)} replace />;
  if (decision === "wait" && !passed.current) return <>{fallback}</>;
  return <>{children}</>;
}
