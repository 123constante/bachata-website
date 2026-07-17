// Festival Map -- a render clock the server and the hydrating client agree on.
//
// The homepage feed now server-renders, and several of its cells are functions
// of "now": the On now / Soon badge (todayLiveStatus), the "Added 2h ago"
// freshness stamp (relativeShort / freshnessHeat) and the New pill (isFreshNew).
// Each of those calls Date.now() during render. The homepage HTML is edge-cached
// (s-maxage=3600, stale-while-revalidate=86400), so the document a browser
// hydrates can easily have been rendered an hour -- or a day -- earlier. Left
// alone, the client's first render would compute different text from the same
// data and React would throw away the server tree it was supposed to be
// adopting.
//
// So: the loader stamps the instant it rendered at, and every clock read below
// returns THAT instant for the server render and the hydration render -- making
// them byte-identical -- then switches to the live clock once mounted. Post-mount
// behaviour is exactly what it was before this file existed (Date.now() per
// render); only the very first render is pinned.

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

/** The frozen server instant, or null once we are past hydration (= use the live
 *  clock). Absent provider -> null -> live clock, so the shared cards keep
 *  working unchanged on the client-only surfaces that also render them. */
const HomeClockContext = createContext<number | null>(null);

export function HomeClockProvider({
  serverNowMs,
  children,
}: {
  serverNowMs: number;
  children: ReactNode;
}) {
  const [hydrated, setHydrated] = useState(false);
  // Effect, not useSyncExternalStore: an effect fires AFTER React has finished
  // hydrating the tree, so the resulting re-render can never land mid-hydration
  // (the "Suspense boundary received an update before it finished hydrating"
  // fault). Same discipline as the mapMounted gate.
  useEffect(() => setHydrated(true), []);
  return (
    <HomeClockContext.Provider value={hydrated ? null : serverNowMs}>
      {children}
    </HomeClockContext.Provider>
  );
}

/** Epoch ms to render time-relative UI against: the server's instant until the
 *  tree has hydrated, the live clock thereafter. */
export function useHomeNow(): number {
  const frozen = useContext(HomeClockContext);
  return frozen ?? Date.now();
}
