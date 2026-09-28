import { useSyncExternalStore } from "react";
import { AnimatedRoutes } from "@/components/AnimatedRoutes";
// Load-bearing, and deliberately a STATIC import: the auth routes (/auth and
// /auth/callback) live on this catchall, and the Supabase client parses the
// magic-link fragment at construction (`detectSessionInUrl`). Importing it here
// keeps that construction in the first-load graph, i.e. before hydration and
// before the router can rewrite the URL. See eagerAuthClient.ts for the full
// reasoning; perf-budgets.json `requiredFirstLoad` fails CI if this edge goes.
import "@/integrations/supabase/eagerAuthClient";
import { staticShellCacheHeaders } from "../detailLoader";

// Edge-cache this shell. MEASURED, not assumed: on 2026-09-27 Vercel's
// Observability reported `/*` at 8.0K edge requests in 12h with an 8.2% cache
// hit rate -- ~480K function invocations a month, which is the whole of the
// 519K Function Invocations row and what put Fluid Provisioned Memory at 353%
// and Fluid Active CPU at 130% of the free-tier caps.
//
// WHAT IS SAFE TO CACHE HERE, and it is the component below that makes it
// true: this route has NO loader and renders `null` on the server. Every byte
// of the document is the root chrome shell plus React Router's serialised
// match context, both fixed by the build. Two consequences worth stating
// because neither is obvious from the header alone:
//
//   - /auth and /auth/callback live on this catchall and are cached like
//     everything else. That is deliberate and it is not a session leak: the
//     magic-link credential travels in the URL FRAGMENT, which no server ever
//     receives, and the shell contains no user data to leak because it
//     contains nothing at all. The Supabase client parses the fragment after
//     hydration, from the eager import above. /profile and /onboarding are the
//     same shape. IF THIS ROUTE EVER GAINS A LOADER, this reasoning expires
//     with it -- use cacheHeaders() and a real tag at that point, not this.
//
//   - A URL that matches nothing gets the client 404, and that document is
//     cached too. Harmless for the same reason: it is the same shell. But note
//     the shape of the win, so a modest number later is not read as a failure
//     -- cache entries are PER URL, so this converts repeat traffic to the
//     real client routes (/teachers, /organisers, /djs, /dancers, /venues,
//     /search) into hits, while a scanner walking unique URLs still misses
//     every time. The Bot Name table accounts for only ~1.8K of that 8K, so a
//     visible share of the remainder is exactly that kind of traffic.
//
// No `loader` was added to carry a per-path exception, and that is a cost
// decision rather than a stylistic one: giving this route a loader would make
// every client-side navigation INTO a catchall path fetch a `.data` response
// it does not fetch today -- new metered requests, on the meter this change
// exists to bring down. React Router calls headers() from the route module
// whether or not a loader exists (server-runtime/headers.ts reduces over every
// match and only checks for the export), so the loader would buy nothing else.
export function headers() {
  return staticShellCacheHeaders();
}

// Client-gate (spike design decision D1): the legacy ~60-route declarative tree
// is client-rendered, matching Phase 3's target (listings/home/auth stay
// client-side). The server emits only the root chrome shell; AnimatedRoutes
// mounts after hydration. This deliberately avoids SSR'ing the unaudited pages
// during the spike — those become individual framework routes in Phase 3.
const emptySubscribe = () => () => {};
function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true, // client snapshot
    () => false, // server snapshot
  );
}

export default function CatchAll() {
  const hydrated = useHydrated();
  if (!hydrated) return null;
  return <AnimatedRoutes />;
}
