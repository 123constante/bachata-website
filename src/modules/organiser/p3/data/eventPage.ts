import { fullDate } from '../../shared/dateWords';
import { lifecycleCommand, type OwnerCommand } from '../../shared/seriesCommands';
import { endRunCommand, readIsFull, stopRepeatingCommand, type EventWorkspace, type TodaySession } from '../../events/eventModel';
import { parseTree } from '../../events/programmeSeriesModel';
import { NO_SESSION_REASON } from '../../events/lifecycleModel';
import { L, classCount, daySessions, dayWord, kindOf, kindWordStored, liveDates, startPhrase, statusOf, upcoming } from '../model';
import type { DaySession, IsoDate, P3Date, P3Event, P3Kind, P3Person, P3Session, P3Status, RoleKey, SessionKind } from '../model';

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

/** Stored level key -> C3's level word (L.lvls). */
const LEVEL: Record<string, string> = {
  beginner: L.lvls[0], improver: L.lvls[1], intermediate: L.lvls[2], advanced: L.lvls[3], open_level: L.lvls[4],
};

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
  /** The date has its own changes (details, sessions or an extra session). */
  changed: boolean;
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
    return {
      id: d.id,
      date: x.date,
      label: dayWord(x.date, today),
      cancelled: x.status === 'cancelled',
      changed: d.has_override || d.session_overrides_count > 0 || d.added_sessions_count > 0,
    };
  });
  const left = all.length - coming.length;
  const comingMore = full
    ? `More than ${ws.dates.length} dates are coming up, more than this page can list.`
    : left > 0 ? `and ${plural(left, 'more date', 'more dates')} coming up` : null;
  const partial = ws.hasMore
    ? ws.total !== null ? `This page lists the newest ${ws.dates.length} of ${ws.total} dates.` : `This page lists the newest ${ws.dates.length} dates; older ones are not shown.`
    : null;

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
  backDraftWhy: 'A live event can\u2019t go back to draft. Hide it instead: dancers stop seeing it and every date is kept.',
  neverRan: 'It hasn\u2019t run yet, so it can\u2019t end. Hide it or remove it instead.',
  courseStop: 'A course keeps its dates while it runs. End it when the last class is done.',
  tooManyDates: 'This event has more dates coming up than this page can list, so the dates to keep can\u2019t be picked here. Ask the Bachata Calendar team.',
  cancelWhy: 'To cancel it, cancel its date in the current organiser area, so dancers see why.',
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
export function statusRows(ws: EventWorkspace, today: IsoDate): StatusRow[] {
  const s = ws.series;
  const lc = s.lifecycle_status;
  const kind = kindOfWorkspace(ws);
  const row = (move: StatusMove, title: string, sub: string | null, reason: string | null = null): StatusRow => ({ move, title, sub, reason });

  if (lc === 'draft' || lc === 'rejected') {
    const coming = ws.dates.some((d) => d.lifecycle_status !== 'cancelled' && d.occurrence_date >= today);
    const why = !coming ? STATUS_COPY.noComingDate : !ws.hasSessions ? NO_SESSION_REASON : null;
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
  out.push(row('end', L.endIt, STATUS_COPY.endSub, ran ? null : STATUS_COPY.neverRan));
  if (kind === 'course') out.push(row('stop', L.stopRepeat, null, STATUS_COPY.courseStop));
  else if ((kind === 'weekly' || kind === 'monthly') && hasRule(s.recurrence_rule)) {
    out.push(row('stop', L.stopRepeat, STATUS_COPY.stopSub, readIsFull(ws, today) ? STATUS_COPY.tooManyDates : null));
  }
  // W2c mounts the one-off cancel here (BRIEF-p3-cancel-one-off.md): this one entry is its slot.
  if (kind === 'oneoff' && !ran) out.push(row('cancel', L.cancelEvent, null, STATUS_COPY.cancelWhy));
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
