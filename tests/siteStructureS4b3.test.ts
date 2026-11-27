import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { meta as videoMeta } from '../app/routes/list.videographers';
import { meta as allMeta } from '../app/routes/list.all-profiles';

type Tag = Record<string, string>;
const run = (m: unknown) => (m as (a: unknown) => Tag[])({}) as Tag[];

describe('S4b-3 people list routes', () => {
  it.each([
    ['videographers', videoMeta, 'Bachata Videographers', '/videographers'],
    ['all-profiles', allMeta, 'All Bachata Profiles', '/all-profiles'],
  ])('%s meta has title and canonical', (_n, m, words, path) => {
    const tags = run(m);
    expect(tags[0].title).toContain(words);
    const canon = tags.find((t) => t.rel === 'canonical');
    expect(canon?.href.endsWith(path)).toBe(true);
  });

  it('routes.ts registers both paths inside the flag gate', () => {
    const src = readFileSync('app/routes.ts', 'utf8');
    // Three slices each have their own gate block; anchor on this slice's comment.
    const i = src.indexOf('VITE_ENABLE_PEOPLE_SSR === "true"', src.indexOf('(site structure S4b-3)'));
    expect(i).toBeGreaterThan(-1);
    const block = src.slice(i, src.indexOf(': []', i));
    expect(block).toContain('route("videographers", "routes/list.videographers.tsx")');
    expect(block).toContain('route("all-profiles", "routes/list.all-profiles.tsx")');
  });
});
