import type { OwnerCommand, OverridePatch } from '../../shared/seriesCommands';
import { overrideCommand } from '../../shared/seriesCommands';
import type { WorkspaceDate } from '../../shared/seriesModel';
import { V2 } from './copy';

/**
 * Editor v2 (S1), pure: the draft, the change list the save bar names, the write plan and its order,
 * the partial-failure runner, and the rule checks (findings 14, 15). No React, no network.
 */

/** The formats v2 draws. Every other format keeps today's screens. */
export const V2_FORMATS = ['recurring', 'one_off'] as const;
export const isV2Format = (format: string | null | undefined): boolean =>
  !!format && (V2_FORMATS as readonly string[]).includes(format);

/** Event-wide fields v2 holds in its draft (Name, About, Venue). */
export interface EventFields { name: string; about: string; venueId: string | null }
export const EVENT_LABELS: Record<keyof EventFields, string> = { name: V2.name, about: V2.about, venueId: V2.venue };

/** One night's own changes. A key present with null = Back to usual. */
export type NightPatch = Pick<OverridePatch, 'title' | 'description' | 'venue_id' | 'city_id' | 'cover_image_url'>;
export const NIGHT_LABELS: Record<keyof NightPatch, string> = {
  title: V2.nightName, description: V2.nightAbout, venue_id: V2.venue, city_id: V2.venue, cover_image_url: V2.nightPicture,
};
export const NIGHT_ABOUT_MAX = 2000;

export interface EditorDraft {
  event: Partial<EventFields>;
  /** occurrence id -> that night's patch */
  nights: Record<string, NightPatch>;
}
export const EMPTY_DRAFT: EditorDraft = { event: {}, nights: {} };

/** Only the event fields that differ from the saved ones (typing back to the saved value is no change). */
export function eventChanges(base: EventFields, draft: Partial<EventFields>): (keyof EventFields)[] {
  return (Object.keys(EVENT_LABELS) as (keyof EventFields)[]).filter((k) => k in draft && norm(draft[k]) !== norm(base[k]));
}
const norm = (v: unknown) => (typeof v === 'string' ? v.trim() : v ?? null);

/** Every change the save bar holds, as labels: event-wide first, then nights by date. */
export function changeList(base: EventFields, draft: EditorDraft, dayOf: (occId: string) => string): string[] {
  const out = eventChanges(base, draft.event).map((k) => EVENT_LABELS[k]);
  for (const occ of Object.keys(draft.nights).sort((a, b) => dayOf(a).localeCompare(dayOf(b)))) {
    const keys = nightKeys(draft.nights[occ]);
    for (const k of keys) out.push(`${NIGHT_LABELS[k]} (${dayOf(occ)})`);
  }
  return dedupe(out);
}
const dedupe = (xs: string[]) => xs.filter((x, i) => xs.indexOf(x) === i);
const nightKeys = (p: NightPatch | undefined) =>
  (p ? (Object.keys(p) as (keyof NightPatch)[]).filter((k) => k !== 'city_id') : []);

/** "Name", "Name and About", "Name and 7 more" (finding 12: max 2 lines in a toast). */
export function summaryOf(list: readonly string[]): string {
  if (list.length === 0) return '';
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list[0]} and ${list.length - 1} more`;
}

export type StepTarget = 'series' | 'occurrence';
export interface WriteStep {
  /** What the save bar names when this step fails. */
  part: string;
  target: StepTarget;
  /** series id or occurrence id */
  id: string;
  /** the occurrence's version; series steps chain the series version at run time */
  version: number | null;
  command: OwnerCommand;
  /** 0 event-wide, 1 night overrides, 2 sessions */
  order: 0 | 1 | 2;
}

/**
 * The write plan. Event-wide commands (built by the existing detailsPlan) first, then each night's
 * set_override, then sessions. A night patch with no keys sends nothing; an untouched draft is [].
 */
export function writePlan(seriesId: string, eventCommands: readonly OwnerCommand[], draft: EditorDraft,
  dates: readonly Pick<WorkspaceDate, 'id' | 'version'>[], dayOf: (occId: string) => string): WriteStep[] {
  const steps: WriteStep[] = eventCommands.map((command) => ({ part: eventPartOf(command), target: 'series', id: seriesId, version: null, command, order: 0 }));
  for (const occ of Object.keys(draft.nights).sort((a, b) => dayOf(a).localeCompare(dayOf(b)))) {
    const patch = draft.nights[occ];
    if (!nightKeys(patch).length) continue;
    const d = dates.find((x) => x.id === occ);
    if (!d) continue;
    steps.push({ part: dayOf(occ), target: 'occurrence', id: occ, version: d.version, command: overrideCommand(patch), order: 1 });
  }
  return steps.sort((a, b) => a.order - b.order);
}
function eventPartOf(c: OwnerCommand): string {
  const p = c.payload ?? {};
  const parts: string[] = [];
  if ('name' in p || 'series_name' in p) parts.push(V2.name);
  if ('default_description' in p) parts.push(V2.about);
  if ('default_venue_id' in p || 'venue_id' in p) parts.push(V2.venue);
  return parts.length ? parts.join(', ') : V2.eventCard;
}

export interface RunResult { done: number; failed: string[]; error: unknown | null }
export type StepSend = (step: WriteStep, seriesVersion: number | null) => Promise<{ new_version?: number } | null | undefined>;

/**
 * Runs the plan in order from `from` (a retry starts after the steps that landed). Stops at the first
 * failure: the bar stays and names that part and every part after it ("Not saved: <part>").
 */
export async function runPlan(steps: readonly WriteStep[], from: number, seriesVersion: number | null, send: StepSend): Promise<RunResult & { seriesVersion: number | null }> {
  let v = seriesVersion;
  for (let i = from; i < steps.length; i += 1) {
    try {
      const res = await send(steps[i], v);
      if (steps[i].target === 'series' && typeof res?.new_version === 'number') v = res.new_version;
    } catch (error) {
      return { done: i, failed: dedupe(steps.slice(i).map((s) => s.part)), error, seriesVersion: v };
    }
  }
  return { done: steps.length, failed: [], error: null, seriesVersion: v };
}

/** Finding 15a: an end at or before the start saves as ends next day. Times 'HH:MM'. */
export function sessionEnds(start: string, end: string | null): { end: string | null; nextDay: boolean } {
  if (!end) return { end: null, nextDay: false };
  return { end, nextDay: end <= start };
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** Finding 15b: a repeat's last date is today or later and falls on the repeat weekday (0 = Sunday). */
export function lastDateProblem(last: string | null, today: string, weekday: number): string | null {
  if (!last) return null;
  if (last < today) return V2.lastDatePast;
  const day = new Date(`${last}T12:00:00Z`).getUTCDay();
  return day === weekday ? null : V2.lastDateWeekday(WEEKDAYS[weekday]);
}

/** Finding 14a: Who runs it keeps at least one organiser; removing yourself asks first. */
export function removeOrganiser(ids: readonly string[], remove: string, me: string | null): 'last' | 'self' | 'ok' {
  if (ids.length <= 1 && ids.includes(remove)) return 'last';
  return remove === me ? 'self' : 'ok';
}

/** Finding 14b: removing a session that some dates changed warns how many lose their change. */
export const removeSessionWarning = (datesWithChanges: number): string | null =>
  (datesWithChanges > 0 ? V2.sessionOverrides(datesWithChanges) : null);

/** The per-night sessions writer refuses multi-day, cancelled and past dates: disable with a reason, never send. */
export function nightSessionsOff(d: Pick<WorkspaceDate, 'occurrence_date' | 'lifecycle_status'>, today: string, multiDay: boolean): string | null {
  if (multiDay) return V2.nightSessionsOff.multiDay;
  if (d.lifecycle_status === 'cancelled') return V2.nightSessionsOff.cancelled;
  if (d.occurrence_date < today) return V2.nightSessionsOff.past;
  return null;
}

/** The roles a night may set (the writer takes only these). Dancers per night come later. */
export const NIGHT_ROLES = ['teaching', 'djing'] as const;

export type DateTag = 'cancelled' | 'ended' | 'changed' | null;
export function dateTagOf(d: Pick<WorkspaceDate, 'lifecycle_status' | 'has_override' | 'override_keys' | 'session_overrides_count' | 'added_sessions_count'>, seriesStatus: string): DateTag {
  if (d.lifecycle_status === 'cancelled') return 'cancelled';
  if (d.lifecycle_status === 'ended' || seriesStatus === 'ended') return 'ended';
  if (d.has_override || d.override_keys.length > 0 || d.session_overrides_count > 0 || d.added_sessions_count > 0) return 'changed';
  return null;
}
export const DATE_TAG_WORD: Record<Exclude<DateTag, null>, string> = { cancelled: V2.tagCancelled, ended: V2.tagEnded, changed: V2.tagChanged };

/** Upcoming dates, soonest first; the page shows 6, then Show more dates. */
export const UPCOMING_PAGE = 6;
export function upcomingOf<T extends Pick<WorkspaceDate, 'occurrence_date'>>(dates: readonly T[], today: string): T[] {
  return dates.filter((d) => d.occurrence_date >= today).sort((a, b) => a.occurrence_date.localeCompare(b.occurrence_date));
}

/** Night row state: "Usual" or "Changed for this night", the draft beating what is saved. */
export function nightFieldState(key: keyof NightPatch, savedKeys: readonly string[], patch: NightPatch | undefined): 'usual' | 'changed' {
  if (patch && key in patch) return patch[key] == null ? 'usual' : 'changed';
  return savedKeys.includes(key) ? 'changed' : 'usual';
}
