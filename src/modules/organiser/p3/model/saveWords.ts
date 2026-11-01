import { L } from './labels';

/**
 * The words of an event-wide save (Details, Prices). ONE mapping, so the two screens never
 * disagree: an event with exactly one date says "Save" and "Saved." (there is no "all dates"
 * to name); anything else says "Save for all dates" and "Saved for every date.".
 */
export interface SaveWords {
  save: string;
  nothing: string;
  detailsSaved: string;
  pricesSaved: string;
}

/** Exactly one date: the page holds one and the series total (when known) agrees. */
export const hasOneDate = (listed: number, total: number | null): boolean => listed === 1 && (total === null || total === 1);

export function saveWordsFor(oneDate: boolean): SaveWords {
  return oneDate
    ? { save: L.saveOneDateEvent, nothing: L.nothingChanged, detailsSaved: L.detailsSavedOne, pricesSaved: L.detailsSavedOne }
    : { save: L.saveAll, nothing: L.nothingChanged, detailsSaved: L.detailsSaved, pricesSaved: L.pricesSaved };
}
