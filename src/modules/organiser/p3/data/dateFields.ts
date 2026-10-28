import { MAX_GALLERY, type EventWorkspace } from '../../events/eventModel';
import { priceLabel, priceRows, pricesLock, pricesProblem, toPass, type PriceRow } from '../../events/seriesExtras';
import type { OverridePatch } from '../../shared/seriesCommands';
import type { DateDetail } from '../../shared/seriesModel';
import { L } from '../model/labels';

/**
 * W3b-2: one date's own Name, Photos and Price (occurrence.set_override `title`, `gallery`,
 * `passes`), pure. Each builder answers the patch a save sends, or null when it would send
 * nothing (untouched, or typed back to what the date already shows). Typed back to the
 * series' value on a date that owns one = null for that key, the handler's inherit value.
 * Read back by event_view_p5 (event.name, photo_urls, meta_data_public.tickets); the calendar
 * reads the name only.
 */

/** The owner arm's title rule (apply_aggregate_write_p5 c_owner_title_max, the Website NAME_MAX). */
export const DATE_NAME_MAX = 80;

/** Why a date cannot have its own name, photos or price, or null. A festival's are the whole festival's. */
export function dateFieldsWhy(ws: EventWorkspace): string | null {
  return ws.series.format === 'festival' || ws.series.festival_id ? L.dateFieldsFestival : null;
}

// ---- name ------------------------------------------------------------------------------

export const dateNameOf = (ws: EventWorkspace, detail: DateDetail | null): string => detail?.titleOverride ?? ws.series.name;

export function dateNameProblem(text: string): string | null {
  if (!text.trim()) return L.dateNameBlank;
  if (text.trim().length > DATE_NAME_MAX) return L.dateNameLong(DATE_NAME_MAX);
  return null;
}

export function dateNamePatch(ws: EventWorkspace, detail: DateDetail | null, text: string): OverridePatch | null {
  const next = text.trim();
  if (dateNameProblem(next) || next === dateNameOf(ws, detail).trim()) return null;
  if (next === ws.series.name.trim()) return detail?.titleOverride != null ? { title: null } : null;
  return { title: next };
}

// ---- photos ----------------------------------------------------------------------------

const seriesGallery = (ws: EventWorkspace): string[] => ws.gallery;
export const dateGalleryOf = (ws: EventWorkspace, detail: DateDetail | null): string[] => detail?.galleryOverride ?? seriesGallery(ws);
const sameList = (a: string[], b: string[]) => JSON.stringify(a) === JSON.stringify(b);

export function dateGalleryPatch(ws: EventWorkspace, detail: DateDetail | null, next: string[]): OverridePatch | null {
  if (next.length > MAX_GALLERY || sameList(next, dateGalleryOf(ws, detail))) return null;
  if (sameList(next, seriesGallery(ws))) return detail?.galleryOverride != null ? { gallery: null } : null;
  return { gallery: next };
}

export const photosWord = (n: number) => (n ? `${n} ${n === 1 ? 'photo' : 'photos'}` : L.datePhotosNone);

// ---- price -----------------------------------------------------------------------------

/** The series rules run on the date's own list: the same lock, rows and problems (events/seriesExtras), never a copy. */
const asList = (ws: EventWorkspace, passes: unknown[]): EventWorkspace => ({ ...ws, series: { ...ws.series, passes } });

/** Why the price cannot be changed for this date (a list the team set up, here or on the series), or null. */
export function datePricesLock(ws: EventWorkspace, detail: DateDetail | null): string | null {
  return detail?.passesOverride != null ? pricesLock(asList(ws, detail.passesOverride)) : pricesLock(ws);
}

export function datePriceRows(ws: EventWorkspace, detail: DateDetail | null): PriceRow[] {
  if (datePricesLock(ws, detail)) return [];
  return detail?.passesOverride != null ? priceRows(asList(ws, detail.passesOverride)) : priceRows(ws);
}

const sent = (rows: PriceRow[]) => JSON.stringify(rows.map(toPass));

export const datePricesProblem = pricesProblem;

export function datePricesPatch(ws: EventWorkspace, detail: DateDetail | null, rows: PriceRow[]): OverridePatch | null {
  if (datePricesLock(ws, detail) || pricesProblem(rows) || sent(rows) === sent(datePriceRows(ws, detail))) return null;
  if (!pricesLock(ws) && sent(rows) === sent(priceRows(ws))) return detail?.passesOverride != null ? { passes: null } : null;
  return { passes: rows.map(toPass) };
}

export const pricesWord = (rows: PriceRow[]) =>
  (rows.length ? rows.map((r) => `${r.name.trim() || L.noName} ${priceLabel(r)}`).join(' · ') : L.datePricesNone);
