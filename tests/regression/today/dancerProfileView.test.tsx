// @vitest-environment jsdom
/** DancerProfile counts every page open once per mounted id (context 'profile-page'). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { installJsdomPolyfills } from '../../client/jsdomPolyfills';

const h = vi.hoisted(() => ({ emit: vi.fn() }));
vi.mock('@/lib/profileViewEmit', () => ({ emitProfileView: h.emit }));
vi.mock('@/hooks/useAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useAuth')>()),
  useAuth: () => ({ user: null, isLoading: false, authStatus: 'ready' }),
}));
vi.mock('@/hooks/useMyPersonaId', () => ({ useMyPersonaId: () => null }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: async () => ({ data: null, error: null }), from: () => ({}) },
}));
vi.mock('@/integrations/supabase/getSupabase', () => ({ getSupabase: async () => ({}) }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));

import DancerProfile from '@/pages/DancerProfile';

const record = {
  id: 'id-1', first_name: 'Bea', surname: null, display_name: 'Bea', nationality: null, dance_role: null, instagram: null,
  facebook: null, avatar_url: null, website_url: null, gallery_urls: null, cities: { name: 'London' }, dancing_role_details: null,
};

const mount = (found: boolean) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const id = found ? 'id-1' : 'id-none';
  qc.setQueryData(['entity-resolve', 'dancer_profiles', 'id', 'bea'], { id, slug: 'bea' });
  if (found) qc.setQueryData(['dancer-profile', id], record);
  else qc.setQueryDefaults(['dancer-profile', id], { queryFn: async () => { throw new Error('Dancer not found.'); } });
  const tree = (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/dancers/bea']}>
        <Routes><Route path="/dancers/:id" element={<DancerProfile />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  const r = render(tree);
  return { ...r, tree };
};

beforeEach(() => {
  installJsdomPolyfills();
  h.emit.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('DancerProfile page-open profile view', () => {
  it('emits once with the dancer id and does not re-emit on re-render', async () => {
    const { rerender, tree } = mount(true);
    await new Promise((r) => setTimeout(r, 100));
    expect(h.emit).toHaveBeenCalledTimes(1);
    expect(h.emit).toHaveBeenCalledWith({ personId: 'id-1', profileType: 'dancer', context: 'profile-page' });
    rerender(tree);
    await new Promise((r) => setTimeout(r, 50));
    expect(h.emit).toHaveBeenCalledTimes(1);
  });

  it('emits nothing for a not-found dancer', async () => {
    mount(false);
    await new Promise((r) => setTimeout(r, 100));
    expect(h.emit).not.toHaveBeenCalled();
  });
});
