import { londonDaysBetweenKeys, londonMinutesOfDay } from '@/lib/londonDate';
import type { MyTicket } from '@/modules/tickets/myTicketsModel';
import { nightsPath, shortDate } from '../screens/nights/nightsDates';
import type { Night } from '../screens/nights/nightsModel';
import { ticketsForNight } from '../screens/nights/nightsTicket';

/**
 * Dancer bell alerts v1 (brief #1938): the pure model. No React, no storage, no clock of its own
 * (every function takes `now`). Two alert kinds: a ticket is ready (from 09:00 London on the day
 * of a night the person holds a ticket for, until that night ends) and rate last night (the same
 * candidate as the Home RateNudge; the 7-day and already-rated rules live in nudgeCandidates and
 * useSeriesLevelRating, so they are NOT copied here).
 */
export const BELL_MAX_ALERTS = 5;
export const BELL_TICKET_FROM_MINUTES = 9 * 60;
export const BELL_EMPTY_LINE = 'No alerts right now';
export const BELL_ERROR_LINE = 'Couldn’t load alerts. Try again';

export type BellAlert =
  | { id: string; kind: 'ticket'; title: string; line: string; occurrenceId: string; nightName: string; nightDate: string | null }
  | { id: string; kind: 'rate'; title: string; line: string; to: string };

/**
 * The same title RateNudge's nudgeTitle gives ("Rate last night", else "Rate Sat 10 Oct"). Restated
 * here, not imported: RateNudge.tsx lives in the dancer-app chunk, and a lazy chunk importing it makes
 * src/modules/dancer-app/dancer-app.tsx a non-entry chunk (bundle-budget). The test pins the two equal.
 */
export const bellRateTitle = (dateKey: string | null, todayKey: string): string =>
  dateKey && londonDaysBetweenKeys(dateKey, todayKey) === 1 ? 'Rate last night' : `Rate ${shortDate(dateKey)}`;

export const ticketAlertId = (orderId: string, dateKey: string): string => `ticket:${orderId}:${dateKey}`;
export const rateAlertId = (seriesId: string, dateKey: string): string => `rate:${seriesId}:${dateKey}`;

/**
 * Ticket alerts. `upcoming` is the RPC's own "not ended yet" list, so a night drops the moment it
 * ends with no clock here. Only a night dated today (or still running from yesterday), and only
 * from 09:00 London. A night with no QR-showing ticket gives nothing (ticketsForNight).
 */
export const ticketAlerts = (upcoming: readonly Night[], tickets: readonly MyTicket[], todayKey: string, now: Date): BellAlert[] => {
  const out: BellAlert[] = [];
  for (const n of upcoming) {
    if (n.date === null || n.date > todayKey) continue;
    if (n.date === todayKey && londonMinutesOfDay(now) < BELL_TICKET_FROM_MINUTES) continue;
    const held = ticketsForNight(n, [...tickets], now);
    if (held.length === 0) continue;
    const time = held[0].startTime;
    out.push({
      id: ticketAlertId(held[0].orderId, n.date),
      kind: 'ticket',
      title: 'Your ticket is ready',
      line: `${n.name} · tonight${time ? ` ${time.slice(0, 5)}` : ''}`,
      occurrenceId: n.occurrenceId,
      nightName: n.name,
      nightDate: n.date,
    });
  }
  return out;
};

/** The rate alert for the night the RateNudge walk settled on (null = nothing to rate). */
export const rateAlert = (night: Night | null, todayKey: string): BellAlert | null =>
  night && night.seriesId && night.date
    ? {
        id: rateAlertId(night.seriesId, night.date),
        kind: 'rate',
        title: bellRateTitle(night.date, todayKey),
        line: `${night.name} · how was the level?`,
        to: nightsPath(night.seriesId),
      }
    : null;

/** Ticket alerts first, then rate; at most five. */
export const bellAlerts = (tickets: readonly BellAlert[], rate: BellAlert | null): BellAlert[] =>
  [...tickets, ...(rate ? [rate] : [])].slice(0, BELL_MAX_ALERTS);

export const unreadCount = (alerts: readonly BellAlert[], read: ReadonlySet<string>): number =>
  alerts.filter((a) => !read.has(a.id)).length;

/** Badge text: nothing at zero, "9+" above nine. */
export const badgeText = (unread: number): string | null => (unread <= 0 ? null : unread > 9 ? '9+' : String(unread));

export const bellLabel = (unread: number): string => (unread > 0 ? `Alerts, ${unread} unread` : 'Alerts');

export const readKey = (userId: string): string => `dancer_bell_read:${userId}`;

/** Read marks for a person; storage blocked or a bad value = nothing read (alerts show unread again). */
export const loadRead = (userId: string): Set<string> => {
  try {
    const raw = window.localStorage.getItem(readKey(userId));
    const list: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
};

export const saveRead = (userId: string, read: ReadonlySet<string>): void => {
  try {
    window.localStorage.setItem(readKey(userId), JSON.stringify([...read]));
  } catch {
    /* storage blocked: the alert simply shows unread again next time */
  }
};

/** Drop read ids that are no longer shown; returns the same set when nothing changed. */
export const pruneRead = (read: ReadonlySet<string>, shown: readonly BellAlert[]): ReadonlySet<string> => {
  const keep = new Set(shown.map((a) => a.id));
  const next = new Set([...read].filter((id) => keep.has(id)));
  return next.size === read.size ? read : next;
};
