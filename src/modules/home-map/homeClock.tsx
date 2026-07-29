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

/** How often the live clock notifies its MINUTE-tier readers. The finest thing
 *  it feeds is minute-granular ("2m ago", "3h 12m ago", the 90-minute "Soon"
 *  window), so a minute is the useful resolution -- anything faster just repaints
 *  identical text. One timer for the whole tree. */
const TICK_MS = 60_000;

/** Minute ticks per COARSE tick. Stamps past 24h render "3d 4h", which changes
 *  once an hour -- often enough that a static read visibly freezes them (that is
 *  the same bug as the 1-24h band, just an hour slower), and rarely enough that
 *  waking them every minute is pure waste. */
const COARSE_EVERY = 60;

// ONE interval for the whole tree, not one per row: the homepage feed can mount
// several hundred clock readers, and a timer each would be both wasteful and a
// few hundred separate wakeups. The interval only exists while something is
// subscribed AND the tab is visible.
//
// SUBSCRIBE SPARINGLY, AND ONLY IN LEAVES. A tick re-renders every subscriber,
// and that update originates INSIDE the subscribing component -- React.memo
// cannot stop it. A subscribing LEAF repaints just itself; a subscribing ROW
// repaints its whole subtree, which on this feed is hundreds of rows a minute
// and makes the rows' memoisation worthless.
//
// So: rows read useHomeNowStatic() -- what they use the clock for is coarse
// (isRecentlyChanged's 14 DAYS, isFreshNew's 30) and cannot change on a tick.
// The small time-of-day cells (the freshness stamp, the on-now badge) subscribe,
// and are mounted conditionally by their row.
const subscribers = new Set<(now: number) => void>();
const coarseSubscribers = new Set<(now: number) => void>();
let timerId: ReturnType<typeof setInterval> | null = null;
let ticksSinceCoarse = 0;

const isHidden = () =>
  typeof document !== 'undefined' && document.visibilityState === 'hidden';

const anySubscribers = () => subscribers.size > 0 || coarseSubscribers.size > 0;

const COARSE_MS = TICK_MS * COARSE_EVERY;

/** Each tier is handed its own period's floor, never a raw Date.now(). A raw
 *  instant is a different number every time, so setLive always stores a changed
 *  value and React can never bail out -- even when the subscriber's text
 *  provably cannot have moved. Truncated, a redundant wake (a second tick inside
 *  the same minute, or the catch-up after a 2-second app switch) yields an
 *  IDENTICAL number, Object.is matches, and React skips the render entirely.
 *  That is what makes the visibility catch-up below safe to fire unconditionally:
 *  on mobile it runs on every app switch and screen unlock. */
const flooredTo = (now: number, period: number) => Math.floor(now / period) * period;

function notify(coarseToo: boolean): void {
  const now = Date.now();
  const minute = flooredTo(now, TICK_MS);
  for (const sub of subscribers) sub(minute);
  if (coarseToo) {
    const hour = flooredTo(now, COARSE_MS);
    for (const sub of coarseSubscribers) sub(hour);
  }
}

/** Stop the timer OUTRIGHT while the tab is hidden -- not merely skip the work
 *  inside it. A suppressed callback still wakes the main thread on schedule,
 *  which is most of what backgrounding is supposed to avoid. */
function startTimer(): void {
  if (timerId !== null || isHidden() || !anySubscribers()) return;
  timerId = setInterval(() => {
    ticksSinceCoarse += 1;
    const coarseToo = ticksSinceCoarse >= COARSE_EVERY;
    if (coarseToo) ticksSinceCoarse = 0;
    notify(coarseToo);
  }, TICK_MS);
}

function stopTimer(): void {
  if (timerId === null) return;
  clearInterval(timerId);
  timerId = null;
}

/** On return to a hidden tab, catch every tier up at once -- the elapsed time is
 *  unbounded, so the coarse tier may well be due. Unconditional by design: the
 *  floored values above make a catch-up that changed nothing a no-op React
 *  discards, which is cheaper than tracking elapsed time to decide. */
function onVisibility(): void {
  if (isHidden()) {
    stopTimer();
    return;
  }
  ticksSinceCoarse = 0;
  notify(true);
  startTimer();
}

function subscribeTo(set: Set<(now: number) => void>, fn: (now: number) => void): () => void {
  const first = !anySubscribers();
  set.add(fn);
  if (first) document.addEventListener('visibilitychange', onVisibility);
  startTimer();
  return () => {
    set.delete(fn);
    if (!anySubscribers()) {
      stopTimer();
      document.removeEventListener('visibilitychange', onVisibility);
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

/** Epoch ms, WITHOUT subscribing: the server's instant until the tree has
 *  hydrated, then the clock as at this render.
 *
 *  The default for ROWS. What they read the clock for is coarse
 *  (isRecentlyChanged's 14 days, isFreshNew's 30) and cannot change on a tick,
 *  and a row that subscribes drags its whole subtree into every repaint. */
export function useHomeNowStatic(): number {
  const frozen = useContext(HomeClockContext);
  return frozen ?? Date.now();
}

function useSubscribedNow(set: Set<(now: number) => void>): number {
  const frozen = useContext(HomeClockContext);
  // null until this component has mounted -- so the first render (server AND
  // hydration) reads the pinned instant below and stays byte-identical.
  const [live, setLive] = useState<number | null>(null);
  useEffect(() => subscribeTo(set, setLive), [set]);
  if (frozen !== null) return frozen;
  // No provider and not yet mounted: same live read as before this clock existed.
  return live ?? Date.now();
}

/** Epoch ms, refreshed every minute. For LEAF cells whose text changes that
 *  often -- "2m ago", "3h 12m ago", the 90-minute "Soon" window. Mount them
 *  conditionally; see the SUBSCRIBE SPARINGLY note above. */
export function useHomeNow(): number {
  return useSubscribedNow(subscribers);
}

/** Epoch ms, refreshed hourly. For leaf cells that DO still change, but only on
 *  the hour -- the "3d 4h" freshness stamps past a day old. They must not be
 *  read statically (they would freeze) nor per-minute (59 of every 60 repaints
 *  would be identical). */
export function useHomeNowHourly(): number {
  return useSubscribedNow(coarseSubscribers);
}
