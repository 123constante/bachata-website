import { useEffect, useState } from 'react';
import { londonDateKey } from '@/lib/londonDate';

/**
 * Reactive "today" on the London calendar, as a YYYY-MM-DD key.
 *
 * A long-lived tab (phone left open overnight, laptop resumed next morning)
 * keeps rendering with the "today" captured at mount unless something
 * re-anchors it. This hook re-checks the London date key on tab
 * visibility/focus and every minute, and only triggers a re-render when the
 * key actually flips — so day-anchored query keys and "Tonight/Tomorrow"
 * labels roll over with the calendar instead of freezing at mount time.
 *
 * `serverKey` pins the FIRST render (server + hydration) to the day the server
 * rendered on. The homepage is edge-cached for up to an hour and served stale
 * for a day, so a document generated before London midnight can easily be
 * hydrated after it: without the pin, the client's first render would derive a
 * different day from the same HTML (different "Today" group, different query
 * key) and React would discard the server tree. The check below runs
 * immediately on mount, so a genuinely stale key is corrected within a tick of
 * hydration rather than waiting out the 60s interval.
 */
export const useLondonToday = (serverKey?: string): string => {
  const [key, setKey] = useState(() => serverKey ?? londonDateKey(new Date()));

  useEffect(() => {
    const check = () =>
      setKey((prev) => {
        const next = londonDateKey(new Date());
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
  }, []);

  return key;
};
