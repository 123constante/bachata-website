// @vitest-environment jsdom
/**
 * /dancers/:id page (src/pages/DancerProfile.tsx) passes `embedded` to v2: the Dancing tab of
 * /people/:id. Without the prop the page is today's (pb-24 under it, Back, h1). With it, v2 is
 * embedded and the wrapper drops pb-24 (the person page's own "Open full dancer page" link sits
 * right under the tab). Same seeding pattern as page.test.tsx.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { installJsdomPolyfills } from '../../../../../tests/client/jsdomPolyfills';
import { NO_EXTRAS } from '../model';
import { SHAPES } from './shapes';

vi.mock('@/hooks/useAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useAuth')>()),
  useAuth: () => ({ user: null, isLoading: false, authStatus: 'ready' }),
}));
vi.mock('@/hooks/useMyPersonaId', () => ({ useMyPersonaId: () => null }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: async () => ({ data: null, error: null }), from: () => ({}) } }));
vi.mock('@/integrations/supabase/getSupabase', () => ({ getSupabase: async () => ({ rpc: async () => ({ data: null, error: null }) }) }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));

import DancerProfile from '@/pages/DancerProfile';

const mount = (embedded: boolean | undefined) => {
  const rec = SHAPES['complete + all extras'];
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(['entity-resolve', 'dancer_profiles', 'id', 'full'], { id: rec.id, slug: 'full' });
  qc.setQueryData(['dancer-profile', rec.id], rec);
  const page = { extrasOk: true, extras: NO_EXTRAS };
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/dancers/full']}>
        <Routes>
          <Route
            path="/dancers/:id"
            element={embedded === undefined ? <DancerProfile publicPage={page} /> : <DancerProfile publicPage={page} embedded={embedded} />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 120)); });
const wrapperOf = () => screen.getByTestId('dancer-page-v2').parentElement as HTMLElement;

beforeEach(() => {
  installJsdomPolyfills();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('DancerProfile embedded pass-through', () => {
  it.each([
    { name: 'no prop (today)', embedded: undefined, h1: 1, back: true, pb24: true },
    { name: 'embedded={false}', embedded: false, h1: 1, back: true, pb24: true },
    { name: 'embedded', embedded: true, h1: 0, back: false, pb24: false },
  ])('$name', async ({ embedded, h1, back, pb24 }) => {
    mount(embedded);
    await settle();
    expect(screen.queryAllByRole('heading', { level: 1 })).toHaveLength(h1);
    expect(screen.queryByTestId('dancer-back') !== null).toBe(back);
    expect(wrapperOf().classList.contains('pb-24')).toBe(pb24);
  });
});
