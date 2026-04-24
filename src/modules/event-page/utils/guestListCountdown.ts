/**
 * Resolves the stored guest-list cutoff (stored as "HH:MM" in the
 * event's timezone inside meta_data.guestlist.cutoff_time) into a
 * concrete UTC instant, then formats a countdown string for the
 * inline block. Pure and unit-testable — no React, no DOM.
 *
 * Display tone maps to colour in the component:
 *   muted   — > 24h remaining
 *   normal  — 1h–24h remaining
 *   warning — 10m–1h remaining
 *   urgent  — < 10m remaining (CSS adds a subtle opacity pulse)
 *   (null return means cutoff has already passed; caller hides the row
 *    and lets the server-derived closed-state take over)
 */

export type CountdownTone = 'muted' | 'normal' | 'warning' | 'urgent';
export type CountdownResult = { text: string; tone: CountdownTone } | null;

/**
 * Resolve "HH:MM" in the event's timezone against the event's start
 * calendar date to a concrete UTC Date. Returns null on malformed input
 * or when any required field is missing.
 *
 * Uses Intl.DateTimeFormat to derive the IANA-tz offset for the given
 * wall-clock date, the standard workaround for "wall-clock → UTC in
 * arbitrary timezone" without a library. Handles DST implicitly because
 * the offset is computed from the same wall clock we're converting.
 */
export function resolveCutoffAt(
  cutoffTime: string | null | undefined,
  eventStartIso: string | null | undefined,
  eventTimezone: string | null | undefined,
): Date | null {
  if (!cutoffTime || !eventStartIso || !eventTimezone) return null;

  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(cutoffTime.trim());
  if (!timeMatch) return null;
  const h = Number(timeMatch[1]);
  const mi = Number(timeMatch[2]);
  if (h > 23 || mi > 59) return null;

  const eventStart = new Date(eventStartIso);
  if (Number.isNaN(eventStart.getTime())) return null;

  // Event-local calendar date, formatted as YYYY-MM-DD. en-CA locale
  // produces that format reliably.
  let eventLocalDate: string;
  try {
    eventLocalDate = eventStart.toLocaleDateString('en-CA', {
      timeZone: eventTimezone,
    });
  } catch {
    // Invalid timezone string
    return null;
  }
  const [y, mo, d] = eventLocalDate.split('-').map(Number);
  if (!y || !mo || !d) return null;

  // Start from a Date that has the wall-clock fields we want, pretending
  // it's UTC. Then ask Intl what THAT instant looks like in the target
  // timezone; the difference gives us the offset to apply.
  const guess = new Date(Date.UTC(y, mo - 1, d, h, mi));

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: eventTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(guess);

  const get = (type: string) => {
    const part = parts.find((p) => p.type === type);
    return part ? Number(part.value) : NaN;
  };
  const pY = get('year');
  const pMo = get('month');
  const pD = get('day');
  // Some Intl implementations return 24 for midnight; normalise.
  let pH = get('hour');
  if (pH === 24) pH = 0;
  const pMi = get('minute');
  const pS = get('second');

  if ([pY, pMo, pD, pH, pMi, pS].some((n) => Number.isNaN(n))) return null;

  const asLocal = Date.UTC(pY, pMo - 1, pD, pH, pMi, pS);
  const offset = asLocal - guess.getTime();
  return new Date(guess.getTime() - offset);
}

/**
 * Format a countdown string from the resolved cutoff instant and the
 * current moment. Dates/times are displayed in the viewer's browser
 * local timezone (not the event's) — a user in New York reading a
 * London event sees "Sat 1pm" (= 6pm London).
 */
export function formatCountdown(
  cutoffAt: Date,
  now: Date,
): CountdownResult {
  const ms = cutoffAt.getTime() - now.getTime();
  if (ms <= 0) return null;

  const totalMins = Math.floor(ms / 60_000);
  const totalHours = Math.floor(totalMins / 60);
  const days = Math.floor(totalHours / 24);

  if (totalHours >= 24) {
    const weekday = cutoffAt.toLocaleDateString('en-GB', { weekday: 'short' });
    const timeStr = formatHourCompact(cutoffAt);
    const remHours = totalHours - days * 24;
    return {
      text: `⏱ Closes ${weekday} ${timeStr} · ${days}d ${remHours}h left`,
      tone: 'muted',
    };
  }

  if (totalHours >= 1) {
    const remMins = totalMins - totalHours * 60;
    return {
      text: `⏱ Closes today · ${totalHours}h ${remMins}m left`,
      tone: 'normal',
    };
  }

  if (totalMins >= 10) {
    return {
      text: `⏱ Closing in ${totalMins} minutes`,
      tone: 'warning',
    };
  }

  return { text: '⏱ Closing soon', tone: 'urgent' };
}

/**
 * Format a Date's hour part as "6pm", "12am", "11pm". Drops the
 * minutes unless they are non-zero (e.g. "6:30pm"). British style: no
 * space between the number and am/pm.
 */
function formatHourCompact(d: Date): string {
  const h24 = d.getHours();
  const m = d.getMinutes();
  const suffix = h24 >= 12 ? 'pm' : 'am';
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  if (m === 0) return `${h12}${suffix}`;
  return `${h12}:${String(m).padStart(2, '0')}${suffix}`;
}
