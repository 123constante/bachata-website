import { fullDate } from '../../shared/dateWords';
import { isListedSeries, localAsZTime, type HomeSeriesFull } from '../../shared/homeModel';
import type { OrganiserHome } from '../../shared/selfServeApi';
import { L, dayWord, kindOf, kindWordStored, liveDates, startPhrase, statusOf } from '../model';
import type { IsoDate, P3Date, P3Event, P3Kind, P3Status, SessionKind } from '../model';

/**
 * organiser_home_v1 -> what the P3 Home and Events screens show. Pure.
 *
 * home_v1 carries no programme (no sessions, no rule mode): it gives the stored
 * default start, the first three SCHEDULED dates and the server's upcoming count.
 * So each event reaches the W0 model as ONE time-only session at the stored start,
 * moved on a date whose materialised start differs; startPhrase then reads the
 * next date's time from it. Monthly and dates-I-pick read as weekly here (no rule
 * mode in home_v1); the kind chip is the stored category word, which is right.
 */

/** home_v1 series rows as the RPC really sends them (venue names are in the payload, not the shared type). */
export type HomeSeriesRow = Omit<HomeSeriesFull, 'next_dates'> & {
  default_venue_name?: string | null;
  next_dates: Array<HomeSeriesFull['next_dates'][number] & { venue_name?: string | null }>;
};

export interface P3Row {
  id: string;
  name: string;
  lifecycle: string;
  kind: P3Kind;
  /** The kind chip (eventCategory's word, read-only). */
  kindWord: string;
  status: P3Status;
  event: P3Event;
  next: P3Date | null;
  /** startPhrase for the next date ('8pm', 'No time yet'). */
  nextTime: string;
  /** The next date's start 'HH:MM', or null when it has no time. */
  nextStart: string | null;
  place: string | null;
  cover: string | null;
  /** The server's count of scheduled dates from today (a cancelled date or a break is not one). */
  upcoming: number;
  /** The row's second line: when, and where. */
  sub: string;
}

const STORED_SESSION = 'stored-start';

function sessionKindOf(category: string | null): SessionKind {
  return category === 'class' || category === 'workshop' || category === 'masterclass' ? category : 'party';
}

function eventOf(s: HomeSeriesRow, kind: P3Kind): P3Event {
  const base = s.default_local_start_time?.slice(0, 5) || null;
  return {
    kind,
    sessions: [{ id: STORED_SESSION, kind: sessionKindOf(s.category), title: null, start: base, end: null, people: [] }],
    dates: s.next_dates.map((d) => {
      const t = localAsZTime(d.materialised_start_utc);
      return {
        date: d.occurrence_date,
        status: d.lifecycle_status === 'cancelled' ? 'cancelled' : 'scheduled',
        ...(t && t !== base ? { changes: { [STORED_SESSION]: { start: t } } } : {}),
      };
    }),
  };
}

function countWord(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function whenLine(r: Omit<P3Row, 'sub'>, today: IsoDate): string {
  if (r.status.key === 'finished') return r.status.label;
  if (!r.next) return r.lifecycle === 'draft' ? L.noDatesYet : r.status.label;
  const day = dayWord(r.next.date, today, r.nextStart);
  const at = `${day}, ${r.nextTime}`;
  if (r.kind === 'course') return `${at} \u00b7 ${countWord(r.upcoming, 'class left', 'classes left')}`;
  if (r.kind === 'oneoff' || r.kind === 'festival') return at;
  // "Next Friday 30 October", but never "Next Tonight"
  const lead = day === fullDate(r.next.date, today) ? `Next ${at}` : at;
  return `${lead} \u00b7 ${countWord(r.upcoming, 'date', 'dates')} coming up`;
}

export function rowOf(s: HomeSeriesRow, today: IsoDate): P3Row {
  const kind = kindOf(s.format, null);
  const event = eventOf(s, kind);
  const next = liveDates(event, today)[0] ?? null;
  const nextVenue = next ? s.next_dates.find((d) => d.occurrence_date === next.date)?.venue_name : null;
  const upcoming = Math.max(0, Number(s.upcoming_count) || 0);
  const r = {
    id: s.id,
    name: s.name?.trim() || L.noName,
    lifecycle: s.lifecycle_status,
    kind,
    kindWord: kindWordStored(s.format, s.category),
    status: statusOf(s.lifecycle_status, s.format, kind, upcoming),
    event,
    next,
    nextTime: startPhrase(event.sessions, { event, today }),
    nextStart: next ? (next.changes?.[STORED_SESSION]?.start ?? event.sessions[0].start) : null,
    place: nextVenue || s.default_venue_name || null,
    cover: s.default_cover_image_url,
    upcoming,
  };
  const when = whenLine(r, today);
  return { ...r, sub: r.place ? `${when} \u00b7 ${r.place}` : when };
}

/** Sort key: next date then its start; nothing coming up goes last. */
function nextKey(r: P3Row): string {
  if (!r.next) return 'z';
  return `${r.next.date}${r.nextStart ?? '99:99'}`;
}

export function byNext(a: P3Row, b: P3Row): number {
  const ka = nextKey(a);
  const kb = nextKey(b);
  return ka < kb ? -1 : ka > kb ? 1 : a.name.localeCompare(b.name);
}

/** Every listed series across the organisers the person runs, once each, soonest first. */
export function rowsOf(home: OrganiserHome): P3Row[] {
  const seen = new Set<string>();
  const out: P3Row[] = [];
  for (const o of home.organisers) {
    for (const s of o.series as HomeSeriesRow[]) {
      if (!isListedSeries(s) || seen.has(s.id)) continue;
      seen.add(s.id);
      out.push(rowOf(s, home.today));
    }
  }
  return out.sort(byNext);
}

/** C3 Next up: the soonest live date of a live (not hidden) event. */
export function nextUpOf(rows: readonly P3Row[]): P3Row | null {
  return rows.find((r) => r.lifecycle === 'live' && r.next) ?? null;
}

export interface NextUp {
  row: P3Row;
  /** 'Next up \u00b7 Tonight, 8pm' */
  when: string;
  /** The date has its own changes (place, details or sessions differ from usual). */
  different: boolean;
}

export function nextUpView(rows: readonly P3Row[], home: OrganiserHome): NextUp | null {
  const row = nextUpOf(rows);
  if (!row || !row.next) return null;
  const src = home.organisers.flatMap((o) => o.series).find((s) => s.id === row.id);
  const d = src?.next_dates.find((x) => x.occurrence_date === row.next!.date);
  return { row, when: `Next up \u00b7 ${dayWord(row.next.date, home.today, row.nextStart)}, ${row.nextTime}`, different: !!d?.has_own_changes };
}

export interface NeedsItem {
  key: 'photo' | 'dates' | 'draft';
  title: string;
  detail: string;
}

/** A row's name for a sentence; an unnamed event never reads "No name yet has ...". */
function named(r: P3Row, fallback: string): string {
  return r.name === L.noName ? fallback : r.name;
}

function names(rows: readonly P3Row[]): string {
  const shown = rows.slice(0, 3).map((r) => r.name).join(', ');
  return rows.length > 3 ? `${shown} and ${rows.length - 3} more` : shown;
}

/**
 * C3 Needs you, from what home_v1 carries: no photo, live with nothing coming up, still a draft.
 * C3's "how to pay", "no teachers" and "no names" need the programme and prices (not in home_v1).
 */
export function needsOf(rows: readonly P3Row[]): NeedsItem[] {
  const out: NeedsItem[] = [];
  // a finished event is history: no photo nag for a past party
  const noPhoto = rows.filter((r) => !r.cover && !r.status.past);
  if (noPhoto.length) {
    out.push({
      key: 'photo',
      title: noPhoto.length === 1 ? `${named(noPhoto[0], '1 event')} has no photo yet` : `${noPhoto.length} events have no photo`,
      detail: `It\u2019s the first thing dancers see.${noPhoto.length > 1 ? ` ${names(noPhoto)}.` : ''}`,
    });
  }
  // only a repeating series can take more dates (seriesLife's Nothing coming up)
  const noDates = rows.filter((r) => r.status.key === 'warn');
  if (noDates.length) {
    out.push({
      key: 'dates',
      title: noDates.length === 1 ? '1 event is live but has no dates coming up' : `${noDates.length} events are live but have no dates coming up`,
      detail: `${names(noDates)} \u00b7 add dates or end ${noDates.length === 1 ? 'it' : 'them'}.`,
    });
  }
  const drafts = rows.filter((r) => r.lifecycle === 'draft');
  if (drafts.length) {
    out.push({
      key: 'draft',
      title: drafts.length === 1 ? `${named(drafts[0], '1 event')} is still a draft` : `${drafts.length} events are still drafts`,
      detail: 'Only you see a draft. Add a date and a place, then put it live.',
    });
  }
  return out;
}

/**
 * Events grouped by status only, never by kind (the kind is a chip per row, C3 #71):
 * current, hidden, then past (seriesLife's section: finished, nothing coming up, ended).
 */
export function groupsOf(rows: readonly P3Row[]): { on: P3Row[]; hidden: P3Row[]; finished: P3Row[] } {
  const g = { on: [] as P3Row[], hidden: [] as P3Row[], finished: [] as P3Row[] };
  for (const r of rows) (r.status.key === 'hidden' ? g.hidden : r.status.past ? g.finished : g.on).push(r);
  return g;
}
