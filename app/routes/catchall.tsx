import { useSyncExternalStore } from "react";
import { AnimatedRoutes } from "@/components/AnimatedRoutes";
// Load-bearing, and deliberately a STATIC import: the auth routes (/auth and
// /auth/callback) live on this catchall, and the Supabase client parses the
// magic-link fragment at construction (`detectSessionInUrl`). Importing it here
// keeps that construction in the first-load graph, i.e. before hydration and
// before the router can rewrite the URL. See eagerAuthClient.ts for the full
// reasoning; perf-budgets.json `requiredFirstLoad` fails CI if this edge goes.
import "@/integrations/supabase/eagerAuthClient";

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
