// =============================================================================
// raffleCountdown -- shared time helpers for the raffle surfaces (festival
// "Lucky Reels" band + bento tile). Two rules this module enforces:
//
//   1. The countdown DURATION is timezone-invariant: a diff of two absolute
//      instants, identical for every viewer.
//   2. The close CLOCK and draw DATE are shown AS-STORED in the event
//      timezone, never browser-tz-converted. The project stores naive
//      "local-as-UTC" timestamps, so the +00 offset IS the wall clock and we
//      read the UTC fields (or the server wall-clock string) on purpose.
// =============================================================================

import { useEffect, useState } from 'react';

/** Absolute epoch ms for a cutoff ISO, or null if unparseable. */
export function parseCutoffMs(cutoffAt: string | null | undefined): number | null {
  if (!cutoffAt) return null;
  const t = new Date(cutoffAt).getTime();
  return Number.isFinite(t) ? t : null;
}

export interface CountdownParts {
  days: number;
  hours: number;
  mins: number;
  secs: number;
  totalMin: number;
  msUntil: number;
}

/** Break a remaining-ms duration into d/h/m/s. Timezone-invariant. */
export function countdownParts(msUntil: number): CountdownParts {
  const ms = Math.max(0, msUntil);
  const totalSec = Math.floor(ms / 1000);
  const totalMin = Math.floor(totalSec / 60);
  return {
    days: Math.floor(totalMin / 1440),
    hours: Math.floor((totalMin % 1440) / 60),
    mins: totalMin % 60,
    secs: totalSec % 60,
    totalMin,
    msUntil: ms,
  };
}

const pad2 = (n: number) => (n < 10 ? '0' : '') + n;
const EM_DASH = String.fromCharCode(0x2014);

/** Close time as the event-timezone wall clock ("HH:MM"), never browser-tz-
 *  shifted. Prefers the server wall-clock string (cutoff_time); falls back to
 *  the UTC fields of cutoff_at, since +00 IS the wall clock by convention. */
export function formatCloseClock(
  cutoffTime: string | null | undefined,
  cutoffAt: string | null | undefined,
): string {
  if (cutoffTime && /^\d{1,2}:\d{2}/.test(cutoffTime)) return cutoffTime.slice(0, 5);
  const ms = parseCutoffMs(cutoffAt);
  if (ms !== null) {
    const d = new Date(ms);
    return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
  }
  return EM_DASH;
}

/** Draw/close DATE as stored (event timezone). Reads the calendar date from
 *  the raw value (date-only or full ISO) anchored at UTC noon, so it never
 *  slips a day for viewers west of UTC. */
export function formatDrawDate(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  if (!Number.isFinite(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
    }).format(d);
  } catch {
    return '';
  }
}

export interface RaffleDayLabel {
  /** "Tonight" | "Tomorrow" | "Friday 13 Jun" (full weekday, house style). */
  label: string;
  tone: 'tonight' | 'tomorrow' | 'day';
}

/** Day label for a raffle card, from an event start ISO.
 *
 *  The stored timestamp is wall-clock-as-UTC, so the event's calendar date is
 *  simply the first 10 chars -- no conversion. "Today/tomorrow" must come from
 *  the SAME frame the wall clocks are written in (Europe/London), not the
 *  browser zone and not raw UTC: at 00:30 BST London it is already "tomorrow"
 *  while UTC still says 23:30 yesterday. Comparing London-today vs stored-date
 *  keeps the Tonight badge correct across that midnight edge.
 *
 *  `nowMs` is injectable for tests; defaults to Date.now(). */
export function raffleDayLabel(
  startIso: string | null | undefined,
  nowMs?: number,
): RaffleDayLabel | null {
  if (!startIso) return null;
  const eventYmd = startIso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventYmd)) return null;

  let todayYmd: string;
  try {
    // en-CA formats as YYYY-MM-DD directly.
    todayYmd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' })
      .format(nowMs != null ? new Date(nowMs) : new Date());
  } catch {
    todayYmd = new Date(nowMs != null ? nowMs : Date.now()).toISOString().slice(0, 10);
  }
  if (eventYmd === todayYmd) return { label: 'Tonight', tone: 'tonight' };

  // Calendar-day +1 in pure date space (noon anchor avoids DST/day-slip).
  const t = new Date(`${todayYmd}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + 1);
  if (eventYmd === t.toISOString().slice(0, 10)) {
    return { label: 'Tomorrow', tone: 'tomorrow' };
  }

  const d = new Date(`${eventYmd}T12:00:00Z`);
  if (!Number.isFinite(d.getTime())) return null;
  try {
    const fmt = (opt: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...opt }).format(d);
    return {
      label: `${fmt({ weekday: 'long' })} ${fmt({ day: 'numeric' })} ${fmt({ month: 'short' })}`,
      tone: 'day',
    };
  } catch {
    return null;
  }
}

/** Reactive `now` (epoch ms) that ticks while the raffle is open. Adaptive:
 *  1s when under 10 minutes to close, 30s otherwise; stops when closed/unset. */
export function useRaffleNow(cutoffMs: number | null, closed: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (closed || cutoffMs === null) return;
    const remaining = cutoffMs - now;
    if (remaining <= 0) return;
    const interval = remaining <= 10 * 60 * 1000 ? 1_000 : 30_000;
    const id = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(id);
  }, [cutoffMs, closed, now]);
  return now;
}
