import type { VenueOption } from '../shared/publicVenues';

/** "Add a new venue" needs at least this many typed letters (trimmed). */
export const MIN_ADD_LETTERS = 2;

export type SearchShape = 'idle' | 'none' | 'exact' | 'partial';
export interface VenueSearch {
  shape: SearchShape;
  results: VenueOption[];
  /** "+ Add a new venue" is offered: 2+ letters typed. It sits under the results. */
  canAdd: boolean;
}

const fold = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

/** Exact name matches first, then names that start with the text, then names or postcodes containing it. */
export function searchVenues(options: readonly VenueOption[], query: string): VenueSearch {
  const q = fold(query);
  if (!q) return { shape: 'idle', results: [], canAdd: false };
  const rank = (v: VenueOption): number => {
    const n = fold(v.name);
    if (n === q) return 0;
    if (n.startsWith(q)) return 1;
    if (n.includes(q)) return 2;
    if (fold(v.postcode ?? '').replace(/ /g, '').includes(q.replace(/ /g, ''))) return 3;
    return -1;
  };
  const ranked = options
    .map((v) => ({ v, r: rank(v) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.v.name.localeCompare(b.v.name));
  const results = ranked.map((x) => x.v);
  const shape: SearchShape = results.length === 0 ? 'none' : ranked[0].r === 0 ? 'exact' : 'partial';
  return { shape, results, canAdd: q.length >= MIN_ADD_LETTERS };
}
