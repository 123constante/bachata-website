import { describe, expect, it } from 'vitest';
import { BIO_LIMIT, heroBio, limitBioInput, bioLength } from '../organiserHeroBio';
import { checkAbout } from '@/modules/organiser/edit-in-place/fieldRules';

const words = (n: number) => {
  let s = '';
  while (s.length < n) s += 'dance ';
  return s.slice(0, n).trim();
};

const LENGTHS = [0, 40, 150, 151, 330];

describe('heroBio: bio length x header text', () => {
  it.each(LENGTHS)('bio of %i characters', (n) => {
    const bio = n === 0 ? '' : words(n);
    const r = heroBio(bio, 'London', 'Event Brand');
    if (n === 0) {
      expect(r).toEqual({ text: 'London · Event Brand', truncated: false, fallback: true });
    } else if (n <= 150) {
      expect(r).toEqual({ text: bio, truncated: false, fallback: false });
    } else {
      expect(r.truncated).toBe(true);
      expect(r.fallback).toBe(false);
      expect(r.text!.endsWith('…')).toBe(true);
      expect(Array.from(r.text!).length).toBeLessThanOrEqual(BIO_LIMIT + 1);
      expect(bio.startsWith(r.text!.slice(0, -1))).toBe(true);
    }
  });

  it('exactly 150 is whole, 151 is cut', () => {
    expect(heroBio('a'.repeat(150), null, null).truncated).toBe(false);
    const r = heroBio('a'.repeat(151), null, null);
    expect(r.truncated).toBe(true);
    expect(r.text).toBe('a'.repeat(150) + '…');
  });

  it('counts code points, not UTF-16 units', () => {
    expect(heroBio('\u{1F483}'.repeat(150), null, null).truncated).toBe(false);
  });

  it('does not mutate the input', () => {
    const bio = words(330);
    heroBio(bio, 'x', 'y');
    expect(bio).toBe(words(330));
  });

  it.each([
    ['London', 'Dance School', 'London · Dance School'],
    ['London', null, 'London'],
    [null, 'Dance School', 'Dance School'],
    [null, null, null],
    ['  ', '', null],
  ])('fallback %s + %s', (city, cat, want) => {
    const r = heroBio('   ', city, cat);
    expect(r.text).toBe(want);
    expect(r.fallback).toBe(want !== null);
  });
});

describe('limitBioInput: paste behaviour', () => {
  it('empty start: a 330 paste is cut at 150', () => {
    expect(bioLength(limitBioInput('x'.repeat(330), ''))).toBe(150);
  });
  it('loaded 330: nothing is cut, deleting is allowed', () => {
    const old = 'x'.repeat(330);
    expect(limitBioInput(old + 'y', old)).toBe(old + 'y');
    expect(limitBioInput('x'.repeat(200), old)).toBe('x'.repeat(200));
  });
  it('short edits pass through', () => {
    expect(limitBioInput('hello', '')).toBe('hello');
  });
});

describe('editor limit', () => {
  it.each([[0, true], [150, true], [151, false], [330, false]])('checkAbout(%i) ok=%s at 150', (n, ok) => {
    expect(checkAbout('a'.repeat(n), BIO_LIMIT).ok).toBe(ok);
  });
  it('the server ceiling stays 4000 by default', () => {
    expect(checkAbout('a'.repeat(330)).ok).toBe(true);
  });
});
