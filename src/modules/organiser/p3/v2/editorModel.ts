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

/** One night's sessions as edited (the full programme the writer takes back), read at `version`. */
export interface NightSessions { version: number; payload: Record<string, unknown>[]; rows: readonly unknown[] }

export interface EditorDraft {
  event: Partial<EventFields>;
  /** occurrence id -> that night's patch */
  nights: Record<string, NightPatch>;
  /** occurrence id -> that night's changed sessions (absent = untouched) */
  sessions?: Record<string, NightSessions>;
}
export const EMPTY_DRAFT: EditorDraft = { event: {}, nights: {}, sessions: {} };

/** True when the draft holds nothing to save. */
export const draftEmpty = (d: EditorDraft): boolean =>
  !Object.keys(d.event).length && !Object.values(d.nights).some((p) => nightKeys(p).length) && !Object.keys(d.sessions ?? {}).length;
export { sameV2Editor } from './scope';

/** Finding 4: only nights still on the event. Save skips the others, so the save bar must not count them. */
export function knownDraft(d: EditorDraft, dates: readonly Pick<WorkspaceDate, 'id'>[]): EditorDraft {
  const on = (m: Record<string, unknown> | undefined) => Object.keys(m ?? {}).every((k) => dates.some((x) => x.id === k));
  if (on(d.nights) && on(d.sessions)) return d;
  const keep = <T,>(m: Record<string, T> | undefined) => Object.fromEntries(Object.entries(m ?? {}).filter(([k]) => dates.some((x) => x.id === k)));
  return { ...d, nights: keep(d.nights), sessions: keep(d.sessions) };
}

/** Only the event fields that differ from the saved ones (typing back to the saved value is no change). */
export function eventChanges(base: EventFields, draft: Partial<EventFields>): (keyof EventFields)[] {
  return (Object.keys(EVENT_LABELS) as (keyof EventFields)[]).filter((k) => k in draft && norm(draft[k]) !== norm(base[k]));
}
const norm = (v: unknown) => (typeof v === 'string' ? v.trim() : v ?? null);

/** Every change the save bar holds, as labels: event-wide first, then nights by date. */
/** `orderOf` sorts nights (an ISO date; defaults to `dayOf`, whose words do not sort by date). */
export function changeList(base: EventFields, draft: EditorDraft, dayOf: (occId: string) => string, orderOf: (occId: string) => string = dayOf): string[] {
  const out = eventChanges(base, draft.event).map((k) => EVENT_LABELS[k]);
  for (const occ of sortedNights(draft.nights, orderOf)) {
    const keys = nightKeys(draft.nights[occ]);
    for (const k of keys) out.push(`${NIGHT_LABELS[k]} (${dayOf(occ)})`);
  }
  for (const occ of sortedNights(draft.sessions, orderOf)) out.push(`${V2.nightSessions} (${dayOf(occ)})`);
  return dedupe(out);
}
const dedupe = (xs: string[]) => xs.filter((x, i) => xs.indexOf(x) === i);
const sortedNights = (m: Record<string, unknown> | undefined, orderOf: (occId: string) => string) =>
  Object.keys(m ?? {}).sort((a, b) => orderOf(a).localeCompare(orderOf(b)));
const nightKeys = (p: NightPatch | undefined) =>
  (p ? (Object.keys(p) as (keyof NightPatch)[]).filter((k) => k !== 'city_id') : []);

/** "Name", "Name and About", "Name and 7 more" (finding 12: max 2 lines in a toast). */
export function summaryOf(list: readonly string[]): string {
  if (list.length === 0) return '';
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list[0]} and ${list.length - 1} more`;
}

export type StepTarget = 'series' | 'occurrence' | 'programme';
export interface WriteStep {
  /** What the save bar names when this step fails. */
  part: string;
  target: StepTarget;
  /** series id or occurrence id */
  id: string;
  /** the occurrence's version as read; the runner chains it when an earlier step bumped it */
  version: number | null;
  /** series / occurrence steps; null for a programme step */
  command: OwnerCommand | null;
  /** programme steps: the full sessions list for organiser_set_occurrence_programme_v1 */
  payload?: Record<string, unknown>[];
  /** 0 event-wide, 1 night overrides, 2 sessions */
  order: 0 | 1 | 2;
}

/**
 * The write plan. Event-wide commands (built by the existing detailsPlan) first, then each night's
 * set_override, then sessions. A night patch with no keys sends nothing; an untouched draft is [].
 */
export function writePlan(seriesId: string, eventCommands: readonly OwnerCommand[], draft: EditorDraft,
  dates: readonly Pick<WorkspaceDate, 'id' | 'version'>[], dayOf: (occId: string) => string, orderOf: (occId: string) => string = dayOf): WriteStep[] {
  const steps: WriteStep[] = eventCommands.map((command) => ({ part: eventPartOf(command), target: 'series', id: seriesId, version: null, command, order: 0 }));
  for (const occ of sortedNights(draft.nights, orderOf)) {
    const patch = draft.nights[occ];
    if (!nightKeys(patch).length) continue;
    const d = dates.find((x) => x.id === occ);
    if (!d) continue;
    steps.push({ part: dayOf(occ), target: 'occurrence', id: occ, version: d.version, command: overrideCommand(patch), order: 1 });
  }
  for (const occ of sortedNights(draft.sessions, orderOf)) {
    if (!dates.some((x) => x.id === occ)) continue;
    const s = (draft.sessions ?? {})[occ];
    steps.push({ part: `${V2.nightSessions} (${dayOf(occ)})`, target: 'programme', id: occ, version: s.version, command: null, payload: s.payload, order: 2 });
  }
  return steps.sort((a, b) => a.order - b.order);
}
function eventPartOf(c: OwnerCommand | null): string {
  if (!c) return V2.eventCard;
  const p = c.payload ?? {};
  const parts: string[] = [];
  if ('name' in p || 'series_name' in p) parts.push(V2.name);
  if ('default_description' in p) parts.push(V2.about);
  if ('default_venue_id' in p || 'venue_id' in p) parts.push(V2.venue);
  return parts.length ? parts.join(', ') : V2.eventCard;
}

export interface RunResult { done: number; failed: string[]; error: unknown | null }
export type StepSend = (step: WriteStep, seriesVersion: number | null, occurrenceVersion: number | null) =>
  Promise<{ new_version?: number; version?: number } | null | undefined>;

/**
 * Runs the plan in order from `from` (a retry starts after the steps that landed). Stops at the first
 * failure: the bar stays and names that part and every part after it ("Not saved: <part>").
 */
export async function runPlan(steps: readonly WriteStep[], from: number, seriesVersion: number | null, send: StepSend,
  occStart: Readonly<Record<string, number>> = {}): Promise<RunResult & { seriesVersion: number | null; occ: Record<string, number> }> {
  let v = seriesVersion;
  // a night's override and its sessions share the occurrence version: the second step sends what the first left
  // (a retry passes back `occ` from the run that stopped, so the sessions step still sends the bumped version)
  const occ: Record<string, number> = { ...occStart };
  for (let i = from; i < steps.length; i += 1) {
    const s = steps[i];
    try {
      const res = await send(s, v, s.target === 'series' ? null : occ[s.id] ?? s.version);
      if (s.target === 'series' && typeof res?.new_version === 'number') v = res.new_version;
      const nv = res?.new_version ?? res?.version;
      if (s.target !== 'series' && typeof nv === 'number') occ[s.id] = nv;
    } catch (error) {
      return { done: i, failed: dedupe(steps.slice(i).map((s) => s.part)), error, seriesVersion: v, occ };
    }
  }
  return { done: steps.length, failed: [], error: null, seriesVersion: v, occ };
}

/**
 * What a run that stopped part-way keeps for the retry (findings 1, 2): one idempotency key per step content,
 * the steps that landed (never sent again, even when a refetch reshapes the plan), and the series and
 * occurrence versions those landed steps left. A step is known by its content, not its place in the plan.
 */
export interface SaveHold { keys: Record<string, string>; landed: string[]; occ: Record<string, number>; seriesVersion: number | null }
export const stepSig = (s: WriteStep): string => JSON.stringify([s.target, s.id, s.command, s.payload ?? null]);
export type HeldSend = (step: WriteStep, seriesVersion: number | null, occurrenceVersion: number | null, key: string) =>
  ReturnType<StepSend>;

/** Runs the plan minus the steps that landed; returns the hold to keep (null once every step landed). */
export async function runHeld(steps: readonly WriteStep[], hold: SaveHold | null, seriesVersion: number | null, send: HeldSend,
  newKey: () => string): Promise<{ hold: SaveHold | null; failed: string[]; error: unknown | null }> {
  const h: SaveHold = hold ?? { keys: {}, landed: [], occ: {}, seriesVersion: null };
  const sigs = new Map(steps.map((s) => [s, stepSig(s)] as const));
  const todo = steps.filter((s) => !h.landed.includes(sigs.get(s)!));
  const keys = { ...h.keys };
  for (const s of todo) keys[sigs.get(s)!] ??= newKey();
  const r = await runPlan(todo, 0, h.seriesVersion ?? seriesVersion, (s, v, o) => send(s, v, o, keys[sigs.get(s)!]), h.occ);
  if (!r.error) return { hold: null, failed: [], error: null };
  const landed = [...h.landed, ...todo.slice(0, r.done).map((s) => sigs.get(s)!)];
  return { hold: { keys, landed, occ: r.occ, seriesVersion: r.seriesVersion }, failed: r.failed, error: r.error };
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

/** The roles a night may set (the writer takes only these; `dancing` live in prod since admin 2026-11). */
export const NIGHT_ROLES = ['teaching', 'djing', 'dancing'] as const;

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

/**
 * What a write read BEFORE it ran, per step kind: the old value of every key the step sends (series.upsert,
 * occurrence.set_override: a night key that was inherited reads null), the old rule / lifecycle / organiser
 * payload, the old time ({new_local_start, new_local_end} or {reset:true}), the old cancel state
 * ({cancelled, reason}), the old programme tree ({days}) or, for a programme step, {payload} (the old sessions list).
 */
export type StepBefore = Record<string, unknown>;

const hasKeys = (before: StepBefore, keys: string[]) => keys.every((k) => k in before);
const sameStep = (step: WriteStep, command: OwnerCommand | null, payload?: Record<string, unknown>[]): WriteStep =>
  ({ ...step, command, payload });

/**
 * The step that puts the value read before a write back (the toast's Undo). null = no safe inverse (a key the
 * read did not cover, an unknown kind), and the toast then shows without Undo. Pure.
 *  - series.upsert / occurrence.set_override: same kind, each sent key set to its old value
 *  - series.set_recurrence / series.set_organisers / series.set_program: same kind with the old payload
 *  - series.set_lifecycle: same kind, to the old state
 *  - occurrence.set_time: set_time with the old times, or reset when the night had none of its own
 *  - occurrence.cancel: cancel flipped back (cancel -> bring back; bring back -> cancel with the old reason)
 *  - programme: the old sessions list replaced back
 */
export function inverseOf(step: WriteStep, before: StepBefore | null | undefined): WriteStep | null {
  if (!before) return null;
  if (step.target === 'programme') {
    return Array.isArray(before.payload) ? sameStep(step, null, before.payload as Record<string, unknown>[]) : null;
  }
  const c = step.command;
  if (!c) return null;
  const keys = Object.keys(c.payload ?? {});
  switch (c.kind) {
    case 'series.upsert':
    case 'occurrence.set_override': {
      if (!keys.length || !hasKeys(before, keys)) return null;
      return sameStep(step, { kind: c.kind, payload: Object.fromEntries(keys.map((k) => [k, before[k]])) });
    }
    case 'series.set_recurrence':
      return hasKeys(before, ['mode']) ? sameStep(step, { kind: c.kind, payload: { ...before } }) : null;
    case 'series.set_organisers':
      return Array.isArray(before.organiser_ids) ? sameStep(step, { kind: c.kind, payload: { organiser_ids: before.organiser_ids } }) : null;
    case 'series.set_program':
      return Array.isArray(before.days) ? sameStep(step, { kind: c.kind, payload: { days: before.days } }) : null;
    case 'series.set_lifecycle':
      return typeof before.to === 'string' ? sameStep(step, { kind: c.kind, payload: { to: before.to } }) : null;
    case 'occurrence.set_time':
      if (before.reset === true) return sameStep(step, { kind: c.kind, payload: { reset: true } });
      return typeof before.new_local_start === 'string'
        ? sameStep(step, { kind: c.kind, payload: { new_local_start: before.new_local_start, new_local_end: before.new_local_end ?? null } })
        : null;
    case 'occurrence.cancel': {
      if (typeof before.cancelled !== 'boolean') return null;
      if (before.cancelled) {
        const reason = typeof before.reason === 'string' ? before.reason : '';
        return sameStep(step, { kind: c.kind, payload: { cancelled: true, reason } });
      }
      return sameStep(step, { kind: c.kind, payload: { cancelled: false } });
    }
    default:
      return null;
  }
}
