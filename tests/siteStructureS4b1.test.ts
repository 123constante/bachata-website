// Site structure S4b-1: /dancers, /djs, /teachers get a server-rendered head
// behind VITE_ENABLE_PEOPLE_SSR.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');
const routesSrc = fs.readFileSync(path.join(root, 'app/routes.ts'), 'utf8');

describe('S4b-1 route gate', () => {
  const gate = routesSrc.slice(routesSrc.indexOf('VITE_ENABLE_PEOPLE_SSR'));
  it.each([['dancers'], ['djs'], ['teachers']])('%s is registered inside the gate', (k) => {
    expect(gate).toContain(`route("${k}", "routes/list.${k}.tsx")`);
  });
  it('sits right after the teachers/:id route', () => {
    expect(routesSrc.indexOf('route("teachers/:id"')).toBeLessThan(routesSrc.indexOf('VITE_ENABLE_PEOPLE_SSR'));
  });
  it.each([['dancers'], ['djs'], ['teachers']])('list.%s.tsx has no +types import', (k) => {
    expect(fs.readFileSync(path.join(root, `app/routes/list.${k}.tsx`), 'utf8')).not.toContain('+types');
  });
});

describe('S4b-1 meta()', () => {
  it.each([
    ['dancers', 'Bachata Dancers in London', '/dancers'],
    ['djs', 'Bachata DJs in London', '/djs'],
    ['teachers', 'Bachata Teachers in London', '/city/london-gb/teachers'],
  ])('%s', async (k, title, canonical) => {
    const mod = await import(`../app/routes/list.${k}.tsx`);
    const tags = mod.meta({} as never) as Array<Record<string, string>>;
    expect(tags.find((t) => t.title)?.title).toContain(title);
    expect(tags.find((t) => t.rel === 'canonical')?.href).toContain(canonical);
  });
});
