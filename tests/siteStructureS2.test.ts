// Site structure arc S2a (docs/arcs/site-structure.md, What's on table):
// /bachata-parties-london and the two style party pages duplicated /parties
// with 0 Google visits. Each forwards with a 301 to /parties, the sitemap no
// longer lists them, nothing prerenders them and no in-app link points at them.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');
const read = (f: string) => fs.readFileSync(path.join(root, f), 'utf8');
type Redirect = { source: string; destination: string; permanent?: boolean };
const redirects: Redirect[] = JSON.parse(read('vercel.json')).redirects;
const OLD = ['/bachata-parties-london', '/bachata-london-sensual-parties', '/bachata-london-dominican-parties'];

describe('S2a: duplicate party pages forward to /parties', () => {
  it.each(OLD)('%s -> /parties (301)', (source) => {
    const r = redirects.find((x) => x.source === source);
    expect(r, source).toBeDefined();
    expect(r!.destination).toBe('/parties');
    expect(r!.permanent).toBe(true);
  });

  it('no redirect lands on a retired page', () => {
    expect(redirects.filter((r) => OLD.includes(r.destination))).toEqual([]);
  });

  it.each(['app/routes/sitemap.tsx', 'react-router.config.ts', 'app/routes.ts'])('%s no longer lists them', (f) => {
    const src = read(f);
    for (const p of OLD) expect(src, `${f} ${p}`).not.toContain(`"${p}"`);
    for (const p of OLD) expect(src, `${f} ${p}`).not.toContain(`"${p.slice(1)}"`);
  });

  it('the weekday pages link to /parties, not the retired page', () => {
    const src = read('src/pages/seo/BachataWeekday.tsx');
    expect(src).not.toMatch(/to="\/bachata-(parties-london|london-(sensual|dominican)-parties)"/);
    expect(src).toContain('to="/parties"');
  });
});
