import { describe, it, expect } from 'vitest';
import { normalizeGenreToken, genreLabel, GENRE_TOKENS } from '../genreSynonyms';

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
