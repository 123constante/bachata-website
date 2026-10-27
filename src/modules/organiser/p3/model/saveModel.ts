import type { OwnerCommand } from '../../shared/seriesCommands';

/**
 * THE save model every P3 edit screen shares (owner decision, issue #26). Pure: no React.
 *
 * A screen keeps a draft beside the base it opened with. Only fields that differ are
 * "pending": they fill the tray ("Not saved yet \u00b7 2 changes"), arm the leave guard and
 * the "Undo my changes" link, and are the ONLY fields a save sends. An untouched save
 * sends nothing. A save is a short list of commands (usually one series.upsert); each
 * command keeps ONE idempotency key and the version it was first sent against until it
 * succeeds, so "Try again" after a dropped connection repeats the same write, never a
 * second one.
 */

/** One field of a draft: how to compare it and how the tray names a change to it. */
export interface FieldSpec<D> {
  key: keyof D & string;
  /** The tray line for a change, e.g. "Name: Friday Social" or "About this event". */
  line: (draft: D) => string;
  same?: (a: D[keyof D], b: D[keyof D]) => boolean;
}

const norm = (v: unknown): string => JSON.stringify(typeof v === 'string' ? v.trim() : v ?? null);
export const sameValue = (a: unknown, b: unknown): boolean => norm(a) === norm(b);

/** The fields that differ from what the screen opened with, in screen order. */
export function changedKeys<D>(specs: ReadonlyArray<FieldSpec<D>>, base: D, draft: D): Array<keyof D & string> {
  return specs.filter((s) => !(s.same ?? sameValue)(base[s.key], draft[s.key])).map((s) => s.key);
}

/** The tray's list: one line per changed field. */
export function pendingLines<D>(specs: ReadonlyArray<FieldSpec<D>>, base: D, draft: D): string[] {
  const changed = new Set(changedKeys(specs, base, draft));
  return specs.filter((s) => changed.has(s.key)).map((s) => s.line(draft));
}

/**
 * The tray's lines, checked against what a save would really send: changes the plan would not
 * send (a value the builder normalises back to the stored one) read as no changes, so Save is
 * off with "Nothing changed yet" and never a live button that sends nothing (PR #1082 r1 #2).
 * A blocked change keeps its lines: the Save button names the problem instead.
 */
export const trayLines = (lines: string[], plan: readonly OwnerCommand[], problem: string | null): string[] =>
  !problem && !plan.length ? [] : lines;

/** What the Save button says and whether it can be pressed; `why` names what to do when it cannot. */
export interface SaveButton {
  label: string;
  enabled: boolean;
  why: string | null;
}

export function saveButton(opts: { changed: number; problem: string | null; lock: string | null; busy: boolean; labels: { save: string; nothing: string } }): SaveButton {
  if (opts.lock) return { label: opts.labels.nothing, enabled: false, why: opts.lock };
  if (!opts.changed) return { label: opts.labels.nothing, enabled: false, why: null };
  if (opts.problem) return { label: opts.labels.save, enabled: false, why: opts.problem };
  return { label: opts.labels.save, enabled: !opts.busy, why: null };
}

// ---- one save attempt (retry reuses its keys) ------------------------------------------

export interface SaveStep {
  command: OwnerCommand;
  key: string;
  /** The version this step goes against; fixed from its first send so a retry is the same write. */
  version: number | null;
}

export interface SaveAttempt {
  /** The plan the steps were made for: a different plan is a different attempt. */
  sig: string;
  steps: SaveStep[];
  /** How many steps the server has taken (a retry starts at the next one). */
  done: number;
}

const sigOf = (plan: readonly OwnerCommand[]) => JSON.stringify(plan);

/**
 * The attempt to send for this plan: the held one when the plan is the same (a retry: same
 * keys, same versions, finished steps skipped), else a fresh one with new keys. The first
 * step goes against `version`; each later one gets its version when the one before it lands.
 */
export function attemptFor(held: SaveAttempt | null, plan: readonly OwnerCommand[], version: number | null, newKey: () => string): SaveAttempt {
  const sig = sigOf(plan);
  if (held && held.sig === sig && held.done < held.steps.length) return held;
  return { sig, steps: plan.map((command, i) => ({ command, key: newKey(), version: i === 0 ? version : null })), done: 0 };
}

/** The attempt after step `i` landed at `newVersion` (the next step goes against it). */
export function stepLanded(a: SaveAttempt, i: number, newVersion: number | null): SaveAttempt {
  const steps = a.steps.map((s, j) => (j === i + 1 && s.version == null ? { ...s, version: newVersion } : s));
  return { ...a, steps, done: i + 1 };
}

/**
 * Someone else saved since the screen opened: the stored version moved and it was not one of
 * this screen's own saves. The typing is kept; the screen says so (never a silent reset).
 */
export const changedElsewhere = (openedAt: number, now: number, own: ReadonlySet<number>): boolean =>
  now !== openedAt && !own.has(now);
