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
 * /account -- where the account icon goes -- and /account/dancer.
 *
 * /account asks lib/accountRouting: an organiser (or someone with an open access
 * request) is sent on to the organiser home, exactly where the icon used to go;
 * everyone else gets the dancer home. /account/dancer (`view="dancer"`) is the
 * dancer home for anyone: the account menu's dancer entry for an organiser.
 *
 * The reads are the organiser area's own (same keys and fetchers), so the
 * organiser home opens from the cache instead of asking again. Exported for
 * tests; the routes render the guarded default export.
 */
export const AccountScreen = ({ view = "resolve" }: { view?: "resolve" | "dancer" }) => {
  const { user } = useAuth();
  const { search, hash } = useLocation();
  const legacyParams = view === "resolve" && isLegacyAccountLink(search, hash);
  const enabled = Boolean(user?.id) && !legacyParams;
  const home = useQuery({ queryKey: organiserHomeQueryKey(user?.id), queryFn: fetchOrganiserHome, enabled });
  const requests = useQuery({ queryKey: myAccessRequestsQueryKey(user?.id), queryFn: fetchMyAccessRequests, enabled });

  const organiserCount = settled(home, (d) => d.organisers.length);
  const openRequestCount = settled(requests, (d) => d.filter((r) => r.status === "open").length);
  const where = accountHome({ legacyParams, organiserCount, openRequestCount });

  // A claim, create or request made from the dancer home's "I organise events"
  // makes this person an organiser. They stay here, where that confirmation is on
  // screen, with a link on; a redirect would unmount it before anyone read it.
  const [actedHere, setActedHere] = useState<string | null>(null);

  if (view === "resolve" && where === "organiser" && !actedHere) {
    return <Navigate to={legacyAccountPath("home", {}, search, hash)} replace />;
  }

  // After a claim / create / request made here, the "Done" card takes over from the
  // onboarding (its search results would still offer what was just claimed).
  const nowOrganiser = actedHere && where === "organiser" ? actedHere : null;
  const organiserSection = where === "loading" || nowOrganiser ? "hidden" : where === "organiser" ? "link" : "onboarding";

  return (
    <GlobalLayout breadcrumbs={buildBreadcrumbs(view === "dancer" ? "dancerProfile" : "dancerHome")}>
      <div className="px-4 pb-24 pt-3">
        <div className="mx-auto w-full max-w-md space-y-3">
          <h1 className="text-lg font-bold text-foreground">{view === "dancer" ? "Your dancer profile" : "Your account"}</h1>
          {view === "resolve" && where === "loading" ? (
            <div className="space-y-3" aria-busy="true" data-testid="account-loading">
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </div>
          ) : (
            <DancerHome
              organiserSection={organiserSection}
              // Only when the reads could not prove either way: an organiser already known says nothing.
              organiserCheckFailed={where !== "organiser" && (organiserCount === null || openRequestCount === null)}
              nowOrganiser={nowOrganiser}
              onOrganiserAction={setActedHere}
              requests={requests.data ?? []}
            />
          )}
        </div>
      </div>
    </GlobalLayout>
  );
};

// Signed out -> /auth (sign-in) with returnTo, the same guard the organiser area uses.
const Account = ({ view }: { view?: "resolve" | "dancer" }) => {
  useNoindexMeta(true);
  return (
    <AuthGuard>
      <AccountScreen view={view} />
    </AuthGuard>
  );
};

export default Account;
