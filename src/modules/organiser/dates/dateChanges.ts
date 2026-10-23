// Pure rules for ER-C9: what a date can change on its own (time shift, copy from
// another date, own-changes tag, which cancel control it shows). No client import.

import { isEditableRole, newSession, type DraftPerson, type DraftSession } from '@/modules/organiser/shared/programmeModel';
import { sessionName } from '@/modules/organiser/shared/sessionSummary';
import { dayLabel } from '@/modules/organiser/shared/dateList';
import type { DateDetail } from '@/modules/organiser/shared/seriesModel';
import { addDaysToKey } from '@/lib/londonDate';

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

/**
 * ER-FIX2-S6 (F-C9-12, prototype v7 "Night starts" select): the same quarter-hour
 * choices as plain times, the series' usual start marked "(usual)" (never "(now)",
 * which stops meaning anything after one shift). delta 0 is the date's first start.
 */
export function nightStartOptions(first: string, usualStart: string | null): { delta: number; time: string; label: string }[] {
  const usual = usualStart ? usualStart.slice(0, 5) : null;
  return shiftOptions(first).map(({ delta }) => {
    const time = fmt(toMin(first) + delta);
    return { delta, time, label: time === usual ? `${time} (usual)` : time };
  });
}

/** Quarter-hour choices within two hours of the first start; each one is a valid time. */
export function shiftOptions(first: string): { delta: number; label: string }[] {
  const out: { delta: number; label: string }[] = [];
  for (let d = -120; d <= 120; d += 15) out.push({ delta: d, label: d === 0 ? `${first} (now)` : fmt(toMin(first) + d) });
  return out;
}

const TIMED = (r: Pick<DraftSession, 'start' | 'end'>) => TIME_RE.test(r.start) && TIME_RE.test(r.end);
const seriesIdOf = (r: DraftSession) => (typeof r.original?.series_item_id === 'string' ? r.original.series_item_id : null);

/** The target's line-up made to match the source's teachers and DJs; anyone else (MC, performers) stays. */
function copyPeople(target: DraftPerson[], source: DraftPerson[]): DraftPerson[] {
  const want = source.filter((p) => !p.removed && isEditableRole(p.role));
  const kept = target
    .filter((p) => p.origin === 'stored')
    .map((p) => (isEditableRole(p.role) ? { ...p, removed: !want.some((w) => w.id === p.id) } : p));
  const fresh = want
    .filter((w) => !kept.some((p) => p.id === w.id))
    .map((w) => ({ ...w, origin: 'added' as const, removed: false }));
  return [...kept, ...fresh];
}

/**
 * ER-FIX2-S6 (F-C9-1, F-C9-2): copy another date's changes onto this one WITHOUT
 * detaching it from the series. A series session stays the same session and
 * takes the source date's title, times, levels, line-up and on/off as an edit
 * (so the series' own sessions are never removed and re-added as date-only).
 * What the writer would refuse is left as stored: an untimed or untitled source
 * keeps this date's value (the writer never clears a stored time, and an
 * unchanged field is never re-validated), so prod's untimed and untitled
 * sessions copy cleanly. The source's date-only sessions go on as new; this
 * date's own date-only sessions come off. A new session needs a name and both
 * times on the server: an untitled one takes its default name, an untimed one
 * cannot go on and is counted in `skipped` (none on prod, 2026-10-22).
 */
export function copyFromDate(current: DraftSession[], source: DraftSession[]): { rows: DraftSession[]; skipped: number } {
  const bySeries = new Map(source.flatMap((s) => (seriesIdOf(s) ? [[seriesIdOf(s) as string, s] as const] : [])));
  const rows: DraftSession[] = [];
  for (const r of current) {
    if (!r.original) continue; // never on the date
    const sid = seriesIdOf(r);
    if (!sid) { rows.push({ ...r, removed: true }); continue; } // this date's own date-only session
    const s = bySeries.get(sid);
    if (!s) { rows.push(r); continue; }
    rows.push({
      ...r,
      removed: s.removed,
      title: s.title.trim() ? s.title : r.title,
      start: TIMED(s) ? s.start : r.start,
      end: TIMED(s) ? s.end : r.end,
      levels: [...s.levels],
      people: s.removed ? r.people : copyPeople(r.people ?? [], s.people ?? []),
    });
  }
  let skipped = 0;
  for (const s of source) {
    if (s.removed || seriesIdOf(s)) continue;
    if (!TIMED(s)) { skipped += 1; continue; }
    const n = newSession((s.type as never) ?? 'class');
    rows.push({
      ...n,
      type: s.type,
      title: s.title.trim() ? s.title : sessionName(s),
      start: s.start,
      end: s.end,
      levels: [...s.levels],
      people: (s.people ?? []).filter((p) => !p.removed && isEditableRole(p.role)).map((p) => ({ ...p, origin: 'added' as const, removed: false })),
    });
  }
  return { rows, skipped };
}

/**
 * The C9 copy (superseded by copyFromDate, kept for importers): the rows only.
 */
export const copyRowsFrom = (current: DraftSession[], source: DraftSession[]): DraftSession[] => copyFromDate(current, source).rows;

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

/** Why the one-off's "Cancel the event" is off (decision 11: no server command ends an event; parked in er/parked/ER-C9.md). */
export const END_EVENT_PARKED = 'Not available yet';

/**
 * A one-off event has one date, so its cancel control means END THE EVENT
 * (prototype v7, owner decision 11). No server command ends a one-off that
 * never ran (series.end_run needs an evidenced night; AD2 adds none), so on
 * the rebuilt screens it is disabled with the reason, never a silent date
 * cancel. The old screens (`rebuilt` false) keep cancelling the date.
 */
export const cancelWords = (format: string | null, rebuilt = false): { label: string; sub: string; disabled: boolean } =>
  format === 'one_off' && rebuilt
    ? { label: 'Cancel the event', sub: END_EVENT_PARKED, disabled: true }
    : { label: 'Cancel this date', sub: 'Dancers see Cancelled and your reason.', disabled: false };

/** A date with its own venue or sessions (the workspace counts). */
export const hasOwnChanges = (d: { has_override?: boolean; added_sessions_count?: number; session_overrides_count?: number }) =>
  !!d.has_override || (d.added_sessions_count ?? 0) > 0 || (d.session_overrides_count ?? 0) > 0;

/** Only another coming, not-cancelled date (not this one) WITH its own changes can be copied from (F-C9-14, prototype v7). */
export function copySources<T extends { id: string; occurrence_date: string; lifecycle_status: string; has_override?: boolean; added_sessions_count?: number; session_overrides_count?: number }>(dates: T[], thisId: string, today: string): T[] {
  return dates
    .filter((d) => d.id !== thisId && d.occurrence_date >= today && d.lifecycle_status !== 'cancelled' && hasOwnChanges(d))
    .sort((a, b) => a.occurrence_date.localeCompare(b.occurrence_date));
}

/** A day a one-off can move to: after today, a real change. */
export const moveDayProblem = (to: string, current: string | null, today: string): string | null =>
  !to ? 'Pick a day' : to < today ? 'Pick a day from today' : to === current ? 'Pick a different day' : null;

/** F-C9-8: the days a one-off can move to, as a list (never a free date): the next 30 from today, minus its own day and any day the event already holds. */
export function moveDayOptions(today: string, current: string | null, held: readonly string[] = []): { date: string; label: string }[] {
  const taken = new Set([...held, ...(current ? [current] : [])]);
  const out: { date: string; label: string }[] = [];
  for (let i = 0; i < 30; i += 1) {
    const date = addDaysToKey(today, i);
    if (!taken.has(date)) out.push({ date, label: dayLabel(date) });
  }
  return out;
}

/**
 * F-C9-10 (decision 5): a cancel or put-back whose answer was lost and is tried
 * again is refused (old version, or already in that state). When a fresh read
 * shows the date already where the command meant it to be, that is success.
 */
export function commandSettled(cmd: { kind: string; payload?: unknown }, cancelledNow: boolean | null | undefined): boolean {
  if (cmd.kind !== 'occurrence.cancel' || typeof cancelledNow !== 'boolean') return false;
  const want = (cmd.payload as { cancelled?: unknown } | undefined)?.cancelled;
  return typeof want === 'boolean' && want === cancelledNow;
}
