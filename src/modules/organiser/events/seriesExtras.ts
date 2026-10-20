// The series-wide fields the admin editor has and the C37 rows lacked (P-SERIES,
// PARITY-GAP C06, C09b, C14): gallery, videos, the usual end, the price list.
// Pure. Each builder returns ONE series.upsert carrying `name` (the handler needs
// it) plus the one changed key, or null when nothing changed (an untouched Save
// sends nothing).

import { upsertCommand, type OwnerCommand } from '@/modules/organiser/shared/seriesCommands';
import { TEAM } from '@/modules/organiser/shared/eventState';
import type { EventWorkspace } from './eventModel';

const same = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/** Gallery or videos: ONE upsert with the new list, null when the list is unchanged. */
export function mediaCommand(ws: EventWorkspace, key: 'default_gallery' | 'default_video_urls', next: string[]): OwnerCommand | null {
  const before = key === 'default_gallery' ? ws.gallery : ws.videoUrls;
  const clean = next.map((v) => v.trim()).filter(Boolean);
  return same(before, clean) ? null : upsertCommand({ name: ws.series.name, [key]: clean });
}

export const countLabel = (n: number, one: string, many: string) => (n ? `${n} ${n === 1 ? one : many}` : 'Add');

// ---- C14 the usual end --------------------------------------------------------------

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
/** The server's bound on default_duration_minutes (apply_aggregate_write_p5: 1 to 1200). */
export const MAX_DURATION = 1200;

/** event_series_p5.default_duration as read ("05:00:00", "1 day 02:00:00") -> minutes; null when unset. */
export function durationMinutes(raw: string | null): number | null {
  if (!raw) return null;
  const m = /^(?:(\d+) days? )?(\d+):(\d{2})(?::\d{2})?$/.exec(raw.trim());
  if (!m) return null;
  return Number(m[1] ?? 0) * 1440 + Number(m[2]) * 60 + Number(m[3]);
}

/** The usual end as the row shows it ("01:00"), from the start and the stored length; '' when unknown. */
export function usualEnd(ws: EventWorkspace): string {
  const start = ws.series.default_local_start_time?.slice(0, 5) ?? '';
  const len = durationMinutes(ws.series.default_duration);
  if (!HHMM.test(start) || len === null) return '';
  const end = (minutesOf(start) + len) % 1440;
  return `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
}

/** Minutes from the start to a typed end; an end at or before the start is the next day. */
export function lengthTo(start: string, end: string): number | null {
  if (!HHMM.test(start) || !HHMM.test(end)) return null;
  const d = minutesOf(end) - minutesOf(start);
  return d > 0 ? d : d + 1440;
}

/** Why the typed end cannot be saved; null when it can. */
export function endProblem(ws: EventWorkspace, typed: string): string | null {
  const start = ws.series.default_local_start_time?.slice(0, 5) ?? '';
  if (!HHMM.test(start)) return 'Add the start time first';
  if (!HHMM.test(typed.trim())) return 'Use a time like 23:00';
  const len = lengthTo(start, typed.trim()) ?? 0;
  if (len > MAX_DURATION) return 'Choose an end within 20 hours of the start';
  return null;
}

/**
 * What saving the end does (prod _cmd_series_upsert_p5, read 2026-10-17): the
 * length is stored and every date ADDED from now on uses it; dates already
 * listed keep their times (only a new START time re-times them). Said plainly.
 */
export const END_CONSEQUENCE = 'Dates added from now on end at this time. Dates already listed keep their times; to change one, open it from Coming dates on the event.';

export function endCommand(ws: EventWorkspace, typed: string): OwnerCommand | null {
  if (endProblem(ws, typed) || typed.trim() === usualEnd(ws)) return null;
  const len = lengthTo(ws.series.default_local_start_time?.slice(0, 5) ?? '', typed.trim());
  return len === null ? null : upsertCommand({ name: ws.series.name, default_duration_minutes: len });
}

// ---- C09b the price list ------------------------------------------------------------

/** The keys an organiser may write on a price (prod _owner_passes_problem_p5). Quantity is admin-only. */
export const OWNER_PASS_KEYS = ['id', 'name', 'price', 'currency', 'description'] as const;
export const MAX_PASSES = 10;
export type Currency = 'GBP' | 'EUR' | 'USD';
export const CURRENCIES: Currency[] = ['GBP', 'EUR', 'USD'];
const SIGN: Record<Currency, string> = { GBP: '\u00a3', EUR: '\u20ac', USD: '$' };

export interface PriceRow { id: string; name: string; price: string; currency: Currency; description?: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRICE = /^\d{1,6}(\.\d{1,2})?$/;

const rawPasses = (ws: EventWorkspace): unknown[] => (Array.isArray(ws.series.passes) ? ws.series.passes : []);

/**
 * Why this price list cannot be changed here; null when it can. Every live
 * price list on prod (3, 2026-10-17) was set up by the team with keys an
 * organiser may not write (tier, type, quantity...): saving any of them would
 * be refused, so the row says so instead of offering a Save that fails.
 */
export function pricesLock(ws: EventWorkspace): string | null {
  const list = rawPasses(ws);
  const ok = list.length <= MAX_PASSES && list.every((p) => {
    if (!p || typeof p !== 'object') return false;
    const e = p as Record<string, unknown>;
    return Object.keys(e).every((k) => (OWNER_PASS_KEYS as readonly string[]).includes(k))
      && typeof e.id === 'string' && UUID.test(e.id) && typeof e.name === 'string'
      && (e.price === null || typeof e.price === 'number')
      && (e.currency === undefined || CURRENCIES.includes(e.currency as Currency));
  });
  return ok ? null : `This price list was set up by ${TEAM}, so it can't be changed here. Ask ${TEAM}.`;
}

export const passCount = (ws: EventWorkspace) => rawPasses(ws).length;

/** The stored list as editable rows (only when pricesLock is null). */
export function priceRows(ws: EventWorkspace): PriceRow[] {
  return rawPasses(ws).map((p) => {
    const e = p as Record<string, unknown>;
    return {
      id: String(e.id), name: String(e.name ?? ''), price: typeof e.price === 'number' ? String(e.price) : '',
      currency: (CURRENCIES.includes(e.currency as Currency) ? e.currency : 'GBP') as Currency,
      ...(typeof e.description === 'string' ? { description: e.description } : {}),
    };
  });
}

export const priceLabel = (r: Pick<PriceRow, 'price' | 'currency'>) => (r.price.trim() ? `${SIGN[r.currency]}${r.price.trim()}` : 'No price');

/** Why the rows cannot be saved; null when they can. */
export function pricesProblem(rows: PriceRow[]): string | null {
  if (rows.length > MAX_PASSES) return `Up to ${MAX_PASSES} prices`;
  for (const r of rows) {
    if (!r.name.trim()) return 'Give every price a name';
    if (r.name.trim().length > 120) return 'Keep each name under 120 characters';
    if (r.price.trim() && !PRICE.test(r.price.trim())) return 'Use a price like 12 or 12.50';
  }
  return null;
}

const toPass = (r: PriceRow) => ({
  id: r.id, name: r.name.trim(), price: r.price.trim() ? Number(r.price.trim()) : null, currency: r.currency,
  ...(r.description?.trim() ? { description: r.description.trim() } : {}),
});

/** ONE upsert with the whole list (only the owner keys); null when unchanged or not savable. */
export function pricesCommand(ws: EventWorkspace, rows: PriceRow[]): OwnerCommand | null {
  if (pricesLock(ws) || pricesProblem(rows)) return null;
  const next = rows.map(toPass);
  const before = priceRows(ws).map(toPass);
  if (JSON.stringify(next) === JSON.stringify(before)) return null;
  return upsertCommand({ name: ws.series.name, default_passes: next });
}

/** A new empty price; the id is a uuid (the server requires one, unique). */
export const newPriceRow = (currency: Currency = 'GBP'): PriceRow => ({ id: crypto.randomUUID(), name: '', price: '', currency });
