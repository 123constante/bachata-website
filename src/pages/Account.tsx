import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import GlobalLayout from "@/components/layout/GlobalLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { DancerHome } from "@/components/account/DancerHome";
import { useAuth } from "@/hooks/useAuth";
import { useNoindexMeta } from "@/hooks/useNoindexMeta";
import { buildBreadcrumbs } from "@/lib/breadcrumbs";
import { accountHome, isLegacyAccountLink } from "@/lib/accountRouting";
import { legacyAccountPath } from "@/modules/organiser/shell/legacyPaths";
import {
  fetchMyAccessRequests,
  fetchOrganiserHome,
  myAccessRequestsQueryKey,
  organiserHomeQueryKey,
} from "@/modules/organiser/shared/selfServeApi";

/** A query that failed, or is paused offline with nothing cached, reads as failed (null). */
const settled = <T, R>(q: { data: T | undefined; isError: boolean; isPending: boolean; isPaused: boolean }, pick: (d: T) => R) =>
  q.data !== undefined ? pick(q.data) : q.isError || (q.isPending && q.isPaused) ? null : undefined;

/**
 * /account -- where the account icon goes. lib/accountRouting decides: an
 * organiser (or someone with an open access request) is sent on to the
 * organiser home, everyone else gets the dancer home. The reads are the
 * organiser area's own (same keys and fetchers), so the organiser home opens
 * from the cache instead of asking again. Exported for tests; the route renders
 * the guarded default export.
 */
export const AccountScreen = () => {
  const { user } = useAuth();
  const { search, hash } = useLocation();
  const legacyParams = isLegacyAccountLink(search, hash);
  const enabled = Boolean(user?.id) && !legacyParams;
  const home = useQuery({ queryKey: organiserHomeQueryKey(user?.id), queryFn: fetchOrganiserHome, enabled });
  const requests = useQuery({ queryKey: myAccessRequestsQueryKey(user?.id), queryFn: fetchMyAccessRequests, enabled });

  const organiserCount = settled(home, (d) => d.organisers.length);
  const openRequestCount = settled(requests, (d) => d.filter((r) => r.status === "open").length);
  const where = accountHome({ legacyParams, organiserCount, openRequestCount });

  // A claim, create or request made from the dancer home's "I organise events"
  // makes this person an organiser. They stay here, where that confirmation is on
  // screen, with a link on; a redirect would unmount it before anyone read it.
  // Only THEIR action does that: an organiser answer arriving later for any other
  // reason (a failed read recovering) still redirects.
  const [actedHere, setActedHere] = useState(false);

  if (where === "organiser" && !actedHere) return <Navigate to={legacyAccountPath("home", {}, search, hash)} replace />;

  return (
    <GlobalLayout breadcrumbs={buildBreadcrumbs("profile")}>
      <div className="px-4 pb-24 pt-3">
        <div className="mx-auto w-full max-w-md space-y-3">
          <h1 className="text-lg font-bold text-foreground">Your account</h1>
          {where === "loading" ? (
            <div className="space-y-3" aria-busy="true" data-testid="account-loading">
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </div>
          ) : (
            <DancerHome
              organiserCheckFailed={organiserCount === null || openRequestCount === null}
              nowOrganiser={actedHere && where === "organiser"}
              onOrganiserAction={() => setActedHere(true)}
              requests={requests.data ?? []}
            />
          )}
        </div>
      </div>
    </GlobalLayout>
  );
};

// Signed out -> /auth (sign-in) with returnTo, the same guard the organiser area uses.
const Account = () => {
  useNoindexMeta(true);
  return (
    <AuthGuard>
      <AccountScreen />
    </AuthGuard>
  );
};

export default Account;
