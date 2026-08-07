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
  const [key, setKey] = useState(() => serverKey ?? dateKeyInTz(new Date(), timeZone));

  useEffect(() => {
    const check = () =>
      setKey((prev) => {
        const next = dateKeyInTz(new Date(), timeZone);
        return next === prev ? prev : next;
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

  return key;
};
