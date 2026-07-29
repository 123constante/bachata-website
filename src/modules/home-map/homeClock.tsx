// Festival Map -- a render clock the server and the hydrating client agree on.
//
// The homepage feed server-renders, and several of its cells are functions of
// "now": the On now / Soon badge (todayLiveStatus), the "Added 2h ago" freshness
// stamp (relativeShort / freshnessHeat) and the New pill (isFreshNew). Each of
// those calls Date.now() during render. The homepage HTML is edge-cached
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
// Post-hydration the clock TICKS. It has to: the rows that read it are
// React.memo'd, so without a subscription an event never gained its "On now"
// badge and "Added 2m ago" stayed at 2m until some unrelated re-render happened
// to refresh it.
//
// SUBSCRIBE SPARINGLY, AND ONLY IN LEAVES. A tick re-renders every subscriber,
// and that update originates INSIDE the subscribing component -- React.memo
// cannot stop it. A subscribing LEAF repaints just itself; a subscribing ROW
// repaints its whole subtree, which on this feed is hundreds of rows a minute
// and makes the rows' memoisation worthless. So rows read useHomeNowStatic()
// (what they use the clock for is coarse -- isRecentlyChanged's 14 DAYS,
// isFreshNew's 30 -- and cannot change on a tick), and only the small
// time-of-day cells subscribe.
//
// ONE tier, deliberately. An earlier revision ran a second, hourly tier so that
// day-old stamps ("3d 4h") could be woken less often than minute-old ones. It
// was measured in defects rather than milliseconds: across four review rounds it
// produced a frozen band, a double subscription, a component rendering from the
// staler of two clocks, and stamps that ran backwards. The saving it chased --
// a few dozen leaf re-renders an hour -- never justified that. If it ever comes
// back, the period has to be threaded through the hook, not inferred at the
// call site.

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

/** The frozen server instant, or null once we are past hydration (= use the live
 *  clock). Absent provider -> null -> live clock, so the shared cards keep
 *  working unchanged on the client-only surfaces that also render them. */
const HomeClockContext = createContext<number | null>(null);

/** How often the clock notifies its readers. The finest thing it feeds is
 *  minute-granular ("2m ago", "3h 12m ago", the 90-minute "Soon" window), so a
 *  minute is the useful resolution -- anything faster just repaints identical
 *  text. One timer for the whole tree. */
const TICK_MS = 60_000;

const subscribers = new Set<(now: number) => void>();
let timerId: ReturnType<typeof setInterval> | null = null;

/** Readers get the FLOOR of the current minute, never a raw Date.now(). A raw
 *  instant is a different number every time, so setLive would always store a
 *  changed value and React could never bail out -- even when the subscriber's
 *  text provably had not moved. Floored, a redundant wake yields an IDENTICAL
 *  number, Object.is matches, and the render is skipped.
 *
 *  It has to be applied to the pre-first-tick fallback below too, not just to
 *  notify(): a row mounting at 10:00:50 that read a raw clock would render
 *  "3m ago", then be handed the 10:00:00 floor five seconds later and repaint to
 *  "2m" -- time visibly running backwards. */
const flooredNow = () => Math.floor(Date.now() / TICK_MS) * TICK_MS;

const isHidden = () =>
  typeof document !== 'undefined' && document.visibilityState === 'hidden';

function notify(): void {
  const now = flooredNow();
  for (const sub of subscribers) sub(now);
}

/** Stop the timer OUTRIGHT while the tab is hidden -- not merely skip the work
 *  inside it. A suppressed callback still wakes the main thread on schedule,
 *  which is most of what backgrounding is supposed to avoid. */
function startTimer(): void {
  if (timerId !== null || isHidden() || subscribers.size === 0) return;
  timerId = setInterval(notify, TICK_MS);
}

function stopTimer(): void {
  if (timerId === null) return;
  clearInterval(timerId);
  timerId = null;
}

/** Catch up on return to a hidden tab, then restart the timer. Unconditional by
 *  design: the floored value makes a catch-up that changed nothing a no-op React
 *  discards, which is cheaper than tracking elapsed time to decide -- and this
 *  fires on every app switch, notification shade and screen unlock on mobile. */
function onVisibility(): void {
  if (isHidden()) {
    stopTimer();
    return;
  }
  notify();
  startTimer();
}

function subscribe(fn: (now: number) => void): () => void {
  const first = subscribers.size === 0;
  subscribers.add(fn);
  if (first) document.addEventListener('visibilitychange', onVisibility);
  startTimer();
  return () => {
    subscribers.delete(fn);
    if (subscribers.size === 0) {
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
 *  The default for ROWS. What they read the clock for is coarse and cannot
 *  change on a tick, and a row that subscribes drags its whole subtree into
 *  every repaint. */
export function useHomeNowStatic(): number {
  const frozen = useContext(HomeClockContext);
  // Floored to the same grid useHomeNow hands out, so that WITHIN ONE RENDER
  // PASS a row and the leaf beneath it read the same number rather than instants
  // up to a tick apart -- the row gating on `isRecentlyChanged` while the leaf
  // formatted its stamp against a different value.
  //
  // It does NOT make the two agree over time, and nothing here could: this hook
  // deliberately does not subscribe, so a row rendered at 10:00:30 keeps the
  // 10:00:00 floor until something else re-renders it, while a subscribed
  // FreshnessClock leaf moves on to 10:01, 10:02 and so on. That divergence is
  // the intended trade -- a row that subscribed would drag its whole subtree
  // into every repaint (see the SUBSCRIBE SPARINGLY note above) -- and it is
  // harmless because what rows read the clock for is coarse.
  //
  // The flooring also gives React an Object.is bailout and stops the value
  // running backwards. It costs nothing.
  return frozen ?? flooredNow();
}

/** Epoch ms, refreshed every minute. For LEAF cells whose text changes that
 *  often -- the freshness stamp, the on-now badge. Mount them conditionally
 *  where you can; see the SUBSCRIBE SPARINGLY note above. */
export function useHomeNow(): number {
  const frozen = useContext(HomeClockContext);
  // null until this component has mounted -- so the first render (server AND
  // hydration) reads the pinned instant below and stays byte-identical.
  const [live, setLive] = useState<number | null>(null);
  useEffect(() => subscribe(setLive), []);
  if (frozen !== null) return frozen;
  // No provider, or mounted between ticks: the same floor the next tick will
  // hand over, so the value never goes backwards.
  return live ?? flooredNow();
}
