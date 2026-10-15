import { describe, it, expect } from 'vitest';
import { normalizeGenreToken, genreLabel, GENRE_TOKENS, genreFilterTokens } from '../genreSynonyms';

describe('genreSynonyms', () => {
  it('folds social/socials to party', () => {
    expect(normalizeGenreToken('social')).toBe('party');
    expect(normalizeGenreToken('Social')).toBe('party');
    expect(normalizeGenreToken('  SOCIALS ')).toBe('party');
  });

  it('passes canonical genre tokens through unchanged', () => {
    for (const t of GENRE_TOKENS) {
      expect(normalizeGenreToken(t)).toBe(t);
    }
  });

  it('lowercases + trims unknown tokens without inventing a fold', () => {
    expect(normalizeGenreToken(' Class ')).toBe('class');
    expect(normalizeGenreToken('Bootcamp')).toBe('bootcamp');
  });

  it('genreLabel never renders "Social" — it shows Party', () => {
    expect(genreLabel('social')).toBe('Party');
    expect(genreLabel('class')).toBe('Class');
    expect(genreLabel('masterclass')).toBe('Masterclass');
  });
});

// FIX-7 R1: the search RPC filter is `es.category = ANY (p_category)`. New
// events never store `workshop` (the Workshop create chip seeds a class
// session; the server derives `class`), so the Class chip must also match
// masterclass + workshop. The Workshop chip stays for legacy rows.
describe('genreFilterTokens -- stored word x Search chip', () => {
  const matches = (stored: string, chip: string) => genreFilterTokens([chip]).includes(stored);
  it.each([
    // stored        party  class  workshop masterclass
    ['party',       [true,  false, false,   false]],
    ['class',       [false, true,  false,   false]],
    ['workshop',    [false, true,  true,    false]],
    ['masterclass', [false, true,  false,   true]],
  ] as const)('stored %s', (stored, row) => {
    expect(['party', 'class', 'workshop', 'masterclass'].map((chip) => matches(stored, chip))).toEqual(row);
  });
  it('folds synonyms and dedupes', () => {
    expect(genreFilterTokens(['social', 'Party'])).toEqual(['party']);
    expect(genreFilterTokens(['class', 'workshop'])).toEqual(['class', 'masterclass', 'workshop']);
    expect(genreFilterTokens([])).toEqual([]);
  });
});
