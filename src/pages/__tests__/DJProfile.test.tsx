// @vitest-environment jsdom
/**
 * /djs/:id page shell (W1 fix pass): the BreadcrumbList JSON-LD survives the
 * hidden subheader (C3), a 'manual' share shows the link it tells you to copy
 * (C4), and the loading and error states already paint the DJ ground (C8).
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installJsdomPolyfills } from '../../../tests/client/jsdomPolyfills';
import { EmbeddedProfileContext } from '@/lib/embeddedProfile';
import { PAGE_GROUNDS } from '@/components/layout/pageGrounds';

const h = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (fn: string, args: unknown) => h.rpc(fn, args) } }));
vi.mock('@/lib/seo', async (orig) => ({
  ...(await orig<typeof import('@/lib/seo')>()),
  useEntitySlugOrId: () => ({ id: 'dj1', slug: 'oreo', arrivedViaUuid: false, notFound: false }),
  useCanonicalReplaceState: () => undefined,
}));
vi.mock('@/hooks/useProfileProgramAppearances', () => ({ useProfileProgramAppearances: () => ({ data: [] }) }));
vi.mock('@/modules/person-page/AlsoRoles', () => ({ AlsoRoles: () => null }));

import DJProfile from '../DJProfile';

const ROW = {
  id: 'dj1', display_name: 'DJ Oreo', dj_name: 'DJ Oreo', first_name: null, surname: null,
  photo_url: null, cover_url: null, bio: null, genres: null, nationality: null, city_id: null,
  city_name: null, city_slug: null, person_entity_id: null, instagram: null, facebook: null,
  website: null, soundcloud: null, mixcloud: null, pricing: null, faq: null, gallery_urls: null,
  languages: null, achievements: null, upcoming_events: [],
};

const mount = (embedded = false) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/djs/oreo']}>
        <EmbeddedProfileContext.Provider value={embedded}>
          <Routes>
            <Route path="/djs/:id" element={<DJProfile />} />
          </Routes>
        </EmbeddedProfileContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );

const jsonLd = () =>
  [...document.querySelectorAll('script[type="application/ld+json"]')]
    .map((s) => JSON.parse(s.textContent ?? '{}'))
    .filter((j) => j['@type'] === 'BreadcrumbList');

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
};

beforeEach(() => {
  installJsdomPolyfills();
  h.rpc.mockReset();
});
afterEach(() => {
  cleanup();
  document.body.style.background = '';
  document.documentElement.style.background = '';
  vi.unstubAllGlobals();
});

describe('DJProfile /djs/:id', () => {
  it('loaded page (subheader hidden) still emits one BreadcrumbList JSON-LD ending at the DJ', async () => {
    h.rpc.mockResolvedValue({ data: ROW, error: null });
    mount();
    await screen.findByTestId('dj-head');
    const lists = jsonLd();
    expect(lists).toHaveLength(1);
    const items = lists[0].itemListElement as Array<{ name: string; item: string }>;
    expect(items.map((i) => i.name)).toEqual(['Home', 'Parties', 'DJs', 'DJ Oreo']);
    expect(items[items.length - 1].item).toMatch(/\/djs\/oreo$/);
  });

  it('embedded as a /people/:id tab: no JSON-LD of its own (the person page owns it)', async () => {
    h.rpc.mockResolvedValue({ data: ROW, error: null });
    mount(true);
    await screen.findByTestId('dj-head');
    expect(jsonLd()).toHaveLength(0);
  });

  it("share with no share sheet and no clipboard shows the page link to copy by hand", async () => {
    vi.stubGlobal('navigator', { userAgent: 'jsdom' });
    h.rpc.mockResolvedValue({ data: ROW, error: null });
    mount();
    const btn = await screen.findByTestId('dj-share');
    await act(async () => {
      fireEvent.click(btn);
    });
    expect(screen.getByRole('status').textContent).toBe('Copy this link to share the page:');
    const link = screen.getByTestId('dj-share-link') as HTMLInputElement;
    expect(link.readOnly).toBe(true);
    expect(link.value).toBe(`${window.location.origin}/djs/oreo`);
  });

  it('loading state paints the DJ ground (no flash of #000)', () => {
    h.rpc.mockReturnValue(new Promise(() => undefined));
    mount();
    expect(document.body.style.backgroundColor).toBe(rgb(PAGE_GROUNDS.dj.base));
  });

  it('error state paints the DJ ground', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    mount();
    await screen.findByText(/doesn.t exist or has been removed/);
    await waitFor(() => expect(document.body.style.backgroundColor).toBe(rgb(PAGE_GROUNDS.dj.base)));
  });
});
