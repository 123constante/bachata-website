import { useSyncExternalStore } from "react";
import { AnimatedRoutes } from "@/components/AnimatedRoutes";

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
