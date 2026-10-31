import { eventHref } from '@/lib/seo/eventHref';
import { fullDate } from '../../shared/dateWords';
import { cancelOneOffCommand, lifecycleCommand, uncancelCommand, type DateStep, type OwnerCommand } from '../../shared/seriesCommands';
import { endRunCommand, readIsFull, stopRepeatingCommand, type EventWorkspace, type TodaySession } from '../../events/eventModel';
import { parseTree } from '../../events/programmeSeriesModel';
import { NO_SESSION_REASON } from '../../events/lifecycleModel';
import { L, canCancelOneOff, classCount, daySessions, dayWord, kindOf, kindWordStored, liveDates, startPhrase, statusOf, upcoming } from '../model';
import { dateFactsOf, marksOf } from './dateFacts';
import type { CancelInput, DaySession, IsoDate, P3Date, P3Event, P3Kind, P3Person, P3Session, P3Status, RoleKey, SessionKind } from '../model';

/**
 * admin_event_workspace_p5 (the R1 read, parseEventWorkspace) -> the P3 event page
 * (C3 event page + Status sheet). Pure. The programme tree is read with the R1
 * parser (programmeSeriesModel.parseTree); every word comes from the W0 model.
 *
 * The workspace carries no per-date session changes (only counts), so a date's
 * sessions here are the series sessions; a date with its own changes is marked.
 */

const KINDS: readonly SessionKind[] = ['class', 'workshop', 'party', 'show', 'masterclass', 'performance', 'competition'];

/** Stored role -> C3 role. `mc` (1 prod row) has no C3 role and is not shown. */
const ROLE: Record<string, RoleKey> = { teaching: 'teach', djing: 'dj', performing: 'perform' };

/** Stored level key -> C3's level word (L.lvls). ONE mapping: the page rows and the session sheet chips read it. */
const LEVEL: Record<string, string> = {
  beginner: L.lvls[0], improver: L.lvls[1], intermediate: L.lvls[2], advanced: L.lvls[3], open_level: L.lvls[4],
};

export const levelLabel = (key: string): string => LEVEL[key] ?? key;

export interface PageDay {
  /** A festival day's name ("Day 2" when it has none); null for a one-day programme. */
  label: string | null;
  sessions: DaySession[];
}

export interface ComingRow {
  id: string;
  date: IsoDate;
  label: string;
  cancelled: boolean;
  /** The date has its own changes (details, time, sessions or an extra session). */
  changed: boolean;
  /** Its tags (model dateMarks, the same as All dates). */
  tags: string[];
}

export interface EventPageView {
  id: string;
  name: string;
  lifecycle: string;
  kind: P3Kind;
  kindWord: string;
  /** 'Weekly social', or 'Course \u00b7 8 classes'. */
  shape: string;
  status: P3Status;
  event: P3Event;
  /** 'Next: Friday 30 October, Party 9pm, class from 8pm', or null when nothing is coming up. */
  when: string | null;
  days: PageDay[];
  coming: ComingRow[];
  /** Under the Coming up list: how many more, honestly (null when every coming date is shown). */
  comingMore: string | null;
  /** The read holds only the newest dates: '100 of 131 dates'. null when it holds them all. */
  partial: string | null;
  about: { description: string | null; ticket: string | null; instagram: string | null; music: string[] };
  cover: string | null;
}

export const COMING_SHOWN = 6;

function sessionKind(type: string | null): SessionKind {
  return (KINDS as readonly string[]).includes(type ?? '') ? (type as SessionKind) : 'party';
}

/** The programme as P3 sessions, kept in their stored days. */
export function programmeOf(program: unknown): { sessions: P3Session[]; days: Array<{ label: string | null; ids: string[] }> } {
  const tree = parseTree(program);
  const sessions: P3Session[] = [];
  const days = tree.days.map((d, i) => {
    const ids: string[] = [];
    for (const it of d.sections.flatMap((s) => s.items)) {
      const people: P3Person[] = it.people.flatMap((p) => (ROLE[p.role ?? ''] ? [{ name: p.name, role: ROLE[p.role ?? ''] }] : []));
      sessions.push({
        id: it.key,
        kind: sessionKind(it.type),
        title: it.title || null,
        start: it.start || null,
        end: it.end || null,
        levels: it.levels.map((k) => LEVEL[k] ?? k),
        people,
      });
      ids.push(it.key);
    }
    const label = typeof d.raw.label === 'string' && d.raw.label.trim() ? d.raw.label.trim() : `Day ${i + 1}`;
    return { label: tree.days.length > 1 ? label : null, ids };
  });
  return { sessions, days };
}

const ruleMode = (rule: unknown): string | null =>
  rule && typeof rule === 'object' && typeof (rule as { mode?: unknown }).mode === 'string' ? (rule as { mode: string }).mode : null;

const hasRule = (rule: unknown) => !!rule && typeof rule === 'object';

export function kindOfWorkspace(ws: EventWorkspace): P3Kind {
  return kindOf(ws.series.format, ruleMode(ws.series.recurrence_rule));
}

/** The workspace as the W0 event: series sessions and every date the read holds (a break is not a row there). */
export function eventOf(ws: EventWorkspace): P3Event {
  return {
    kind: kindOfWorkspace(ws),
    sessions: programmeOf(ws.program).sessions,
    dates: ws.dates.map((d) => ({ date: d.occurrence_date, status: d.lifecycle_status === 'cancelled' ? 'cancelled' : 'scheduled' })),
  };
}

/** The read holds only the newest dates (the workspace cap, CONTRACT A2 R3): said honestly, never paged from a second read. */
export const partialOf = (ws: EventWorkspace): string | null => (ws.hasMore
  ? ws.total !== null ? `This page lists the newest ${ws.dates.length} of ${ws.total} dates.` : `This page lists the newest ${ws.dates.length} dates; older ones are not shown.`
  : null);

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function eventPageOf(ws: EventWorkspace, today: IsoDate, cover?: string | null): EventPageView {
  const s = ws.series;
  const event = eventOf(ws);
  const kind = event.kind;
  const comingScheduled = liveDates(event, today).length;
  const status = statusOf(s.lifecycle_status, s.format, kind, comingScheduled);
  const full = readIsFull(ws, today);
  const next: P3Date | undefined = liveDates(event, today)[0];
  const prog = programmeOf(ws.program);
  // a festival over several programme days starts on its FIRST day's sessions, not the earliest time of any day
  const first = new Set(prog.days[0]?.ids ?? []);
  const phrase = prog.days.length > 1
    ? startPhrase(event.sessions.filter((x) => first.has(x.id)), { long: true })
    : startPhrase(event.sessions, { event, today, long: true });
  const untimed = phrase === L.noSessions || phrase === L.noTime;
  const when = next && !full
    ? `Next: ${dayWord(next.date, today, daySessions(event, next)[0]?.start)}${untimed ? ` · ${phrase}` : `, ${phrase}`}`
    : null;

  const byDate = new Map(ws.dates.map((d) => [d.occurrence_date, d]));
  const all = upcoming(event, today);
  const coming: ComingRow[] = full ? [] : all.slice(0, COMING_SHOWN).map((x) => {
    const d = byDate.get(x.date)!;
    const marks = marksOf(ws, d, dateFactsOf(ws, d), today);
    return {
      id: d.id,
      date: x.date,
      label: dayWord(x.date, today),
      cancelled: x.status === 'cancelled',
      changed: marks.own,
      tags: marks.tags,
    };
  });
  const left = all.length - coming.length;
  const comingMore = full
    ? `More than ${ws.dates.length} dates are coming up, more than this page can list.`
    : left > 0 ? `and ${plural(left, 'more date', 'more dates')} coming up` : null;
  const partial = partialOf(ws);

  const byId = new Map(daySessions(event, next ?? null).map((m) => [m.id, m]));
  const days = prog.days.map((d) => ({ label: d.label, sessions: d.ids.map((id) => byId.get(id)!).filter(Boolean) }));

  const shape = kind === 'course' && !ws.hasMore ? `${L.kind.course} \u00b7 ${plural(classCount(event), 'class', 'classes')}` : L.kind[kind];
  return {
    id: s.id,
    name: s.name.trim() || L.noName,
    lifecycle: s.lifecycle_status,
    kind,
    kindWord: kindWordStored(s.format, s.category),
    shape,
    status,
    event,
    when,
    days,
    coming,
    comingMore,
    partial,
    about: {
      description: s.default_description?.trim() || null,
      ticket: s.default_ticket_url?.trim() || null,
      instagram: s.instagram_url?.trim() || null,
      music: ws.musicStyles,
    },
    cover: cover ?? s.default_cover_image_url,
  };
}

// ---- the Status sheet ------------------------------------------------------------------

export type StatusMove = 'live' | 'hide' | 'show' | 'draft' | 'end' | 'stop' | 'cancel' | 'remove' | 'reopen';

export interface StatusRow {
  move: StatusMove;
  title: string;
  /** What it does (enabled), or null. */
  sub: string | null;
  /** Why it cannot be done now; null = it can. */
  reason: string | null;
}

export const STATUS_COPY = {
  liveSub: 'Dancers can find it straight away.',
  hideSub: 'Dancers can\u2019t see it until you show it again. Dates kept.',
  showSub: 'Dancers see it again.',
  endSub: 'It moves to Finished. Dancers see it as finished.',
  stopSub: 'Keep the dates you choose, then add more one by one.',
  removeSub: 'It leaves your events and the calendar. Only the Bachata Calendar team can bring it back.',
  noComingDate: 'Add a date coming up first.',
  noCover: 'Add a cover photo first. Dancers see it before anything else.',
  backDraftWhy: 'A live event can\u2019t go back to draft. Hide it instead: dancers stop seeing it and every date is kept.',
  neverRan: 'It hasn\u2019t run yet, so it can\u2019t end. Hide it or remove it instead.',
  /** A one-off that can still be cancelled: End it points at the row that works (C3 `endit`). */
  neverRanOneOff: 'It hasn\u2019t run yet, so it can\u2019t end. Cancel the event instead.',
  courseStop: 'A course keeps its dates while it runs. End it when the last class is done.',
  tooManyDates: 'This event has more dates coming up than this page can list, so the dates to keep can\u2019t be picked here. Ask the Bachata Calendar team.',

  endedWhy: 'Finished events stay finished. Ask the Bachata Calendar team if it should run again.',
  archivedWhy: 'This event was removed. Ask the Bachata Calendar team if it should come back.',
  reviewWhy: 'The Bachata Calendar team is checking it, so its status can\u2019t change here.',
} as const;

/** A night that ran or is on today: series.end_run then has a last night to name. */
export function hasRun(ws: EventWorkspace, today: IsoDate): boolean {
  return ws.dates.some((d) => d.lifecycle_status !== 'cancelled' && d.occurrence_date <= today);
}

/**
 * Only the moves the server takes from this owner now (_owner_lifecycle_transition_allowed_p5,
 * _cmd_series_end_run_p5, _cmd_series_stop_repeating_p5, read on prod 2026-10-26), each
 * greyed one with its reason. "Back to draft" from live is not an owner transition (CONTRACT 2).
 */
/** The workspace as canCancelOneOff reads it (every date the read holds). */
export const cancelInputOf = (ws: EventWorkspace): CancelInput => ({
  kind: kindOfWorkspace(ws),
  lifecycle: ws.series.lifecycle_status,
  dates: ws.dates.map((d) => ({ date: d.occurrence_date, cancelled: d.lifecycle_status === 'cancelled', startUtc: d.materialised_start_utc })),
});

export function statusRows(ws: EventWorkspace, today: IsoDate, now: Date = new Date()): StatusRow[] {
  const s = ws.series;
  const lc = s.lifecycle_status;
  const kind = kindOfWorkspace(ws);
  const row = (move: StatusMove, title: string, sub: string | null, reason: string | null = null): StatusRow => ({ move, title, sub, reason });

  if (lc === 'draft' || lc === 'rejected') {
    const coming = ws.dates.some((d) => d.lifecycle_status !== 'cancelled' && d.occurrence_date >= today);
    // the server's go-live gate also wants a cover (apply_aggregate_write_p5); the rest it names in its refusal
    const why = !coming ? STATUS_COPY.noComingDate : !s.default_cover_image_url ? STATUS_COPY.noCover : !ws.hasSessions ? NO_SESSION_REASON : null;
    const out = [row('live', L.putLive, STATUS_COPY.liveSub, why)];
    if (lc === 'draft') out.push(row('remove', L.remove, STATUS_COPY.removeSub));
    return out;
  }
  if (lc === 'ended') return [row('reopen', L.show, null, STATUS_COPY.endedWhy)];
  if (lc === 'archived') return [row('reopen', L.show, null, STATUS_COPY.archivedWhy)];
  if (lc !== 'live' && lc !== 'paused') return [row('reopen', L.show, null, STATUS_COPY.reviewWhy)];

  const out: StatusRow[] = [];
  out.push(lc === 'live' ? row('hide', L.hide, STATUS_COPY.hideSub) : row('show', L.show, STATUS_COPY.showSub));
  if (lc === 'live') out.push(row('draft', L.backDraft, null, STATUS_COPY.backDraftWhy));
  const ran = hasRun(ws, today);
  const cancel = canCancelOneOff(cancelInputOf(ws), today, now);
  out.push(row('end', L.endIt, STATUS_COPY.endSub, ran ? null : cancel?.ok ? STATUS_COPY.neverRanOneOff : STATUS_COPY.neverRan));
  if (kind === 'course') out.push(row('stop', L.stopRepeat, null, STATUS_COPY.courseStop));
  else if ((kind === 'weekly' || kind === 'monthly') && hasRule(s.recurrence_rule)) {
    out.push(row('stop', L.stopRepeat, STATUS_COPY.stopSub, readIsFull(ws, today) ? STATUS_COPY.tooManyDates : null));
  }
  // W2c: a one-off ends with a reason (series.cancel_one_off); greyed with what to do instead, never hidden.
  if (cancel) out.push(row('cancel', L.cancelEvent, L.cancelEventWhy, cancel.reason));
  out.push(row('remove', L.remove, STATUS_COPY.removeSub));
  return out;
}

/** The one-tap moves (Hide, Show, Put it live) and what undoes each; the rest open a confirm step. */
export const ONE_TAP: Partial<Record<StatusMove, { command: OwnerCommand; undo: OwnerCommand | null; done: string }>> = {
  hide: { command: lifecycleCommand('paused'), undo: lifecycleCommand('live'), done: 'Hidden. Dancers can\u2019t see it.' },
  show: { command: lifecycleCommand('live'), undo: lifecycleCommand('paused'), done: 'Showing again. Dancers can see it.' },
  live: { command: lifecycleCommand('live'), undo: null, done: 'Live. Dancers can find it.' },
};

export const removeCommand = (): OwnerCommand => lifecycleCommand('archived');

// ---- Cancel the event (a one-off, ER AD4) ------------------------------------------------

export interface CancelPlan {
  /** The one date's id (what Bring it back is aimed at). */
  dateId: string;
  /** 'Saturday 31 October' (fullDate words). */
  day: string;
}

/** The Cancel the event sheet's words (C3 `cancelnext`, one-off wording). */
export const CANCEL_COPY = {
  title: (name: string, day: string) => `Cancel ${name} on ${day}?`,
  body: (day: string) => `Dancers will see \u2018Cancelled\u2019 on ${day}. You can bring it back any time.`,
  pick: 'Pick a reason to carry on',
  go: 'Yes, cancel the event',
  keep: 'Don\u2019t cancel',
  done: 'Cancelled.',
  already: (reason: string | null) => (reason ? `It was already cancelled. Dancers see: ${reason}.` : 'It was already cancelled.'),
  loading: 'Loading the reasons\u2026',
  noReasons: 'The reasons didn\u2019t load. Check your connection, then try again.',
} as const;

/** The one-off's one date; null when there is not exactly one (the row is greyed then). */
export function cancelPlan(ws: EventWorkspace, today: IsoDate): CancelPlan | null {
  if (ws.dates.length !== 1) return null;
  const [d] = ws.dates;
  return { dateId: d.id, day: fullDate(d.occurrence_date, today) };
}

/** THE command "Cancel the event" sends: series.cancel_one_off with one reason label. */
export const cancelEventCommand = (reason: string): OwnerCommand => cancelOneOffCommand(reason);

/**
 * Bring it back (the AD4 undo): occurrence.cancel {cancelled:false} on the date, no new
 * command. Sent with no expected version (the server checks one only when it is sent):
 * the cancel just moved the date on and the page does not hold its new version.
 */
export const bringBackStep = (dateId: string): DateStep => ({ ...uncancelCommand(), occurrence: { id: dateId, version: 0 } });

// ---- End it ------------------------------------------------------------------------------

export interface EndPlan {
  /** A date today that is not cancelled: the question "Did tonight happen?" must be answered. */
  tonight: boolean;
  /** The last night it ran, before today (fullDate words), or null. */
  lastBefore: string | null;
  today: string;
  /** Coming dates after today that come off (fullDate words, soonest first). */
  going: string[];
}

export function endPlan(ws: EventWorkspace, today: IsoDate): EndPlan {
  const on = ws.dates.filter((d) => d.lifecycle_status !== 'cancelled').map((d) => d.occurrence_date).sort();
  const before = on.filter((d) => d < today);
  return {
    tonight: on.includes(today),
    lastBefore: before.length ? fullDate(before[before.length - 1], today) : null,
    today: fullDate(today, today),
    going: on.filter((d) => d > today).map((d) => fullDate(d, today)),
  };
}

/** The last night line: today when it ran, else the night before. */
export function lastNight(plan: EndPlan, answer: TodaySession | null): string {
  if (plan.tonight && answer === 'ran') return plan.today;
  return plan.lastBefore ?? 'None yet';
}

/** series.end_run; null while tonight's question is unanswered (nothing is sent). */
export function endCommand(plan: EndPlan, answer: TodaySession | null): OwnerCommand | null {
  if (plan.tonight && !answer) return null;
  return endRunCommand(plan.tonight ? answer : null);
}

// ---- Stop repeating ----------------------------------------------------------------------

/** The dates the organiser may keep: scheduled, after today (the server never touches today or earlier). */
export function keepable(ws: EventWorkspace, today: IsoDate): Array<{ id: string; label: string }> {
  return ws.dates
    .filter((d) => d.lifecycle_status === 'scheduled' && d.occurrence_date > today)
    .sort((a, b) => a.occurrence_date.localeCompare(b.occurrence_date))
    .map((d) => ({ id: d.id, label: fullDate(d.occurrence_date, today) }));
}

export const stopCommand = (keepIds: string[]): OwnerCommand => stopRepeatingCommand(keepIds);

/**
 * FIXLIST F-34: "See it as dancers see it". event_view_p5 (read on prod 2026-10-31) serves a
 * series whose event_series_p5.lifecycle_status is live, paused or ended, so the link opens for
 * all three. Paused is the owner's "Hidden": off the calendar, but _p5_paused_hides_occurrence_v1
 * keeps its page and its PAST dates (owner decision 2026-10-08), so the subline says so.
 * The path comes from eventHref, the builder every public event link uses, and only from the
 * slug: without one it would fall back to the P5 id, which resolve_public_event_ref_v1 does not
 * find for a series bridged from a legacy event (0 public series without a slug on prod).
 */
export const PUBLIC_PAGE_SUB = 'Your public event page';
export const PUBLIC_PAGE_SUB_PAUSED = 'Hidden from the calendar. The page still opens with past dates only.';
export const PUBLIC_PAGE_NO_ADDRESS = 'The page has no address yet.';
export const PUBLIC_PAGE_WHY: Record<string, string> = {
  draft: 'Dancers can see it once it is live.',
  archived: 'You removed it, so dancers can\u2019t see it.',
};
export const PUBLIC_PAGE_WHY_OTHER = 'Dancers can see it once it is live.';

/** href set: the link, and `why` is its subline. href null: the row is off, and `why` is the reason. */
export function publicPageOf(ws: EventWorkspace): { href: string | null; why: string } {
  const lc = ws.series.lifecycle_status;
  if (lc !== 'live' && lc !== 'ended' && lc !== 'paused') return { href: null, why: PUBLIC_PAGE_WHY[lc] ?? PUBLIC_PAGE_WHY_OTHER };
  const slug = ws.series.slug;
  if (!slug) return { href: null, why: PUBLIC_PAGE_NO_ADDRESS };
  return { href: eventHref({ slug, event_id: ws.series.id }), why: lc === 'paused' ? PUBLIC_PAGE_SUB_PAUSED : PUBLIC_PAGE_SUB };
}
