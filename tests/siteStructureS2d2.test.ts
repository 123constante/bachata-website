// Site structure arc S2d-2 (docs/arcs/site-structure.md, What's on table):
// /cities was a static world map with one pin (London is the only active
// city). It forwards with a 301 to /city/london-gb, the sitemap no longer
// lists it, and the menu's city row goes straight to the London page.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { menuRows } from '../src/modules/home-polish/menuModel';

const root = path.resolve(__dirname, '..');
const read = (f: string) => fs.readFileSync(path.join(root, f), 'utf8');
type Redirect = { source: string; destination: string; permanent?: boolean };
const redirects: Redirect[] = JSON.parse(read('vercel.json')).redirects;

describe('S2d-2: /cities forwards to the London city page', () => {
  it('/cities -> /city/london-gb (301)', () => {
    const r = redirects.find((x) => x.source === '/cities');
    expect(r).toBeDefined();
    expect(r!.destination).toBe('/city/london-gb');
    expect(r!.permanent).toBe(true);
  });

  it('the sitemap no longer lists /cities', () => {
    expect(read('app/routes/sitemap.tsx')).not.toContain('"/cities"');
  });

  it.each(['signedOut', 'signedIn', 'organiser'] as const)('menu city row (%s) goes to /city/london-gb', (role) => {
    const { browse } = menuRows({
      role, signInHref: '/auth', venuesHref: '/venues', communityHref: 'https://x',
      accountHref: '/account', organiserHomeHref: '/o', sellTicketsHref: '/s',
    });
    const city = browse.find((r) => r.id === 'cities');
    expect(city).toBeDefined();
    expect(city!.href).toBe('/city/london-gb');
    expect(city!.label).toBe('City: London');
    expect(browse.some((r) => r.href === '/cities')).toBe(false);
  });
});
