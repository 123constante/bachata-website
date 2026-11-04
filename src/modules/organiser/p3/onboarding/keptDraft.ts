// Brief fix-gate-lost-edit: an edit the onboarding gate refused is KEPT, for that event only, so the person who
// taps Continue, finishes (or not) the checklist and comes "Back to your event" finds the same sheet pre-filled.
// sessionStorage only (gone when the tab closes), at most 60 minutes old, one entry per event id, never sent
// anywhere. Reading it never saves: the person taps Save again (returnTo.ts: the refused edit is never replayed).
import { blankDraft, type RepeatDraft } from '../model/repeat';

/** The screens whose unsaved draft is kept. Details / Prices / Dates are not (see the PR body): Back still works. */
export type KeptScreen = 'repeat';
export type Kept = { screen: 'repeat'; draft: RepeatDraft };

export const KEPT_COPY = { line: 'We kept your changes' } as const;
export const KEPT_MAX_AGE_MS = 60 * 60 * 1000;
export const keptKey = (seriesId: string): string => `p3-kept-edit:${seriesId}`;

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const store = (): Store | null => {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
};

const isInt = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x);
const ints = (x: unknown): number[] | null => (Array.isArray(x) && x.every(isInt) ? [...x] : null);

/** A stored Repeat draft back to a RepeatDraft, or null when any field is not one the editor can show. */
export function repeatDraftFrom(raw: unknown): RepeatDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const weekdays = ints(r.weekdays);
  const nths = ints(r.nths);
  if (r.freq !== 'weekly' && r.freq !== 'monthly') return null;
  if (r.monthBy !== 'day' && r.monthBy !== 'nth') return null;
  if (r.end !== 'none' && r.end !== 'after_count' && r.end !== 'until_date') return null;
  if (!weekdays || !nths || !isInt(r.interval) || !isInt(r.day) || !isInt(r.weekday) || typeof r.until !== 'string') return null;
  // An empty count box (NaN) is stored as null by JSON.
  const count = r.count === null ? Number.NaN : isInt(r.count) ? r.count : null;
  if (count === null) return null;
  return { ...blankDraft(r.weekday), freq: r.freq, weekdays, interval: r.interval, monthBy: r.monthBy, day: r.day, nths, weekday: r.weekday, end: r.end, count, until: r.until } as RepeatDraft;
}

/** Keep `draft` for event `seriesId` (replaces anything kept for it). Storage that throws keeps nothing. */
export function keepDraft(seriesId: string, kept: Kept, now = Date.now(), s: Store | null = store()): void {
  if (!s || !seriesId) return;
  try {
    s.setItem(keptKey(seriesId), JSON.stringify({ v: 1, screen: kept.screen, draft: kept.draft, at: now }));
  } catch {
    /* full or blocked: nothing kept, Back still works */
  }
}

/** What is kept for event `seriesId`, or null (none, older than 60 minutes, another shape). Never removes. */
export function keptDraft(seriesId: string, now = Date.now(), s: Store | null = store()): Kept | null {
  if (!s || !seriesId) return null;
  try {
    const raw = s.getItem(keptKey(seriesId));
    if (!raw) return null;
    const k = JSON.parse(raw) as { v?: unknown; screen?: unknown; draft?: unknown; at?: unknown } | null;
    if (!k || k.v !== 1 || typeof k.at !== 'number' || now - k.at > KEPT_MAX_AGE_MS || now < k.at) return null;
    if (k.screen !== 'repeat') return null;
    const draft = repeatDraftFrom(k.draft);
    return draft ? { screen: 'repeat', draft } : null;
  } catch {
    return null;
  }
}

/** Forget what is kept for event `seriesId` (saved, closed, or shown once). */
export function dropKept(seriesId: string, s: Store | null = store()): void {
  if (!s || !seriesId) return;
  try {
    s.removeItem(keptKey(seriesId));
  } catch {
    /* nothing to do */
  }
}
