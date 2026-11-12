import { dayWord, L } from '../model';
import type { IsoDate } from '../model';
import { fullDate } from '../../shared/dateWords';
import { needsOf, type P3Row } from '../data/home';

/**
 * The organiser Events tab (flag organiserDash, admin #1535, Option A). Pure: organiser_home_v1 rows
 * -> one list of NIGHTS by date, each with ONE status, the pinned "N things need you" line, search,
 * status filters and paging. home_v1 carries at most the next 3 scheduled dates of a series plus the
 * server's upcoming count, so a series shows its next 3 nights and a "N more dates" line that opens
 * the existing All dates screen. Every screen reads this one mapping (STATUS_WORD, the reasons).
 */

export type NightStatus = 'live' | 'draft' | 'hidden' | 'cancelled' | 'past';
export type Seat = 'owner' | 'manager' | 'contributor';
export type Filter = 'all' | NightStatus;

/** The one word per status. Hidden (paused) is its own tag: folding it into Draft would say "not on the calendar" of an event that was. */
export const STATUS_WORD: Record<NightStatus, string> = { live: 'Live', draft: 'Draft', hidden: 'Hidden', cancelled: 'Cancelled', past: 'Past' };
export const FILTER_ORDER: readonly Filter[] = ['all', 'live', 'draft', 'hidden', 'cancelled', 'past'];

/** Nights shown first, then per "Show 30 more". Search and filters show from this many nights up. */
export const PAGE_FIRST = 15;
export const PAGE_MORE = 30;
export const SEARCH_FROM = 8;

export const VIEW_ONLY = 'You are a contributor, so you can see every event but not change them. Ask the page owner or a manager.';
export const WHY = {
  contributor: 'Contributors can\u2019t change events. Ask the page owner or a manager.',
  draft: 'A draft is not on the calendar yet, so there is nothing to cancel.',
  hidden: 'This event is hidden. Show it again first, then cancel a night.',
  cancelled: 'This night is already cancelled.',
  past: 'This night has passed, so it can\u2019t be cancelled.',
  editPast: 'This event has finished, so it can\u2019t be changed. Add a new event to run it again.',
} as const;

/** The cancel scope ask: one night (the date sheet) or every coming night (occurrence.bulk_cancel). */
export const SCOPE = {
  title: 'Cancel which nights?',
  one: 'This night only',
  all: 'Every night',
  /** Only asked when the event has this many coming nights that could be cancelled. */
  askFrom: 2,
} as const;

export const CX_STORY = 'A cancelled night stays on the calendar marked Cancelled, so nobody turns up.';

export interface Reason { ok: boolean; why: string | null }
const OK: Reason = { ok: true, why: null };
const no = (why: string): Reason => ({ ok: false, why });

export interface Night {
  key: string;
  seriesId: string;
  name: string;
  /** null = no date to sort by (a draft or hidden event with nothing scheduled, a past event). */
  date: IsoDate | null;
  /** 'Friday 13 November', or a status sentence when there is no date. */
  dayLabel: string;
  /** 'Tonight, 8pm' style when, or the row's own line. */
  sub: string;
  status: NightStatus;
  /** The occurrence id the cancel flow opens: its date, resolved on the event's own read. */
  cancel: Reason;
  canEdit: boolean;
  canDelete: boolean;
  /** Dates of this series not listed (home_v1 sends 3): "See all N dates". 0 on every night but the last of a series. */
  moreDates: number;
  /** Tapping the night opens the existing event page. */
  openId: string;
}

export interface NeedsEntry {
  key: 'photo' | 'dates' | 'draft' | 'allcx';
  title: string;
  detail: string;
  /** What the one button does; null = no button (a contributor, or nothing to fix by tapping). */
  action: 'open' | 'dates' | 'new' | null;
  actionLabel: string | null;
  seriesId: string | null;
  /** Why there is no button. */
  note: string | null;
}

export interface EventsInput {
  rows: readonly P3Row[];
  today: IsoDate;
  seat: Seat;
  query: string;
  filter: Filter;
  shown: number;
  showPast: boolean;
}

export type EventsState = 'empty' | 'allpast' | 'nomatch' | 'list';

export interface EventsModel {
  state: EventsState;
  viewOnly: boolean;
  banner: string | null;
  newEvent: Reason;
  /** The pinned line ('2 things need you'), or null when nothing does. */
  needsLine: string | null;
  needs: NeedsEntry[];
  searchable: boolean;
  counts: Record<Filter, number>;
  filters: Filter[];
  nights: Night[];
  /** Nights matching the search and filter (before paging). */
  total: number;
  /** "Show 30 more": how many the next tap adds; 0 = none left. */
  more: number;
  /** Past nights folded away: "Show past nights (N)". */
  pastHidden: number;
  empty: string | null;
  /** Every night has passed and none are shown: what to do next. */
  allPast: string | null;
  noMatch: string | null;
}

function nightsOfRow(r: P3Row, today: IsoDate, seat: Seat): Night[] {
  const write = seat !== 'contributor';
  const base = { seriesId: r.id, name: r.name, openId: r.id };
  const gate = (reason: Reason): Reason => (write ? reason : no(WHY.contributor));
  if (r.lifecycle === 'draft' || r.lifecycle === 'paused') {
    const draft = r.lifecycle === 'draft';
    const date = r.next?.date ?? null;
    return [{
      ...base, key: `${r.id}:${draft ? 'draft' : 'hidden'}`, date, dayLabel: date ? fullDate(date, today) : (draft ? L.noDatesYet : 'No date coming up'),
      sub: r.sub, status: draft ? 'draft' : 'hidden', cancel: gate(no(draft ? WHY.draft : WHY.hidden)),
      canEdit: write, canDelete: write && draft, moreDates: 0,
    }];
  }
  const dates = r.event.dates.filter((d) => d.date >= today);
  if (!dates.length || r.status.past) {
    return [{
      ...base, key: `${r.id}:past`, date: null, dayLabel: r.status.label, sub: r.status.key === 'warn' ? 'Nothing coming up. Open it to add dates.' : r.sub,
      status: 'past', cancel: gate(no(WHY.past)), canEdit: write && r.status.key === 'warn', canDelete: false, moreDates: 0,
    }];
  }
  const scheduled = dates.filter((d) => d.status !== 'cancelled').length;
  const unseen = Math.max(0, r.upcoming - scheduled);
  return dates.map((d, i) => {
    const cancelled = d.status === 'cancelled';
    const first = r.next?.date === d.date;
    const when = dayWord(d.date, today, first ? r.nextStart : null);
    return {
      ...base, key: `${r.id}:${d.date}`, date: d.date, dayLabel: fullDate(d.date, today),
      sub: cancelled ? 'Cancelled. Dancers see it marked Cancelled.' : `${when}${first ? `, ${r.nextTime}` : ''}${r.place && first ? ` \u00b7 ${r.place}` : ''}`,
      status: cancelled ? 'cancelled' : 'live', cancel: gate(cancelled ? no(WHY.cancelled) : OK),
      canEdit: write, canDelete: false, moreDates: i === dates.length - 1 ? unseen : 0,
    } satisfies Night;
  });
}

function needsEntries(rows: readonly P3Row[], seat: Seat): NeedsEntry[] {
  const write = seat !== 'contributor';
  const target = (key: string): P3Row | undefined => {
    if (key === 'photo') return rows.find((r) => !r.cover && !r.status.past);
    if (key === 'dates') return rows.find((r) => r.status.key === 'warn');
    return rows.find((r) => r.lifecycle === 'draft');
  };
  const out: NeedsEntry[] = needsOf(rows).map((n) => {
    const t = target(n.key);
    const label = n.key === 'photo' ? 'Add photo' : n.key === 'dates' ? 'Add dates' : 'Finish';
    return {
      key: n.key, title: n.title, detail: n.detail, seriesId: t?.id ?? null,
      action: write && t ? (n.key === 'dates' ? 'dates' : 'open') : null, actionLabel: write && t ? label : null,
      note: write ? null : 'The page owner or a manager needs to finish this.',
    };
  });
  const allCx = rows.filter((r) => r.lifecycle === 'live' && r.event.dates.length > 0 && r.event.dates.every((d) => d.status === 'cancelled'));
  if (allCx.length) {
    out.push({
      key: 'allcx', seriesId: null,
      title: allCx.length === 1 ? `Every coming night of ${allCx[0].name} is cancelled` : `Every coming night of ${allCx.length} events is cancelled`,
      detail: `${CX_STORY} Add a new event when you are ready.`,
      action: write ? 'new' : null, actionLabel: write ? 'New event' : null, note: write ? null : 'The page owner or a manager needs to finish this.',
    });
  }
  return out;
}

const cmp = (a: Night, b: Night): number => {
  // dated nights first by date, then undated drafts/hidden, then past
  const rank = (n: Night) => (n.date ? 0 : n.status === 'past' ? 2 : 1);
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  if (a.date && b.date && a.date !== b.date) return a.date < b.date ? -1 : 1;
  return a.name.localeCompare(b.name);
};

export function buildEvents(i: EventsInput): EventsModel {
  const viewOnly = i.seat === 'contributor';
  const all = i.rows.flatMap((r) => nightsOfRow(r, i.today, i.seat)).sort(cmp);
  const counts = { all: all.length, live: 0, draft: 0, hidden: 0, cancelled: 0, past: 0 } as Record<Filter, number>;
  for (const n of all) counts[n.status] += 1;
  const searchable = all.length >= SEARCH_FROM;
  const q = i.query.trim().toLowerCase();
  const searching = searchable && (q !== '' || i.filter !== 'all');
  const matches = (n: Night) => (!searching || ((q === '' || n.name.toLowerCase().includes(q)) && (i.filter === 'all' || n.status === i.filter)));
  const matched = all.filter(matches);
  // past events fold away unless asked for, or unless a filter/search is looking for them
  const foldPast = !i.showPast && !(searching && i.filter === 'past');
  const visible = foldPast && !(q !== '') ? matched.filter((n) => n.status !== 'past') : matched;
  const pastHidden = matched.length - visible.length;
  const needs = needsEntries(i.rows, i.seat);
  const nights = visible.slice(0, Math.max(PAGE_FIRST, i.shown));
  const state: EventsState = all.length === 0 ? 'empty' : visible.length === 0 && searching ? 'nomatch' : visible.length === 0 && pastHidden > 0 ? 'allpast' : 'list';
  return {
    state, viewOnly, banner: viewOnly ? VIEW_ONLY : null,
    newEvent: viewOnly ? no(WHY.contributor) : OK,
    needsLine: needs.length ? `${needs.length} ${needs.length === 1 ? 'thing needs' : 'things need'} you` : null,
    needs, searchable, counts,
    filters: FILTER_ORDER.filter((f) => f === 'all' || counts[f] > 0),
    nights, total: visible.length, more: Math.min(PAGE_MORE, Math.max(0, visible.length - nights.length)), pastHidden,
    empty: state === 'empty' ? (viewOnly ? 'This page has no events yet. The page owner or a manager can add one.' : 'No events yet. Tap New event to add your first night.') : null,
    allPast: state === 'allpast' ? (viewOnly ? 'Every event on this page has finished. Tap Show past events to look back. The page owner or a manager can add a new event.' : 'Every event on this page has finished. Tap Show past events to look back, or New event to add a night.') : null,
    noMatch: state === 'nomatch' ? `Nothing matches${q ? ` \u201c${i.query.trim()}\u201d` : ' these filters'}. Tap Clear search and filters to see every night.` : null,
  };
}
