/**
 * get_my_going_v1 reply shapes for the dancer app tests (Going P2). The shapes
 * the prod survey (2026-10-23) and the brief name: empty, upcoming only, past
 * only, a cancelled night, an ended night, an event not live (paused / ended
 * series), many (the RPC caps past at 100). Dates are relative to today, so a
 * shape never goes stale. starts_at_local is a London wall clock, NO zone.
 */
import { addDaysToKey, londonTodayKey } from '@/lib/londonDate';

export type MyGoingNightRow = {
  occurrence_id: string;
  public_event_id: string | null;
  event_title: string | null;
  occurrence_date: string | null;
  starts_at_local: string | null;
  venue_id: string | null;
  venue_name: string | null;
  event_lifecycle: string | null;
  night_lifecycle: string | null;
  is_cancelled: boolean;
};
export type MyGoingReply = { upcoming: MyGoingNightRow[]; past: MyGoingNightRow[] };

export const today = () => londonTodayKey();
export const day = (n: number) => addDaysToKey(today(), n);

export const night = (id: string, title: string, inDays: number, over: Partial<MyGoingNightRow> = {}): MyGoingNightRow => ({
  occurrence_id: `occ-${id}`,
  public_event_id: `ev-${id}`,
  event_title: title,
  occurrence_date: day(inDays),
  starts_at_local: `${day(inDays)}T21:00:00`,
  venue_id: `v-${id}`,
  venue_name: 'Camden Club',
  event_lifecycle: 'live',
  night_lifecycle: 'scheduled',
  is_cancelled: false,
  ...over,
});

export const cancelled = (id: string, title: string, inDays: number) =>
  night(id, title, inDays, { night_lifecycle: 'cancelled', is_cancelled: true });
export const notLive = (id: string, title: string, inDays: number, lifecycle = 'paused') =>
  night(id, title, inDays, { event_lifecycle: lifecycle });

export const GOING_SHAPES: Record<string, () => MyGoingReply> = {
  empty: () => ({ upcoming: [], past: [] }),
  upcomingOnly: () => ({ upcoming: [night('a', 'Alpha', 2), night('b', 'Beta', 9)], past: [] }),
  pastOnly: () => ({ upcoming: [], past: [night('c', 'Gamma', -3), night('d', 'Delta', -20)] }),
  cancelledNight: () => ({ upcoming: [cancelled('x', 'Xray', 3), night('a', 'Alpha', 5)], past: [cancelled('y', 'Yankee', -4)] }),
  endedNight: () => ({ upcoming: [], past: [night('e', 'Echo', -1)] }),
  eventNotLive: () => ({ upcoming: [notLive('p', 'Papa', 4)], past: [notLive('q', 'Quebec', -5, 'ended')] }),
  many: () => ({
    upcoming: Array.from({ length: 40 }, (_, i) => night(`u${i}`, `Up ${i}`, i + 1)),
    past: Array.from({ length: 100 }, (_, i) => night(`p${i}`, `Past ${i}`, -(i + 1))),
  }),
};
