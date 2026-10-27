import { L } from './labels';
import type { IsoDate, P3Kind } from './types';

/**
 * ONE rule set for the session and line-up sheets (W2d): which control is on for
 * which event kind x date state x scope, and the plain reason when it is not.
 * Pure. The sheets read nothing else to decide; a control that is greyed shows
 * this reason under it, never hides.
 *
 * Every date = series.set_program (behind parityGate AW1_APPLIED, passed in as
 * `gate`); Just this date = organiser_set_occurrence_programme_v1, which the
 * server refuses on cancelled, past, multi-day and ended dates (its reader says
 * so in `editable` / `not_editable_reason`).
 */

export type Scope = 'every' | 'date';
export type SessionDateState = 'coming' | 'today' | 'past' | 'cancelled';

/** The controls a session sheet can show. */
export type ProgrammeControl =
  | 'save'        // save the session's name, times, levels (and kind / room on every date)
  | 'kind'        // "What is it?"
  | 'add'         // add a session (every date, or this date only)
  | 'removeAll'   // remove from every date
  | 'removeOne'   // remove a session added to this date only
  | 'notRunning'  // not running on this date / bring it back
  | 'lineup';     // change the line-up

export interface ProgrammeFacts {
  kind: P3Kind;
  /** The series lifecycle_status. */
  lifecycle: string;
  /** parityGate AW1_APPLIED: series.set_program is admitted for owners. */
  gate: boolean;
  scope: Scope;
  /** The date a "Just this date" scope acts on; null when there is none. */
  date?: {
    state: SessionDateState;
    /** The per-date reader's verdict once loaded (undefined while loading). */
    editable?: boolean;
    notEditableReason?: string | null;
  } | null;
  /** The session the sheet is open on; null for a new one. */
  item?: { extra: boolean; notRunning: boolean; stored: boolean } | null;
}

export const PROGRAMME_WHY = {
  festival: L.festivalAsk,
  ended: 'This event has ended or is archived, so its sessions cannot be changed here. Ask the Bachata Calendar team if something needs fixing.',
  gate: 'Needs the next platform update',
  noDate: 'No date is coming up, so there is no date to change on its own.',
  past: 'This date has already happened, so its sessions can no longer be changed.',
  cancelled: 'This date is cancelled, so its sessions cannot be changed. Put the date back on first if it is happening.',
  multiDay: 'This event runs over more than one day, so one date\u2019s sessions cannot be changed here. Ask the Bachata Calendar team.',
  loading: 'Loading this date\u2019s sessions\u2026',
  kindOneDate: 'The kind of a session is the same on every date. Change it under Every date.',
  kindExisting: 'Only the Bachata Calendar team can change the kind of a session once it is added.',
  notRunning: 'It is not running on this date. Bring it back first.',
  oneDateOnly: 'Only a session added to this date alone can be removed from it. Use \u201cNot running this date\u201d instead.',
  extraOnly: 'This session was added to this date only. Remove it from this date instead.',
  everyOnly: 'This session was added to one date only, so it is not on every date.',
  everyScope: 'Pick Every date above to remove it from every date.',
} as const;

const NOT_EDITABLE: Record<string, string> = {
  series_closed: PROGRAMME_WHY.ended,
  multi_day: PROGRAMME_WHY.multiDay,
  date_cancelled: PROGRAMME_WHY.cancelled,
  past_date: PROGRAMME_WHY.past,
};

/** The date state the rules read: cancelled wins, then past / today / coming (London days). */
export function dateStateOf(date: IsoDate, cancelled: boolean, today: IsoDate): SessionDateState {
  if (cancelled) return 'cancelled';
  return date < today ? 'past' : date === today ? 'today' : 'coming';
}

/** Why NOTHING in this scope can change (event-wide or date-wide), or null. */
export function scopeWhy(f: ProgrammeFacts): string | null {
  if (f.kind === 'festival') return PROGRAMME_WHY.festival;
  if (f.lifecycle === 'ended' || f.lifecycle === 'archived') return PROGRAMME_WHY.ended;
  if (f.scope === 'every') return f.gate ? null : PROGRAMME_WHY.gate;
  const d = f.date;
  if (!d) return PROGRAMME_WHY.noDate;
  if (d.state === 'cancelled') return PROGRAMME_WHY.cancelled;
  if (d.state === 'past') return PROGRAMME_WHY.past;
  if (d.editable === false) return NOT_EDITABLE[d.notEditableReason ?? ''] ?? PROGRAMME_WHY.ended;
  if (d.editable === undefined) return PROGRAMME_WHY.loading;
  return null;
}

/** Every control's reason in this scope: null = on. One table, read by both sheets and the matrix test. */
export function programmeRules(f: ProgrammeFacts): Record<ProgrammeControl, string | null> {
  const base = scopeWhy(f);
  const it = f.item ?? null;
  const every = f.scope === 'every';
  const off = (why: string | null) => base ?? why;
  return {
    save: off(it?.notRunning && !every ? PROGRAMME_WHY.notRunning : it?.extra && every ? PROGRAMME_WHY.everyOnly : null),
    kind: off(!every && it?.stored ? (it.extra ? PROGRAMME_WHY.kindExisting : PROGRAMME_WHY.kindOneDate) : it?.extra && every ? PROGRAMME_WHY.everyOnly : null),
    add: off(null),
    removeAll: off(!every ? PROGRAMME_WHY.everyScope : it?.extra ? PROGRAMME_WHY.extraOnly : null),
    removeOne: off(every || !it?.extra ? PROGRAMME_WHY.oneDateOnly : null),
    notRunning: off(every ? PROGRAMME_WHY.oneDateOnly : it?.extra ? PROGRAMME_WHY.extraOnly : null),
    lineup: off(it?.notRunning && !every ? PROGRAMME_WHY.notRunning : it?.extra && every ? PROGRAMME_WHY.everyOnly : null),
  };
}

/**
 * The controls a sheet SHOWS in a scope (the others belong to the other scope and are
 * not drawn, so no copy points at a control that is missing). New session: save + kind.
 */
export function shownControls(scope: Scope, item: ProgrammeFacts['item']): ProgrammeControl[] {
  if (!item) return ['kind', 'save'];
  if (scope === 'every') return ['kind', 'save', 'lineup', 'removeAll'];
  if (item.notRunning) return ['notRunning'];
  return item.extra ? ['kind', 'save', 'lineup', 'removeOne'] : ['kind', 'save', 'lineup', 'notRunning'];
}
