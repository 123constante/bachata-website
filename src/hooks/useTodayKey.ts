import { useEffect, useState } from 'react';
import { dateKeyInTz } from '@/lib/londonDate';

/**
 * Reactive "today" on an arbitrary IANA-timezone calendar, as a YYYY-MM-DD key.
 *
 * A long-lived tab (phone left open overnight, laptop resumed next morning)
 * keeps rendering with the "today" captured at mount unless something
 * re-anchors it. This hook re-checks the date key on tab visibility/focus and
 * every minute, and only triggers a re-render when the key actually flips --
 * so day-anchored query keys, "Today" badges and days-away labels roll over
 * with the calendar instead of freezing at mount time. Because the flip is
 * computed in the GIVEN timezone, a Madrid or Tunis event page rolls at its
 * own midnight, not London's.
 *
 * `serverKey` pins the FIRST render (server + hydration) to the day the server
 * rendered on. An edge-cached document can be generated before midnight and
 * hydrated after it: without the pin, the client's first render would derive a
 * different day from the same HTML and React would discard the server tree.
 * The check below runs immediately on mount, so a genuinely stale key is
 * corrected within a tick of hydration rather than waiting out the 60s
 * interval.
 *
 * An invalid/missing timezone never throws -- dateKeyInTz falls back to the
 * London calendar.
 */
export const useTodayKey = (timeZone: string, serverKey?: string): string => {
  const [state, setState] = useState(() => ({
    tz: timeZone,
    key: serverKey ?? dateKeyInTz(new Date(), timeZone),
  }));

  // A timezone change (e.g. a page's data resolving from a London default to
  // the event's own zone) corrects during render, before paint -- React's
  // adjust-state-on-prop-change pattern. Leaving it to the effect below would
  // paint one frame with the previous calendar's key.
  if (state.tz !== timeZone) {
    setState({ tz: timeZone, key: dateKeyInTz(new Date(), timeZone) });
  }

  useEffect(() => {
    const check = () =>
      setState((prev) => {
        const next = dateKeyInTz(new Date(), timeZone);
        return prev.tz === timeZone && prev.key === next ? prev : { tz: timeZone, key: next };
      });
    check();
    const timer = setInterval(check, 60_000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', check);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', check);
    };
  }, [timeZone]);

  return state.key;
};
