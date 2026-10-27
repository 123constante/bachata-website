import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fullDate } from '../../shared/dateWords';
import { isRuleDate, type DateDetail, type WorkspaceDate } from '../../shared/seriesModel';
import {
  ORGANISER_HOME_KEY, dateDetailQueryKey, fetchDateDetail, runOccurrenceCommand, runSeriesCommand, seriesWorkspaceQueryKey,
  type CommandResponse,
} from '../../shared/selfServeApi';
import {
  addDateCommand, cancelCommand, envelope, moveDateCommand, newIdempotencyKey, overrideCommand, removeDateCommand, resetTimeCommand,
  setTimeCommand, skipDateCommand, uncancelCommand, unskipDateCommand, type OverridePatch, type OwnerCommand,
} from '../../shared/seriesCommands';
import { eventWorkspaceQueryKey } from '../../shared/runCommands';
import type { EventWorkspace } from '../../events/eventModel';
import { L, canCancelOneOff, dateMarks, type DateAction, type DateFacts, type IsoDate, type SeriesFacts } from '../model';
import { bringBackStep, cancelInputOf, kindOfWorkspace } from './eventPage';
import { breakFactsOf, dateFactsOf, marksOf } from './dateFacts';

export { breakFactsOf, dateFactsOf, ownDetailsOf } from './dateFacts';

/**
 * admin_event_workspace_p5 (+ event_view_p5 for one date's own details) -> the W2b date
 * sheet and All dates screen. Pure except the two hooks at the end. The rules are
 * model/dates.ts; the commands are the existing builders in shared/seriesCommands.ts.
 */

// ---- facts -----------------------------------------------------------------------------

export function seriesFactsOf(ws: EventWorkspace, today: IsoDate, now: Date = new Date()): SeriesFacts {
  const kind = kindOfWorkspace(ws);
  return {
    kind,
    lifecycle: ws.series.lifecycle_status,
    hasSessions: ws.hasSessions,
    upcoming: ws.dates.filter((d) => d.lifecycle_status === 'scheduled' && d.occurrence_date >= today).length,
    ...(kind === 'oneoff' ? { oneOff: canCancelOneOff(cancelInputOf(ws), today, now) } : {}),
  };
}

// ---- All dates -------------------------------------------------------------------------

export type DateFilter = 'coming' | 'past' | 'cancelled' | 'breaks' | 'own';

export interface DateEntry {
  /** The stored date's id; null for a break (a tombstone, not a row). */
  id: string | null;
  date: IsoDate;
  label: string;
  facts: DateFacts;
  tags: string[];
  /** Any own change: details, time, or the date's sessions. */
  own: boolean;
}

/** Every date the read holds, plus the breaks on the rule's cadence, soonest first. */
export function dateEntries(ws: EventWorkspace, today: IsoDate): DateEntry[] {
  const stored = new Set(ws.dates.map((d) => d.occurrence_date));
  const rows: DateEntry[] = ws.dates.map((d) => {
    const facts = dateFactsOf(ws, d);
    const m = marksOf(ws, d, facts, today);
    return { id: d.id, date: d.occurrence_date, label: fullDate(d.occurrence_date, today), facts, tags: m.tags, own: m.own };
  });
  for (const date of ws.series.removed_dates) {
    if (stored.has(date) || !isRuleDate(date, ws.series)) continue;
    const facts = breakFactsOf(ws, date);
    rows.push({ id: null, date, label: fullDate(date, today), facts, tags: dateMarks(kindOfWorkspace(ws), facts, { today, hasOverride: false, sessionChanges: false }).tags, own: false });
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

const IN: Record<DateFilter, (e: DateEntry, today: IsoDate) => boolean> = {
  coming: (e, today) => e.date >= today,
  past: (e, today) => e.date < today,
  cancelled: (e) => e.facts.state === 'cancelled',
  breaks: (e) => e.facts.state === 'skip',
  own: (e) => e.own,
};

export interface AllDatesView {
  rows: DateEntry[];
  counts: Record<DateFilter, number>;
}

/** The list for one filter; Past runs newest first, the rest soonest first. Never pages from a second read. */
export function allDatesOf(ws: EventWorkspace, today: IsoDate, filter: DateFilter): AllDatesView {
  const all = dateEntries(ws, today);
  const counts = Object.fromEntries((Object.keys(IN) as DateFilter[]).map((f) => [f, all.filter((e) => IN[f](e, today)).length])) as Record<DateFilter, number>;
  const rows = all.filter((e) => IN[filter](e, today));
  return { rows: filter === 'past' ? rows.reverse() : rows, counts };
}

/** Days "Move" and "Add" cannot land on: every stored date (a cancelled one counts too). */
export const takenDays = (ws: EventWorkspace): Set<string> => new Set(ws.dates.map((d) => d.occurrence_date));

// ---- what each action sends ------------------------------------------------------------

/** A write: against the DATE at its version (occurrence_command_p5), or the SERIES (series_command_p5). */
export type DatePlan =
  | { to: 'date'; occurrenceId: string; version: number; commands: OwnerCommand[] }
  | { to: 'series'; command: OwnerCommand };

const onDate = (d: Pick<WorkspaceDate, 'id' | 'version'>, ...commands: OwnerCommand[]): DatePlan =>
  ({ to: 'date', occurrenceId: d.id, version: d.version, commands });
const onSeries = (command: OwnerCommand): DatePlan => ({ to: 'series', command });

type D = Pick<WorkspaceDate, 'id' | 'version' | 'occurrence_date'>;

export const PLAN = {
  cancel: (d: D, reason: string) => onDate(d, cancelCommand(reason)),
  bringBack: (d: D) => onDate(d, uncancelCommand()),
  move: (d: D, to: IsoDate) => onDate(d, moveDateCommand(to)),
  time: (d: D, start: string) => onDate(d, setTimeCommand(start, null)),
  resetTime: (d: D) => onDate(d, resetTimeCommand()),
  details: (d: D, patch: OverridePatch) => onDate(d, overrideCommand(patch)),
  skip: (d: D) => onSeries(skipDateCommand(d.id)),
  unskip: (date: IsoDate) => onSeries(unskipDateCommand(date)),
  remove: (d: D) => onSeries(removeDateCommand(d.id)),
  add: (date: IsoDate) => onSeries(addDateCommand(date)),
} as const;

/**
 * "Put this date back to normal" (CONTRACT 2's composite, no new command): the date's own
 * Where (with its city) / About / Ticket link / photo back to the series, then its time.
 * The programme call of the composite is not sent: C3 `resetdate` says sessions stay
 * (per-date sessions are W2d). null when there is nothing to put back.
 */
export function resetNormalPlan(d: D, detail: DateDetail | null | undefined, ownTime: boolean): DatePlan | null {
  const patch: OverridePatch = {};
  if (detail?.venueOverride) { patch.venue_id = null; patch.city_id = null; }
  if (detail?.descriptionOverride) patch.description = null;
  if (detail?.ticketUrlOverride) patch.ticket_url = null;
  if (detail?.coverImageOverride) patch.cover_image_url = null;
  const commands: OwnerCommand[] = [];
  if (Object.keys(patch).length) commands.push(overrideCommand(patch));
  if (ownTime) commands.push(resetTimeCommand());
  return commands.length ? onDate(d, ...commands) : null;
}

/** The commands a plan sends, in order (the tests pin these). */
export const planCommands = (p: DatePlan): OwnerCommand[] => (p.to === 'date' ? p.commands : [p.command]);

export const DATE_COPY = {
  done: {
    cancel: 'Cancelled. Dancers see your reason.',
    bringBack: 'Back on. Dancers can see it again.',
    move: (day: string) => `Moved to ${day}.`,
    time: (t: string) => `This date now starts at ${t}.`,
    resetTime: 'Back to the usual time.',
    details: 'Saved for this date only.',
    resetNormal: 'Back to normal for this date.',
    skip: 'Skipped. Dancers won\u2019t see this week.',
    unskip: 'This week is back on.',
    remove: 'Removed.',
    add: (day: string) => `Added ${day}.`,
  },
  cancelTitle: (name: string, day: string) => `Cancel ${name} on ${day}?`,
  cancelBody: (day: string) => `Dancers will see \u2018Cancelled\u2019 on ${day}. Your other dates stay as they are. You can bring it back any time.`,
  cancelGo: 'Yes, cancel this date',
  pick: 'Pick a reason to carry on',
  keep: 'Don\u2019t cancel',
  cancelledBody: (reason: string | null) => `This date is cancelled. Dancers see \u2018${reason ? `Cancelled: ${reason}` : 'Cancelled'}\u2019.`,
  breakBody: 'A break week: dancers don\u2019t see this date at all.',
  skipTitle: (day: string) => `Skip ${day}?`,
  skipBody: 'A break week. Dancers won\u2019t see this date at all, with no \u2018Cancelled\u2019 notice.',
  skipOwn: 'This date\u2019s own changes go with it.',
  skipHint: 'Already told dancers it\u2019s on? Cancel it instead, so they see why.',
  skipGo: 'Yes, skip this week',
  keepIt: 'Keep it',
  removeTitle: (day: string) => `Remove ${day} for good?`,
  removeBody: 'It leaves the list and the calendar. To have it again, add it as a new date.',
  removeGo: 'Yes, remove it',
  moveTitle: (day: string) => `Move ${day} to another day`,
  moveHint: 'The sessions keep their times. Pick a day from today on.',
  moveGo: 'Move it',
  timeTitle: (day: string) => `Change the time on ${day}`,
  timeBody: 'Every session on this date moves by the same amount. Other dates stay as usual.',
  startsAt: 'Starts at',
  now: (t: string | null) => (t ? `Now ${t}.` : 'No start time yet.'),
  resetTitle: `${L.resetDate}?`,
  resetBody: (day: string) => `Where, about, ticket link, photo and time on ${day} go back to usual. Sessions stay as they are.`,
  resetGo: 'Put it back',
  keepMine: 'Keep my changes',
  detailsTitle: (day: string) => `Different details on ${day}`,
  detailsBody: 'Only this date changes. Everything else stays as usual.',
  usuallyNothing: 'nothing',
  addTitle: (name: string) => `Add a date to ${name}`,
  addHint: 'It gets the usual sessions. Change them on that date after.',
  loading: 'Loading this date\u2026',
  loadError: 'This date didn\u2019t load. Check your connection, then try again.',
  ticketHint: 'A full link starting with https://',
  photoHint: 'A photo for this date only: JPG, PNG or WebP.',
  uploading: 'Uploading the photo\u2026',
  pickVenue: 'Pick the place for this date',
  noVenues: 'The places didn\u2019t load. Check your connection, then try again.',
  usualPlace: 'The usual place',
  partialNote: 'Dates not in this list are not shown here.',
} as const;

/** The toast's undo for a finished action, where one command undoes it. */
export function undoFor(action: DateAction, d: D | null, date: IsoDate): { undo: OwnerCommand | null; undoLabel?: string } {
  if (action === 'cancel' && d) return { undo: bringBackStep(d.id), undoLabel: L.bringItBack };
  if (action === 'skip') return { undo: unskipDateCommand(date) };
  return { undo: null };
}

// ---- sending ---------------------------------------------------------------------------

/**
 * The keys a plan goes under, kept while it has not gone through: a retry after a dropped
 * connection sends the same keys, so it is the same write, never a second one. A changed
 * plan (another reason, another day) is a new request. Forget it once it succeeds.
 */
export class KeyRing {
  private keys = new Map<string, string[]>();
  for(plan: DatePlan): string[] {
    const id = JSON.stringify(plan);
    let ks = this.keys.get(id);
    if (!ks) {
      ks = planCommands(plan).map(() => newIdempotencyKey());
      this.keys.set(id, ks);
    }
    return ks;
  }
  forget(plan: DatePlan) { this.keys.delete(JSON.stringify(plan)); }
}

export type DateRunner = {
  date: (occurrenceId: string, version: number | null, command: OwnerCommand, key: string) => Promise<CommandResponse>;
  series: (version: number | null, command: OwnerCommand, key: string) => Promise<CommandResponse>;
};

/**
 * Send a plan: date commands one after another against the version the previous one
 * returned (a set_override bumps the date, so the reset's set_time must not send the old
 * one); a series command against the series version the page holds.
 */
export async function sendPlan(plan: DatePlan, keys: string[], seriesVersion: number | null, run: DateRunner): Promise<CommandResponse | null> {
  if (plan.to === 'series') return run.series(seriesVersion, plan.command, keys[0]);
  let v: number | null = plan.version;
  let last: CommandResponse | null = null;
  for (let i = 0; i < plan.commands.length; i++) {
    last = await run.date(plan.occurrenceId, v, plan.commands[i], keys[i]);
    v = typeof last?.new_version === 'number' ? last.new_version : null;
  }
  return last;
}

export function useDateDetail(occurrenceId: string | null) {
  return useQuery({
    queryKey: dateDetailQueryKey(occurrenceId ?? undefined),
    queryFn: () => fetchDateDetail(occurrenceId as string),
    enabled: !!occurrenceId,
    staleTime: 0,
  });
}

/** sendPlan through the P5 RPCs, then reload everything a date write touches. */
export function useSendPlan(seriesId: string) {
  const qc = useQueryClient();
  const run: DateRunner = {
    date: (id, version, command, key) => runOccurrenceCommand(envelope(id, version, command, key)),
    series: (version, command, key) => runSeriesCommand(envelope(seriesId, version, command, key)),
  };
  return async (plan: DatePlan, keys: string[], seriesVersion: number | null) => {
    try {
      return await sendPlan(plan, keys, seriesVersion, run);
    } finally {
      void qc.invalidateQueries({ queryKey: eventWorkspaceQueryKey(seriesId) });
      void qc.invalidateQueries({ queryKey: seriesWorkspaceQueryKey(seriesId) });
      void qc.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
      if (plan.to === 'date') void qc.invalidateQueries({ queryKey: dateDetailQueryKey(plan.occurrenceId) });
    }
  };
}
