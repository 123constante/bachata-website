import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import LegalRoute, { meta } from '../app/routes/legal';

type Tag = Record<string, string>;
const run = (pathname: string) => (meta as unknown as (a: unknown) => Tag[])({ location: { pathname } });

describe('S5a legal routes', () => {
  it.each([
    ['/privacy', 'Privacy | Bachata Calendar'],
    ['/terms', 'Terms of use | Bachata Calendar'],
  ])('%s meta has title and canonical', (path, title) => {
    const tags = run(path);
    expect(tags[0].title).toBe(title);
    expect(tags.find((t) => t.rel === 'canonical')?.href.endsWith(path)).toBe(true);
  });

  it('routes.ts registers both inside the gate block after the S5a comment', () => {
    const src = readFileSync('app/routes.ts', 'utf8');
    const i = src.indexOf('VITE_ENABLE_SITE_HEADS_SSR === "true"', src.indexOf('(site structure S5a)'));
    expect(i).toBeGreaterThan(-1);
    const block = src.slice(i, src.indexOf(': []', i));
    expect(block).toContain('route("privacy", "routes/legal.tsx", { id: "legal-privacy" })');
    expect(block).toContain('route("terms", "routes/legal.tsx", { id: "legal-terms" })');
  });

  it.each(['/privacy', '/terms'])('server render of %s contains an h1', (path) => {
    const html = renderToString(
      createElement(MemoryRouter, { initialEntries: [path] }, createElement(LegalRoute)),
    );
    expect(html).toContain('<h1');
  });

  it('has no +types import', () => {
    expect(readFileSync('app/routes/legal.tsx', 'utf8')).not.toContain('+types');
  });
});
