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
// them byte-identical -- then switches to the live clock once mounted.
//
// Post-hydration the clock TICKS (see useHomeNow). It has to: the rows that read
// it are React.memo'd, so they only re-render when something they depend on
// actually changes. Before the memo they were refreshed incidentally, by whatever
// parent re-render a hover or selection happened to cause -- which meant an event
// crossing into its "On now" window, or a freshness stamp going from 2m to 3m,
// updated only if the reader happened to move the pointer. A subscription makes
// that correct rather than accidental.

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

/** The frozen server instant, or null once we are past hydration (= use the live
 *  clock). Absent provider -> null -> live clock, so the shared cards keep
 *  working unchanged on the client-only surfaces that also render them. */
const HomeClockContext = createContext<number | null>(null);

/** How often the live clock notifies its readers. The cells that consume it are
 *  minute-granular at their finest ("2m ago", the 90-minute "Soon" window), so
 *  30s keeps every one of them at most half a minute stale while costing one
 *  timer for the whole tree. */
const TICK_MS = 30_000;

// ONE interval for the whole tree, not one per row: the homepage feed can mount
// several hundred clock readers, and a timer each would be both wasteful and a
// few hundred separate wakeups. The interval only exists while something is
// actually subscribed.
const subscribers = new Set<(now: number) => void>();
let timerId: ReturnType<typeof setInterval> | null = null;

function subscribeToTick(fn: (now: number) => void): () => void {
  subscribers.add(fn);
  if (timerId === null) {
    timerId = setInterval(() => {
      const now = Date.now();
      for (const sub of subscribers) sub(now);
    }, TICK_MS);
  }
  return () => {
    subscribers.delete(fn);
    if (subscribers.size === 0 && timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  };
}

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
 *  tree has hydrated, then a live clock that ticks every TICK_MS.
 *
 *  The tick subscription is unconditional (it does not depend on a provider
 *  being present) so that a memoised row on a surface WITHOUT HomeClockProvider
 *  still refreshes rather than freezing at its mount instant. */
export function useHomeNow(): number {
  const frozen = useContext(HomeClockContext);
  // null until this component has mounted -- so the first render (server AND
  // hydration) reads the pinned instant below and stays byte-identical.
  const [live, setLive] = useState<number | null>(null);
  useEffect(() => {
    setLive(Date.now());
    return subscribeToTick(setLive);
  }, []);
  if (frozen !== null) return frozen;
  // No provider and not yet mounted: same live read as before this clock existed.
  return live ?? Date.now();
}
