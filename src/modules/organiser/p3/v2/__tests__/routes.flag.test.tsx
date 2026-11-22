// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/* Editor v2 S1: flag OFF keeps today's route table (R4Night hub, R4EditNight, no night route); ON swaps /edit for the gate. */
const v = vi.hoisted(() => ({ on: false }));
vi.mock('@/lib/featureFlags', async (orig) => {
  const real = (await orig()) as { flags: Record<string, unknown> };
  return { ...real, flags: new Proxy(real.flags, { get: (t, k) => (k === 'organiserEditorV2' ? v.on : t[k as string]) }) };
});
vi.mock('@/components/auth/AuthGuard', () => ({ AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
vi.mock('../../r4/R4Night', () => ({ R4Night: () => <p data-testid="stub-r4-night" /> }));
vi.mock('../../r4/R4EditNight', () => ({ R4EditNight: () => <p data-testid="stub-r4-edit" /> }));
vi.mock('../EditorGate', () => ({ R4EditorGate: ({ fallback }: { fallback: ReactNode }) => <div data-testid="stub-v2-gate">{fallback}</div> }));
import P3Routes from '../../shell/P3Routes';
import { P3_BASE, P3_PATHS } from '../../shell/paths';

function Where() { const { pathname, search } = useLocation(); return <output data-testid="where">{pathname + search}</output>; }
const at = (path: string) => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { enabled: false, retry: false } } })}>
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path={`${P3_BASE}/*`} element={<P3Routes />} /></Routes>
      <Where />
    </MemoryRouter>
  </QueryClientProvider>,
);
afterEach(() => { cleanup(); });

describe('flag OFF', () => {
  it('the hub is R4Night and /edit is R4EditNight, no gate', async () => {
    v.on = false;
    at(P3_PATHS.event('s1'));
    expect(await screen.findByTestId('stub-r4-night')).toBeTruthy();
    cleanup();
    at(P3_PATHS.eventEdit('s1'));
    expect(await screen.findByTestId('stub-r4-edit')).toBeTruthy();
    expect(screen.queryByTestId('stub-v2-gate')).toBeNull();
  });
  it('the night route is absent and falls to *', async () => {
    v.on = false;
    at(P3_PATHS.eventNight('s1', 'o1'));
    expect((await screen.findByTestId('where')).textContent).toBe(P3_PATHS.home);
  });
});

describe('flag ON', () => {
  it('the hub goes through the gate with R4Night as fallback', async () => {
    v.on = true;
    at(P3_PATHS.event('s1'));
    const gate = await screen.findByTestId('stub-v2-gate');
    expect(gate.querySelector('[data-testid=stub-r4-night]')).toBeTruthy();
  });
  it('/edit and /night/:occ redirect to the event with ?night=', async () => {
    v.on = true;
    at(P3_PATHS.eventEdit('s1'));
    expect((await screen.findByTestId('where')).textContent).toBe(P3_PATHS.event('s1'));
    cleanup();
    at(P3_PATHS.eventNight('s1', 'o1'));
    expect((await screen.findByTestId('where')).textContent).toBe(`${P3_PATHS.event('s1')}?night=o1`);
  });
});

describe('v2.css', () => {
  it('every slice 2 rule is scoped under .ev2 or .ev2-sheet', () => {
    const css = readFileSync(resolve(__dirname, '../v2.css'), 'utf8');
    const at0 = css.indexOf('*/', css.indexOf('Editor v2 shared look (slice 2)')) + 2;
    const mine = css.slice(at0);
    const bare = mine.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@keyframes[^{]+\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, '').replace(/@media[^{]+\{/g, '');
    const sels = bare.split('}').map((r) => r.split('{')[0].trim()).filter(Boolean);
    expect(sels.length).toBeGreaterThan(20);
    for (const sel of sels) for (const one of sel.split(',')) expect(one.trim()).toMatch(/^\.ev2(-sheet)?\b/);
  });
});
