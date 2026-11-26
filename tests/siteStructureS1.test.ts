// Site structure arc S1 (docs/arcs/site-structure.md, "Removed (S1)"):
// /choreography and /practice-partners are retired. Every old address
// forwards with a 301 to the city What's on page, the sitemap no longer
// lists them, and no in-app control links to them.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');
const read = (f: string) => fs.readFileSync(path.join(root, f), 'utf8');
type Redirect = { source: string; destination: string; permanent?: boolean };
const redirects: Redirect[] = JSON.parse(read('vercel.json')).redirects;

describe('S1: retired pages forward to the city page', () => {
  it.each([
    ['/choreography', '/city/london-gb'],
    ['/practice-partners', '/city/london-gb'],
    ['/city/:slug/choreography', '/city/:slug'],
    ['/city/:slug/practice-partners', '/city/:slug'],
    ['/:slug([a-z-]+-[a-z]{2})/choreography', '/city/:slug'],
    ['/:slug([a-z-]+-[a-z]{2})/practice-partners', '/city/:slug'],
  ])('%s -> %s (301)', (source, destination) => {
    const r = redirects.find((x) => x.source === source);
    expect(r, source).toBeDefined();
    expect(r!.destination).toBe(destination);
    expect(r!.permanent).toBe(true);
  });

  it('no redirect lands on a retired page', () => {
    const bad = redirects.filter((r) => /choreography|practice-partners/.test(r.destination));
    expect(bad).toEqual([]);
  });

  it('sitemap does not list the retired pages', () => {
    expect(read('app/routes/sitemap.tsx')).not.toMatch(/"\/(choreography|practice-partners)"/);
  });

  it('the dancers page has no practice-partner control', () => {
    expect(read('src/pages/Dancers.tsx')).not.toMatch(/practice-partners|Practice Partners|Dance Partner/);
  });
});
