// Brief fix-gate-lost-edit: an edit the onboarding gate refused is KEPT, for that event only, so the person who
// taps Continue, finishes (or not) the checklist and comes "Back to your event" finds the same sheet pre-filled.
// sessionStorage only (gone when the tab closes), at most 60 minutes old, one entry per event id, never sent
// anywhere. Reading it never saves: the person taps Save again (returnTo.ts: the refused edit is never replayed).
import type { RepeatDraft } from '../model/repeat';
import type { DetailsDraft } from '../data/details';
import type { PricesDraft } from '../data/prices';
import { PAYMENT_METHODS, type PaymentMethod } from '../../events/paymentModel';
import { CURRENCIES, type Currency, type PriceRow } from '../../events/seriesExtras';

/**
 * The screens whose unsaved draft is kept. Repeat (fix-gate-lost-edit), Details and Prices (p3-gate-retry-1:
 * F-13 b, the screens are open and the gate answers at Save). Dates is not (see the PR body): Back still works.
 */
export type KeptScreen = 'repeat' | 'details' | 'prices';
export type Kept =
  | { screen: 'repeat'; draft: RepeatDraft }
  // `base`: what the screen opened with when the edit was refused, so only the person's OWN changes are laid back
  // over the event as it is now (a teammate's save in between is never undone; review r1 #1)
  | { screen: 'details'; draft: DetailsDraft; base: DetailsDraft }
  | { screen: 'prices'; draft: PricesDraft; base: PricesDraft };

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
  // the editor's ranges (model/repeat RepeatDraft): anything else came from another build and is dropped
  const day = (x: number) => x >= 0 && x <= 6;
  if (!weekdays.every(day) || !day(r.weekday) || r.interval < 1 || r.interval > 4 || r.day < 1 || r.day > 31) return null;
  if (!nths.every((x) => x === -1 || (x >= 1 && x <= 4))) return null;
  if (!Number.isNaN(count) && (count < 1 || count > 500)) return null;
  const draft: RepeatDraft = { freq: r.freq, weekdays, interval: r.interval, monthBy: r.monthBy, day: r.day, nths, weekday: r.weekday, end: r.end, count, until: r.until };
  return draft;
}

const isStr = (x: unknown): x is string => typeof x === 'string';
const strs = (x: unknown): string[] | null => (Array.isArray(x) && x.every(isStr) ? [...x] : null);

/** A stored Details draft back to a DetailsDraft, or null when any field is not one the screen can show. */
export function detailsDraftFrom(raw: unknown): DetailsDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const music = strs(r.music);
  const gallery = strs(r.gallery);
  if (!music || !gallery || !(r.venueId === null || isStr(r.venueId))) return null;
  const { name, description, ticket, cover, instagram, videos, chat } = r;
  if (![name, description, ticket, cover, instagram, videos, chat].every(isStr)) return null;
  return {
    name: name as string, description: description as string, music, venueId: r.venueId as string | null, ticket: ticket as string,
    cover: cover as string, instagram: instagram as string, videos: videos as string, chat: chat as string, gallery,
  };
}

/** A stored Prices draft back to a PricesDraft, or null when a method, row or currency is not one the screen knows. */
export function pricesDraftFrom(raw: unknown): PricesDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const methods = strs(r.methods);
  if (!methods || !methods.every((m) => (PAYMENT_METHODS as readonly string[]).includes(m)) || !Array.isArray(r.rows)) return null;
  const rows: PriceRow[] = [];
  for (const x of r.rows as unknown[]) {
    const e = (x ?? {}) as Record<string, unknown>;
    if (!isStr(e.id) || !isStr(e.name) || !isStr(e.price) || !CURRENCIES.includes(e.currency as Currency)) return null;
    if (e.description !== undefined && !isStr(e.description)) return null;
    rows.push({ id: e.id, name: e.name, price: e.price, currency: e.currency as Currency, ...(isStr(e.description) ? { description: e.description } : {}) });
  }
  return { methods: methods as PaymentMethod[], rows };
}

/**
 * The kept edit laid over the event as it is NOW: only the fields the person changed (draft != the base they
 * opened with) come from the kept copy; every other field is today's stored value. `skip`: fields the screen
 * cannot send now (Prices rows the team has since locked) stay today's value.
 */
export function overNow<D extends object>(now: D, kept: { draft: D; base: D }, skip: ReadonlyArray<keyof D> = []): D {
  const out = { ...now };
  for (const k of Object.keys(kept.draft) as Array<keyof D>) {
    if (skip.includes(k)) continue;
    if (JSON.stringify(kept.draft[k]) !== JSON.stringify(kept.base[k])) out[k] = kept.draft[k];
  }
  return out;
}

/** The navigation state the checklist's "Back to your event" carries: only that arrival reopens a kept edit. */
export const KEPT_BACK_STATE = { p3KeptBack: true } as const;
export const cameBackForKept = (state: unknown): boolean =>
  !!state && typeof state === 'object' && (state as { p3KeptBack?: unknown }).p3KeptBack === true;

/** Keep `draft` for event `seriesId` (replaces anything kept for it). Storage that throws keeps nothing. */
export function keepDraft(seriesId: string, kept: Kept, now = Date.now(), s: Store | null = store()): void {
  if (!s || !seriesId) return;
  try {
    s.setItem(keptKey(seriesId), JSON.stringify({ v: 1, ...kept, at: now }));
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
    const k = JSON.parse(raw) as { v?: unknown; screen?: unknown; draft?: unknown; base?: unknown; at?: unknown } | null;
    if (!k || k.v !== 1 || typeof k.at !== 'number' || now - k.at > KEPT_MAX_AGE_MS || now < k.at) return null;
    if (k.screen === 'repeat') {
      const draft = repeatDraftFrom(k.draft);
      return draft ? { screen: 'repeat', draft } : null;
    }
    if (k.screen === 'details') {
      const draft = detailsDraftFrom(k.draft);
      const base = detailsDraftFrom(k.base);
      return draft && base ? { screen: 'details', draft, base } : null;
    }
    if (k.screen === 'prices') {
      const draft = pricesDraftFrom(k.draft);
      const base = pricesDraftFrom(k.base);
      return draft && base ? { screen: 'prices', draft, base } : null;
    }
    return null;
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
