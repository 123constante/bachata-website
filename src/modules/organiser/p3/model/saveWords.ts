import { L } from './labels';

/**
 * The words of every P3 save: the event-wide saves (Details, Prices) and the session sheet's toasts.
 * ONE mapping of two facts, so no screen disagrees with another:
 *  - the date count: an event with exactly one date says "Save" and "Saved." (there is no "all dates"
 *    to name); anything else says "Save for all dates" and "Saved for every date.";
 *  - the series lifecycle_status (ws.series.lifecycle_status): only a LIVE event says dancers see it now.
 *    A draft says it is a draft and dancers do not see it yet; a paused event says it is hidden from the calendar
 *    (P3's own word for paused; a paused page with a past date can still show publicly, so no claim about dancers);
 *    ended, archived, cancelled, null, '' or any other value says nothing about dancers either way.
 * The live words are the words main shipped before the lifecycle mattered, byte for byte.
 */
export interface SaveWords {
  save: string;
  nothing: string;
  detailsSaved: string;
  pricesSaved: string;
  /** Toast after an all-dates SCOPED save from the "Which dates?" sheet; names the field(s) that changed. */
  detailsSavedScoped: (word: string) => string;
  /** Session sheet toasts after a programme write (the date count does not change them). */
  savedEvery: string;
  savedDate: (day: string) => string;
  addedEvery: string;
  addedDate: (day: string) => string;
}

/** One date, or none (a draft): nothing to name "all dates" for. The series total (when known) agrees. */
export const hasOneDate = (listed: number, total: number | null): boolean => listed <= 1 && (total === null || total <= 1);

type Life = 'live' | 'draft' | 'paused' | 'quiet';
const lifeOf = (lifecycle: string | null | undefined): Life =>
  lifecycle === 'live' || lifecycle === 'draft' || lifecycle === 'paused' ? lifecycle : 'quiet';

type Said = Omit<SaveWords, 'save' | 'nothing' | 'detailsSaved' | 'pricesSaved' | 'detailsSavedScoped'> & {
  detailsScopedAll: (word: string) => string;
  detailsSavedOne: string;
  detailsSavedAll: string;
  pricesSavedAll: string;
};

const SAID: Record<Life, Said> = {
  live: {
    detailsSavedOne: 'Saved. Dancers see it now.',
    detailsSavedAll: 'Saved for all dates. Dancers see it now. A date with its own pictures keeps them.',
    pricesSavedAll: 'Prices saved. Dancers see them now.',
    detailsScopedAll: (w) => `Saved the ${w} for all dates. Dancers see it now.`,
    savedEvery: 'Saved for every date. Dancers see it now.',
    savedDate: (day) => `Saved for ${day} only. Dancers see it now.`,
    addedEvery: 'Session added to every date. Dancers see it now.',
    addedDate: (day) => `Added to ${day} only. Dancers see it now.`,
  },
  draft: {
    detailsSavedOne: 'Saved as a draft. Dancers do not see it yet.',
    detailsSavedAll: 'Saved for all dates as a draft. Dancers do not see it yet. A date with its own pictures keeps them.',
    pricesSavedAll: 'Prices saved as a draft. Dancers do not see them yet.',
    detailsScopedAll: (w) => `Saved the ${w} for all dates as a draft. Dancers do not see it yet.`,
    savedEvery: 'Saved for every date as a draft. Dancers do not see it yet.',
    savedDate: (day) => `Saved for ${day} only, as a draft. Dancers do not see it yet.`,
    addedEvery: 'Session added to every date as a draft. Dancers do not see it yet.',
    addedDate: (day) => `Added to ${day} only, as a draft. Dancers do not see it yet.`,
  },
  paused: {
    detailsSavedOne: 'Saved. It is hidden from the calendar.',
    detailsSavedAll: 'Saved for all dates. It is hidden from the calendar. A date with its own pictures keeps them.',
    pricesSavedAll: 'Prices saved. The event is hidden from the calendar.',
    detailsScopedAll: (w) => `Saved the ${w} for all dates. It is hidden from the calendar.`,
    savedEvery: 'Saved for every date. It is hidden from the calendar.',
    savedDate: (day) => `Saved for ${day} only. It is hidden from the calendar.`,
    addedEvery: 'Session added to every date. It is hidden from the calendar.',
    addedDate: (day) => `Added to ${day} only. It is hidden from the calendar.`,
  },
  quiet: {
    detailsSavedOne: 'Saved.',
    detailsSavedAll: 'Saved for all dates. A date with its own pictures keeps them.',
    pricesSavedAll: 'Prices saved.',
    detailsScopedAll: (w) => `Saved the ${w} for all dates.`,
    savedEvery: 'Saved for every date.',
    savedDate: (day) => `Saved for ${day} only.`,
    addedEvery: 'Session added to every date.',
    addedDate: (day) => `Added to ${day} only.`,
  },
};

export function saveWordsFor(oneDate: boolean, lifecycle: string | null | undefined): SaveWords {
  const s = SAID[lifeOf(lifecycle)];
  const session = { savedEvery: s.savedEvery, savedDate: s.savedDate, addedEvery: s.addedEvery, addedDate: s.addedDate };
  return oneDate
    ? { save: L.saveOneDateEvent, nothing: L.nothingChanged, detailsSaved: s.detailsSavedOne, pricesSaved: s.detailsSavedOne, detailsSavedScoped: s.detailsScopedAll, ...session }
    : { save: L.saveAll, nothing: L.nothingChanged, detailsSaved: s.detailsSavedAll, pricesSaved: s.pricesSavedAll, detailsSavedScoped: s.detailsScopedAll, ...session };
}

/** The line a save adds when some dates kept their own value (from the reply's kept_dates, never the preview). '' when none. */
export const keptDatesLine = (m: number, word: string): string =>
  m <= 0 ? '' : m === 1 ? `1 date kept its own ${word}.` : `${m} dates kept their own ${word}.`;
