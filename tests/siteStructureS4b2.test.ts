import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (f: string) => readFileSync(f, 'utf8');

const PAGES = [
  { path: 'organisers', words: 'Bachata Organisers in London' },
  { path: 'venues', words: 'Bachata Venues in London' },
  { path: 'vendors', words: 'Bachata Vendors' },
];

describe('S4b-2: server-rendered head on organisers, venues, vendors', () => {
  for (const { path, words } of PAGES) {
    it(`/${path} meta() has the title and a canonical link`, async () => {
      const mod = await import(`../app/routes/list.${path}.tsx`);
      const tags = mod.meta({} as never) as Array<Record<string, string>>;
      expect(tags.find((t) => t.title)?.title).toContain(words);
      const canonical = tags.find((t) => t.rel === 'canonical');
      expect(canonical?.href).toContain(`/${path}`);
    });

    it(`app/routes.ts registers ${path} inside the VITE_ENABLE_PEOPLE_SSR gate`, () => {
      const src = read('app/routes.ts');
      const start = src.indexOf('process.env.VITE_ENABLE_PEOPLE_SSR === "true"');
      expect(start).toBeGreaterThan(-1);
      const block = src.slice(start, src.indexOf('[]', start));
      expect(block).toContain(`route("${path}", "routes/list.${path}.tsx")`);
    });

    it(`list.${path}.tsx has no +types import`, () => {
      expect(read(`app/routes/list.${path}.tsx`)).not.toContain('+types');
    });
  }
});
