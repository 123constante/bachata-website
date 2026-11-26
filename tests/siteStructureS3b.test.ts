// Site structure arc S3b (docs/arcs/site-structure.md, "New here?" row):
// /faq and /london-bachata-guide forward with a 301 to the merged Learn page,
// the sitemap and prerender list no longer name them, and the footer drops them.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');
const read = (f: string) => fs.readFileSync(path.join(root, f), 'utf8');
type Redirect = { source: string; destination: string; permanent?: boolean };
const redirects: Redirect[] = JSON.parse(read('vercel.json')).redirects;
const OLD: Array<[string, string]> = [
  ['/faq', '/learn-bachata-london#faq'],
  ['/london-bachata-guide', '/learn-bachata-london'],
];

describe('S3b: old guide and FAQ pages forward to the Learn page', () => {
  it.each(OLD)('%s -> %s (301)', (source, destination) => {
    const r = redirects.find((x) => x.source === source);
    expect(r, source).toBeDefined();
    expect(r!.destination).toBe(destination);
    expect(r!.permanent).toBe(true);
  });

  it('no redirect lands on a retired page', () => {
    const dests = OLD.map(([s]) => s);
    expect(redirects.filter((r) => dests.includes(r.destination))).toEqual([]);
  });

  it.each(['app/routes/sitemap.tsx', 'react-router.config.ts'])('%s no longer lists them', (f) => {
    const src = read(f);
    for (const [p] of OLD) expect(src, `${f} ${p}`).not.toContain(`"${p}"`);
  });

  it('the footer links no longer point at them', () => {
    const src = read('src/lib/contactLinks.tsx');
    expect(src).not.toContain("to: '/faq'");
    expect(src).not.toContain("to: '/london-bachata-guide'");
    expect(src).toContain("to: '/learn-bachata-london'");
  });
});
