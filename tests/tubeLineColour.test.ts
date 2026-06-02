import { describe, expect, it } from 'vitest';
import { splitLineNames, resolveTubeLine } from '@/lib/tubeLineColour';

describe('splitLineNames', () => {
  it('splits a concatenated "and" string and drops the trailing "line"', () => {
    expect(splitLineNames('Jubilee and Northern line')).toEqual([
      'Jubilee',
      'Northern',
    ]);
  });

  it('splits "and" with a plural trailing "lines"', () => {
    expect(splitLineNames('Circle and District lines')).toEqual([
      'Circle',
      'District',
    ]);
  });

  it('splits a comma-separated list', () => {
    expect(splitLineNames('Jubilee, Northern')).toEqual(['Jubilee', 'Northern']);
  });

  it('splits a mixed comma + "and" list', () => {
    expect(splitLineNames('Jubilee, Northern and National Rail')).toEqual([
      'Jubilee',
      'Northern',
      'National Rail',
    ]);
  });

  it('leaves a single known line untouched', () => {
    expect(splitLineNames('Northern')).toEqual(['Northern']);
  });

  it('does not split known names that contain an ampersand', () => {
    expect(splitLineNames('Hammersmith & City line')).toEqual([
      'Hammersmith & City line',
    ]);
    expect(splitLineNames('Waterloo & City')).toEqual(['Waterloo & City']);
  });

  it('keeps "National Rail" as one line', () => {
    expect(splitLineNames('National Rail')).toEqual(['National Rail']);
  });

  it('returns an empty array for blank / nullish input', () => {
    expect(splitLineNames('')).toEqual([]);
    expect(splitLineNames('   ')).toEqual([]);
    expect(splitLineNames(null)).toEqual([]);
    expect(splitLineNames(undefined)).toEqual([]);
  });
});

describe('resolveTubeLine (refactor regression)', () => {
  it('resolves a known line to its palette colour', () => {
    const line = resolveTubeLine('Northern');
    expect(line.name).toBe('Northern');
    expect(line.bg).toBe('#000000');
  });

  it('falls back to the brass pill for an unknown string, keeping the text', () => {
    const line = resolveTubeLine('Jubilee and Northern line');
    expect(line.name).toBe('Jubilee and Northern line');
    expect(line.bg).toBe('#C28F4A');
  });
});
