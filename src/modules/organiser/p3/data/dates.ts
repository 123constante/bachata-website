import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fullDate } from '../../shared/dateWords';
import { weeklyRule, type DateDetail, type WorkspaceDate } from '../../shared/seriesModel';
import {
  ORGANISER_HOME_KEY, dateDetailQueryKey, fetchDateDetail, runOccurrenceCommand, runSeriesCommand, seriesWorkspaceQueryKey,
  type CommandResponse,
} from '../../shared/selfServeApi';
import {
  addDateCommand, cancelCommand, envelope, moveDateCommand, newIdempotencyKey, overrideCommand, resetTimeCommand,
  setTimeCommand, skipDateCommand, uncancelCommand, unskipDateCommand, type OverridePatch, type OwnerCommand,
} from '../../shared/seriesCommands';
import { eventWorkspaceQueryKey } from '../../shared/runCommands';
import { invalidatePublicEventCaches } from '../../shared/publicCache';
import { commandErrorMessage } from '../../shared/selfServeErrors';
import { readIsFull, type EventWorkspace } from '../../events/eventModel';
import { DATE_WHY, L, addDateWhy, canCancelOneOff, dateActions, dateMarks, timeWord, type DateAction, type DateFacts, type DateRow, type IsoDate, type SeriesFacts } from '../model';
import { bringBackStep, cancelInputOf, kindOfWorkspace } from './eventPage';
import { breakFactsOf, dateFactsOf, marksOf, repeatShapeOf } from './dateFacts';

export { breakFactsOf, dateFactsOf, ownDetailsOf, repeatShapeOf } from './dateFacts';

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
    upcoming: ws.dates.filter((d) => d.lifecycle_status === 'scheduled' && d.occurrence_date >= today).length,
    ...(ws.series.recurrence_rule == null ? { ruleSaved: false } : {}),
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

/** Every date the read holds, plus every break (removed_dates, whatever the rule: its date sheet says if it can come back), soonest first. */
export function dateEntries(ws: EventWorkspace, today: IsoDate): DateEntry[] {
  const stored = new Set(ws.dates.map((d) => d.occurrence_date));
  const rows: DateEntry[] = ws.dates.map((d) => {
    const facts = dateFactsOf(ws, d);
    const m = marksOf(ws, d, facts, today);
    return { id: d.id, date: d.occurrence_date, label: fullDate(d.occurrence_date, today), facts, tags: m.tags, own: m.own };
  });
  for (const date of ws.series.removed_dates) {
    if (stored.has(date)) continue;
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
  /** Filters whose count is a floor ("12+"): the read does not hold every date and the server sends no total for them. */
  atLeast: DateFilter[];
}

/**
 * FIXLIST F-27: the filter counts. When the read holds every date they are the list's own;
 * when it holds only the newest page they come from the server's whole-series summary
 * (meta.total, meta.counts), never from the loaded slice. Coming and Breaks are whole either
 * way (every future date is in the newest page unless the read is full; removed_dates is the
 * series row's).
 */
function countsOf(ws: EventWorkspace, all: DateEntry[], today: IsoDate): Pick<AllDatesView, 'counts' | 'atLeast'> {
  const counts = Object.fromEntries((Object.keys(IN) as DateFilter[]).map((f) => [f, all.filter((e) => IN[f](e, today)).length])) as Record<DateFilter, number>;
  if (!ws.hasMore) return { counts, atLeast: [] };
  const full = readIsFull(ws, today);
  // "Own changes" reads the date's own time too, which meta.counts.changed does not count
  const atLeast: DateFilter[] = ['own'];
  if (full) atLeast.push('coming');
  if (ws.total !== null && !full) {
    // every stored date not coming up is past (a cancelled one too); past breaks are not stored
    const storedComing = ws.dates.filter((d) => d.occurrence_date >= today).length;
    counts.past = ws.total - storedComing + all.filter((e) => e.id === null && e.date < today).length;
  } else atLeast.push('past');
  if (ws.dateCounts) counts.cancelled = ws.dateCounts.cancelled;
  else atLeast.push('cancelled');
  return { counts, atLeast };
}

/** The list for one filter; Past runs newest first, the rest soonest first. Counts are the server's (countsOf). */
export function allDatesOf(ws: EventWorkspace, today: IsoDate, filter: DateFilter): AllDatesView {
  const all = dateEntries(ws, today);
  const rows = all.filter((e) => IN[filter](e, today));
  return { rows: filter === 'past' ? rows.reverse() : rows, ...countsOf(ws, all, today) };
}

/**
 * F-27: what All dates says while older dates are not loaded, naming the button on screen.
 * null when the read holds every date.
 */
export function olderDatesNote(ws: EventWorkspace, button: string): string | null {
  if (!ws.hasMore) return null;
  const shown = ws.dates.length;
  return ws.total !== null && ws.total > shown
    ? `Showing the newest ${shown} of ${ws.total} dates. Tap "${button}" to see the other ${ws.total - shown}.`
    : `Showing the newest ${shown} dates. Tap "${button}" to see older ones.`;
}

const EMPTY: Record<DateFilter, string> = {
  coming: 'No dates coming up. Add a date so dancers can find it.',
  past: 'No past dates yet. Dates move here once they have happened.',
  cancelled: 'No cancelled dates. A date you cancel shows here, with its reason.',
  breaks: 'No break weeks. Skip a week from its date when it isn\u2019t running.',
  own: 'No date has its own changes. Open a date to change its place, details or time.',
};

/**
 * What an empty filter says, and what the person can do: never a control that is greyed.
 * Coming names why Add is off (as the event page does); Breaks says why this kind has none.
 */
export function emptyDatesCopy(ws: EventWorkspace, today: IsoDate, filter: DateFilter): string {
  const s = seriesFactsOf(ws, today);
  if (filter === 'coming') {
    const why = addDateWhy(s);
    return why ? `No dates coming up. ${why}` : EMPTY.coming;
  }
  if (filter === 'breaks') {
    if (s.kind === 'oneoff') return 'No break weeks. A one-off has one date, so it has none.';
    if (s.kind === 'festival') return 'No break weeks. A festival holds one date, so it has none.';
    const shape = repeatShapeOf(ws);
    if (shape.from === 'loose') return `No break weeks. ${DATE_WHY.noDatesPattern}`;
    if ((s.kind !== 'weekly' && s.kind !== 'course') || (shape.from === 'rule' && !weeklyRule(ws.series.recurrence_rule))) {
      return 'No break weeks. Only a weekly pattern has them; cancel a date instead, so dancers see why.';
    }
  }
  return EMPTY[filter];
}

/** A tag's CSS class, for the tag words of dateMarks (Coming rows and All dates alike). */
export function tagClass(tag: string): string {
  if (tag === L.cancelled) return 'p3-tag p3-tag-cancel';
  if (tag === L.skipped) return 'p3-tag p3-tag-hidden';
  if (tag === L.done) return 'p3-tag p3-tag-finished';
  if (tag === L.notUsualDay) return 'p3-tag p3-tag-warn';
  return 'p3-chip';
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
  add: (date: IsoDate) => onSeries(addDateCommand(date)),
} as const;

/**
 * "Put this date back to normal" (CONTRACT 2's composite, no new command): the date's own
 * Where (with its city) / About / Ticket link / photo / name / photos / price back to the series,
 * then its time.
 * The programme call of the composite is not sent: C3 `resetdate` says sessions stay
 * (per-date sessions are W2d). null when there is nothing to put back.
 */
/**
 * The date sheet's rows: model/dates dateActions, with "Put this date back to normal" greyed on a
 * cancelled date when nothing it owns can go back yet (only a name, photos or price: the
 * owner arm refuses those there), so the row says why instead of a confirm whose Go is off.
 */
export function dateRowsOf(ws: EventWorkspace, d: D, detail: DateDetail | null, facts: DateFacts, today: IsoDate): DateRow[] {
  return dateActions(seriesFactsOf(ws, today), facts, today).map((r) =>
    (r.action === 'resetNormal' && !r.reason && !resetNormalPlan(d, detail, facts.ownTime) ? { ...r, reason: L.dateFieldsCancelled } : r));
}

export function resetNormalPlan(d: D, detail: DateDetail | null | undefined, ownTime: boolean): DatePlan | null {
  const patch: OverridePatch = {};
  if (detail?.venueOverride) { patch.venue_id = null; patch.city_id = null; }
  if (detail?.descriptionOverride) patch.description = null;
  if (detail?.ticketUrlOverride) patch.ticket_url = null;
  if (detail?.coverImageOverride) patch.cover_image_url = null;
  // W3b-2: name, photos, price. Not on a cancelled date: the owner arm refuses these keys there
  // even as null (apply_aggregate_write_p5 c_a3_cancel), so they wait until it is brought back.
  if (detail && !detail.cancelled) {
    if (detail.titleOverride !== null) patch.title = null;
    if (detail.galleryOverride !== null) patch.gallery = null;
    if (detail.passesOverride !== null) patch.passes = null;
  }
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
  moveTitle: (day: string) => `Move ${day} to another day`,
  moveHint: 'The sessions keep their times. Pick a day from today on.',
  moveGo: 'Move it',
  timeTitle: (day: string) => `Change the time on ${day}`,
  timeBody: 'Every session on this date moves by the same amount. Other dates stay as usual.',
  startsAt: 'Starts at',
  now: (t: string | null) => (t ? `Now ${timeWord(t)}.` : 'No start time yet.'),
  resetTitle: `${L.resetDate}?`,
  resetBody: (day: string) => `Where, about, ticket link, cover photo, name, photos, price and time on ${day} go back to usual. Sessions stay as they are.`,
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
  usualPlace: 'The usual place',
  partialNote: 'Dates not in this list are not shown here.',
  halfReset: 'The details went back to usual, but the time did not.',
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
 * Keyed WITHOUT the date version: a write that committed but lost its response reloads the
 * workspace and moves the version, and the retry must still replay (the server answers a
 * known key before its version check), not write again.
 */
const ringId = (plan: DatePlan): string =>
  JSON.stringify(plan.to === 'date' ? [plan.occurrenceId, plan.commands] : plan);

export class KeyRing {
  private keys = new Map<string, string[]>();
  for(plan: DatePlan): string[] {
    const id = ringId(plan);
    let ks = this.keys.get(id);
    if (!ks) {
      ks = planCommands(plan).map(() => newIdempotencyKey());
      this.keys.set(id, ks);
    }
    return ks;
  }
  forget(plan: DatePlan) { this.keys.delete(ringId(plan)); }
}

/** A plan's later call was refused after an earlier one went through: say what changed. */
export class PlanStepError extends Error {
  constructor(readonly step: number, readonly cause: unknown) {
    super(`${DATE_COPY.halfReset} ${commandErrorMessage(cause)}`);
  }
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
    try {
      last = await run.date(plan.occurrenceId, v, plan.commands[i], keys[i]);
    } catch (e) {
      // Only the composite (details, then time) has a second call.
      throw i > 0 ? new PlanStepError(i, e) : e;
    }
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
      invalidatePublicEventCaches(qc);
    }
  };
}
