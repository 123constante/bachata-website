import { L } from './labels';

/**
 * The words of every save confirmation. ONE mapping, a function of BOTH facts:
 *  - oneDate: an event with exactly one date says "Save" and "Saved." (there is no "all dates"
 *    to name); anything else says "Save for all dates" and "Saved for every date.".
 *  - lifecycle (event_series_p5.lifecycle_status; prod today: archived 653, live 69, ended 21,
 *    draft 14, paused 2). Only `live` may say dancers see it now. Draft says they do not yet; paused
 *    says they do not while it is paused; ended, archived, cancelled, null and anything unknown say
 *    nothing about dancers at all (no claim we cannot back).
 */
export interface SaveWords {
  save: string;
  nothing: string;
  detailsSaved: string;
  pricesSaved: string;
  savedEvery: string;
  savedDate: (day: string) => string;
  addedEvery: string;
  addedDate: (day: string) => string;
}

type Tone = 'live' | 'draft' | 'paused' | 'silent';

export function toneOf(lifecycle: string | null | undefined): Tone {
  if (lifecycle === 'live') return 'live';
  if (lifecycle === 'draft') return 'draft';
  if (lifecycle === 'paused') return 'paused';
  return 'silent';
}

/** One date, or none (a draft): nothing to name "all dates" for. The series total (when known) agrees. */
export const hasOneDate = (listed: number, total: number | null): boolean => listed <= 1 && (total === null || total <= 1);

const PICTURES_TAIL = ' A date with its own pictures keeps them.';

export function saveWordsFor(oneDate: boolean, lifecycle: string | null | undefined): SaveWords {
  const t = toneOf(lifecycle);
  // [what was saved] + [how dancers stand] + optional tail
  const s = (what: string, they: string, tail = ''): string => {
    if (t === 'live') return `${what}. Dancers see ${they} now.${tail}`;
    if (t === 'draft') return `${what} as a draft. Dancers do not see ${they} yet.${tail}`;
    if (t === 'paused') return `${what}. It is paused, so dancers do not see ${they}.${tail}`;
    return `${what}.${tail}`;
  };
  return {
    save: oneDate ? L.saveOneDateEvent : L.saveAll,
    nothing: L.nothingChanged,
    detailsSaved: oneDate ? s('Saved', 'it') : s('Saved for all dates', 'it', PICTURES_TAIL),
    pricesSaved: oneDate ? s('Saved', 'it') : s('Prices saved', 'them'),
    savedEvery: s('Saved for every date', 'it'),
    savedDate: (day) => s(`Saved for ${day} only`, 'it'),
    addedEvery: s('Session added to every date', 'it'),
    addedDate: (day) => s(`Added to ${day} only`, 'it'),
  };
}
