import { useEffect, useState } from 'react';
import { londonTodayKey } from '@/lib/londonDate';

/**
 * "Today" for the ticket screens, from the SERVER clock, so a phone with a wrong date or
 * timezone cannot push tonight's ticket into Past or hide its QR. The server time is the `Date`
 * header of a same-origin HEAD of the static /robots.txt (no redirect or middleware on it, 3 s cap; cross-origin Supabase does not expose `Date` to the browser).
 * Read once per page load and kept; the device clock is only the fallback when the header is
 * missing, unparseable, or the request fails.
 */

/** Pure: the London day key for a `Date` header value, or null when it is not a usable date. */
export function todayKeyFromDateHeader(header: string | null | undefined): string | null {
  if (!header) return null;
  const ms = Date.parse(header);
  return Number.isFinite(ms) ? londonTodayKey(new Date(ms)) : null;
}

let cached: Promise<string> | null = null;

/** The server's London today key; resolves to the device's key if the server clock is unavailable. Once per load. */
export function serverTodayKey(): Promise<string> {
  if (!cached) {
    cached = (async () => {
      try {
        const res = await fetch('/robots.txt', { method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(3000) });
        return todayKeyFromDateHeader(res.headers.get('date')) ?? londonTodayKey();
      } catch {
        return londonTodayKey();
      }
    })();
  }
  return cached;
}

/** Test hook: forget the per-load cache. */
export function resetServerTodayForTests(): void {
  cached = null;
}

/** The device key first (no layout wait), then the server's once it arrives. */
export function useServerToday(): string {
  const [today, setToday] = useState(() => londonTodayKey());
  useEffect(() => {
    let live = true;
    void serverTodayKey().then((k) => { if (live) setToday(k); });
    return () => { live = false; };
  }, []);
  return today;
}
