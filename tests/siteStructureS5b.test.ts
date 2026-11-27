import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

const flagState = vi.hoisted(() => ({ rafflesPage: false }));
vi.mock('@/lib/featureFlags', () => ({ flags: flagState }));

import { meta, loader } from '../app/routes/raffles';

type Tag = Record<string, string>;

describe('S5b /raffles route', () => {
  beforeEach(() => {
    flagState.rafflesPage = false;
  });

  it('meta has a title and a /raffles canonical', () => {
    const tags = (meta as unknown as (a: unknown) => Tag[])({}) as Tag[];
    expect(String(tags[0].title).length).toBeGreaterThan(0);
    const canon = tags.find((t) => t.rel === 'canonical');
    expect(canon?.href.endsWith('/raffles')).toBe(true);
  });

  it('loader redirects to / when the flag is off', () => {
    const res = loader() as Response;
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/');
  });

  it('loader returns null when the flag is on', () => {
    flagState.rafflesPage = true;
    expect(loader()).toBeNull();
  });

  it('routes.ts registers it inside the gate after the S5b comment', () => {
    const src = readFileSync('app/routes.ts', 'utf8');
    const i = src.indexOf('(site structure S5b)');
    expect(i).toBeGreaterThan(-1);
    const line = src.slice(i, src.indexOf('\n', src.indexOf('VITE_ENABLE_SITE_HEADS_SSR', i)));
    expect(line).toContain('VITE_ENABLE_SITE_HEADS_SSR === "true"');
    expect(line).toContain('route("raffles", "routes/raffles.tsx")');
  });

  it('does not import +types', () => {
    expect(readFileSync('app/routes/raffles.tsx', 'utf8')).not.toContain('+types');
  });
});
