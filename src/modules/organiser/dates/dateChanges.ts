// Pure rules for ER-C9: what a date can change on its own (time shift, copy from
// another date, own-changes tag, which cancel control it shows). No client import.

import { isEditableRole, newSession, type DraftPerson, type DraftSession } from '@/modules/organiser/shared/programmeModel';
import type { DateDetail } from '@/modules/organiser/shared/seriesModel';

const TIME_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const fmt = (m: number) => {
  const x = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
};

/** Move every timed session still on the date by the same minutes (an untimed one stays untimed). */
export function shiftRows(rows: DraftSession[], delta: number): DraftSession[] {
  if (!delta) return rows;
  return rows.map((r) => {
    if (r.removed || !TIME_RE.test(r.start)) return r;
    return { ...r, start: fmt(toMin(r.start) + delta), end: TIME_RE.test(r.end) ? fmt(toMin(r.end) + delta) : r.end };
  });
}

/** The earliest start on the date (the "Night starts" time), by the day-rollover order. */
export function firstStart(rows: DraftSession[]): string | null {
  const key = (t: string) => toMin(t) + (toMin(t) < 8 * 60 ? 1440 : 0);
  const starts = rows.filter((r) => !r.removed && TIME_RE.test(r.start)).map((r) => r.start);
  return starts.length ? starts.reduce((a, b) => (key(b) < key(a) ? b : a)) : null;
}

/** Quarter-hour choices within two hours of the first start; each one is a valid time. */
export function shiftOptions(first: string): { delta: number; label: string }[] {
  const out: { delta: number; label: string }[] = [];
  for (let d = -120; d <= 120; d += 15) out.push({ delta: d, label: d === 0 ? `${first} (now)` : fmt(toMin(first) + d) });
  return out;
}

/**
 * Copy another date's changes: this date's saved sessions come off, the other
 * date's become NEW sessions here (people carried over as added when saved).
 * An unsaved new session of this date is dropped (it was never on the date).
 */
export function copyRowsFrom(current: DraftSession[], source: DraftSession[]): DraftSession[] {
  const kept = current.filter((r) => r.original).map((r) => ({ ...r, removed: true }));
  const copies = source
    .filter((r) => !r.removed)
    .map((s) => {
      const n = newSession((s.type as never) ?? 'class');
      const people: DraftPerson[] = (s.people ?? [])
        .filter((p) => !p.removed && isEditableRole(p.role))
        .map((p) => ({ ...p, origin: 'added' as const, removed: false }));
      return { ...n, type: s.type, title: s.title, start: s.start, end: s.end, levels: [...s.levels], people };
    });
  return [...kept, ...copies];
}

/** "Own changes" when the date has its own venue or sessions; "Own times" when only its time differs. */
export function ownTag(
  detail: Pick<DateDetail, 'venueOverride' | 'start'> | null,
  rows: DraftSession[],
  usualStart: string | null,
): 'Own changes' | 'Own times' | null {
  if (!detail) return null;
  const ownSession = rows.some((r) => r.original && typeof r.original.added_session_id === 'string');
  if (detail.venueOverride || ownSession) return 'Own changes';
  const usual = usualStart ? usualStart.slice(0, 5) : null;
  return usual && detail.start && detail.start !== usual ? 'Own times' : null;
}

/** A one-off event has one date, so its cancel control cancels the event. */
export const cancelWords = (format: string | null) =>
  format === 'one_off'
    ? { label: 'Cancel the event', sub: 'It comes off the calendar.' }
    : { label: 'Cancel this date', sub: 'Dancers see Cancelled and your reason.' };

/** Only another coming, not-cancelled date (not this one) can be copied from. */
export function copySources<T extends { id: string; occurrence_date: string; lifecycle_status: string }>(dates: T[], thisId: string, today: string): T[] {
  return dates
    .filter((d) => d.id !== thisId && d.occurrence_date >= today && d.lifecycle_status !== 'cancelled')
    .sort((a, b) => a.occurrence_date.localeCompare(b.occurrence_date));
}

/** A day a one-off can move to: after today, a real change. */
export const moveDayProblem = (to: string, current: string | null, today: string): string | null =>
  !to ? 'Pick a day' : to < today ? 'Pick a day from today' : to === current ? 'Pick a different day' : null;
