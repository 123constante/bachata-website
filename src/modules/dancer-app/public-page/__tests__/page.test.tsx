// @vitest-environment jsdom
/**
 * /dancers/:id page (src/pages/DancerProfile.tsx) with and without public page v2,
 * shape x viewer x extras, at 390x844 and at 200% text. The query cache is seeded
 * with the rows the loader dehydrates (same pattern as
 * tests/regression/today/dancerPage.today.test.tsx, which pins the closed page).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { installJsdomPolyfills } from '../../../../../tests/client/jsdomPolyfills';
import { NAMELESS_SHARE_TITLE, NO_EXTRAS, type PublicPageV2Data } from '../model';
import { EXTRAS, SHAPES, type ShapeKey } from './shapes';

const h = vi.hoisted(() => ({
  user: null as null | { id: string; is_anonymous?: boolean },
  authStatus: 'ready' as string,
  persona: null as string | null,
  rpcCalls: [] as string[],
  on: true,
}));
vi.mock('@/lib/goingCheckin', () => ({ get GOING_CHECKIN_ENABLED() { return h.on; } }));
vi.mock('@/hooks/useAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useAuth')>()),
  useAuth: () => ({ user: h.user, isLoading: h.authStatus === 'resolving', authStatus: h.authStatus }),
}));
vi.mock('@/hooks/useMyPersonaId', () => ({ useMyPersonaId: () => h.persona }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: async (name: string) => {
      h.rpcCalls.push(name);
      return { data: null, error: null };
    },
    from: () => ({}),
  },
}));
vi.mock('@/integrations/supabase/getSupabase', () => ({ getSupabase: async () => ({ rpc: async (name: string) => { h.rpcCalls.push(name); return { data: null, error: null }; } }) }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));

import DancerProfile from '@/pages/DancerProfile';

const mount = (key: ShapeKey, publicPage: PublicPageV2Data | null | undefined) => {
  const rec = SHAPES[key];
  const slug = key.replace(/\W+/g, '-');
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(['entity-resolve', 'dancer_profiles', 'id', slug], { id: rec.id, slug });
  qc.setQueryData(['dancer-profile', rec.id], rec);
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/dancers/${slug}`]}>
        <Routes>
          <Route path="/dancers/:id" element={publicPage === undefined ? <DancerProfile /> : <DancerProfile publicPage={publicPage} />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 120)); });
const q = (id: string) => screen.queryByTestId(id);

const VIEWERS = [
  { name: 'signed out', user: null, self: false },
  { name: 'signed in (stranger)', user: { id: 'someone-else' }, self: false },
  { name: 'owner', user: { id: 'owner' }, self: true },
] as const;

beforeEach(() => {
  installJsdomPolyfills();
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-17T12:00:00Z') });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  h.user = null;
  h.authStatus = 'ready';
  h.persona = null;
  h.rpcCalls = [];
  h.on = true;
  window.innerWidth = 390;
  window.innerHeight = 844;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.documentElement.style.fontSize = '';
});

describe.each(Object.keys(SHAPES) as ShapeKey[])('%s', (key) => {
  it.each(VIEWERS)('flag open, $name: v2 with its name, Share, Join only when signed out, no "Your plans" for anyone', async ({ user, self }) => {
    h.user = user;
    h.persona = self ? SHAPES[key].id : null;
    mount(key, { extrasOk: true, extras: NO_EXTRAS });
    await settle();
    expect(q('dancer-page-v2')).not.toBeNull();
    const name = SHAPES[key].display_name ?? 'Dancer';
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(name);
    expect(q('dancer-share')).not.toBeNull();
    expect(q('dancer-join') !== null).toBe(user === null);
    // Going P2 (owner decision): the owner-only "Your plans" block is gone for everyone, and the page
    // reads no attendance of the viewer's own.
    expect(screen.queryByText('Your plans')).toBeNull();
    expect(h.rpcCalls.filter((n) => /attendance|going/.test(n))).toEqual([]);
    // F13: no appearances list, no gallery, no description.
    expect(screen.queryByText('Event appearances')).toBeNull();
    expect(q('dancer-gallery')).toBeNull();
    expect(q('dancer-bio')).toBeNull();
  });

  it('flag closed (no prop) or null: today\'s page, no v2', async () => {
    mount(key, undefined);
    await settle();
    expect(q('dancer-page-v2')).toBeNull();
    cleanup();
    mount(key, null);
    await settle();
    expect(q('dancer-page-v2')).toBeNull();
  });
});

describe('extras', () => {
  it.each([
    ['with bio, languages and WhatsApp', EXTRAS.full, true],
    ['without any extras', NO_EXTRAS, false],
  ] as const)('%s', async (_n, extras, on) => {
    mount('photoless', { extrasOk: true, extras });
    await settle();
    expect(q('dancer-bio')).toBeNull(); // owner: the description stays hidden
    expect(q('dancer-languages') !== null).toBe(on);
    const wa = q('dancer-whatsapp');
    expect(wa !== null).toBe(on);
    if (wa) expect(wa.getAttribute('href')).toBe('https://wa.me/447700900123');
  });

  it('many languages: every one is shown', async () => {
    mount('photoless', { extrasOk: true, extras: EXTRAS.manyLanguages });
    await settle();
    expect(q('dancer-languages')!.textContent).toContain('English, Spanish, Portuguese, French, Italian, Polish');
  });

  it('no contacts and no WhatsApp: the empty state says what the visitor can do, and Share is on screen', async () => {
    mount('photoless', { extrasOk: true, extras: NO_EXTRAS });
    await settle();
    expect(q('dancer-connect-empty')!.textContent).toContain('Use Share');
    expect(q('dancer-share')).not.toBeNull();
  });

  it('extras read failed: no "no public contacts" claim (a WhatsApp may exist we could not read)', async () => {
    mount('photoless', { extrasOk: false, extras: NO_EXTRAS });
    await settle();
    expect(q('dancer-page-v2')).not.toBeNull();
    expect(q('dancer-connect')).toBeNull();
    expect(q('dancer-connect-empty')).toBeNull();
  });

  it('WhatsApp only: one contact row, no "no contacts" line', async () => {
    mount('photoless', { extrasOk: true, extras: { ...NO_EXTRAS, whatsapp: '+447700900123' } });
    await settle();
    expect(q('dancer-connect-empty')).toBeNull();
    expect(q('dancer-whatsapp')).not.toBeNull();
  });
});

describe('every section of today\'s page is on v2 (complete + all extras)', () => {
  it('role, years, level, style, stamp, achievements, contacts', async () => {
    mount('complete + all extras', { extrasOk: true, extras: NO_EXTRAS });
    await settle();
    const text = q('dancer-page-v2')!.textContent!;
    for (const s of ['Lead and Follow \u00b7 Manchester', '11 years', 'Veteran', 'Sensual, Dominican', 'Practice partner wanted', 'Goal: footwork', 'Best newcomer 2022', '@carla', 'facebook.com/carla.ruiz', 'carla.example']) {
      expect(text, s).toContain(s);
    }
  });
});

describe('Join', () => {
  it('signs in, then returns to this page', async () => {
    mount('photoless', { extrasOk: true, extras: NO_EXTRAS });
    await settle();
    expect(q('dancer-join')!.querySelector('a')!.getAttribute('href')).toBe('/auth?mode=signup&returnTo=%2Fdancers%2Fphotoless');
  });

  it('never flashes while auth is still resolving (server render / first paint)', async () => {
    h.authStatus = 'resolving';
    mount('photoless', { extrasOk: true, extras: NO_EXTRAS });
    await settle();
    expect(q('dancer-join')).toBeNull();
  });

  it('an anonymous session counts as signed out', async () => {
    h.user = { id: 'anon', is_anonymous: true };
    mount('photoless', { extrasOk: true, extras: NO_EXTRAS });
    await settle();
    expect(q('dancer-join')).not.toBeNull();
  });
});

describe('Share', () => {
  const setNav = (share: unknown, writeText: unknown) => {
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: writeText ? { writeText } : undefined, configurable: true });
  };

  it('uses the phone share sheet with this page\'s link', async () => {
    const share = vi.fn(async () => undefined);
    setNav(share, null);
    mount('long name', { extrasOk: true, extras: NO_EXTRAS });
    await settle();
    await act(async () => { fireEvent.click(q('dancer-share')!); });
    expect(share).toHaveBeenCalledWith({ title: 'Maria-Fernanda Alejandra de los Santos on Bachata Calendar', url: `${window.location.origin}/dancers/long-name` });
  });

  // F18: a nameless profile shares under the one documented constant, never "undefined" or an id.
  it('nameless: shares as NAMELESS_SHARE_TITLE ("Dancer on Bachata Calendar")', async () => {
    const share = vi.fn(async () => undefined);
    setNav(share, null);
    mount('nameless', { extrasOk: true, extras: NO_EXTRAS });
    await settle();
    await act(async () => { fireEvent.click(q('dancer-share')!); });
    expect(NAMELESS_SHARE_TITLE).toBe('Dancer on Bachata Calendar');
    expect(share).toHaveBeenCalledWith({ title: NAMELESS_SHARE_TITLE, url: `${window.location.origin}/dancers/nameless` });
  });

  it('no share sheet: copies the link and says so', async () => {
    const writeText = vi.fn(async () => undefined);
    setNav(undefined, writeText);
    mount('photoless', { extrasOk: true, extras: NO_EXTRAS });
    await settle();
    await act(async () => { fireEvent.click(q('dancer-share')!); });
    expect(writeText).toHaveBeenCalled();
    expect(q('dancer-share-status')!.textContent).toContain('Link copied');
  });

  it('nothing works: shows the link to copy by hand', async () => {
    setNav(undefined, null);
    mount('photoless', { extrasOk: true, extras: NO_EXTRAS });
    await settle();
    await act(async () => { fireEvent.click(q('dancer-share')!); });
    expect(q('dancer-share-status')!.textContent).toContain('Copy this link');
    expect((q('dancer-share-link') as HTMLInputElement).value).toContain('/dancers/photoless');
  });
});

describe('views and names', () => {
  it('v2 calls no view recorder (the page never did; no second recorder)', async () => {
    mount('complete + all extras', { extrasOk: true, extras: EXTRAS.full });
    await settle();
    expect(h.rpcCalls.filter((n) => /view/.test(n))).toEqual([]);
  });

  // F6: the portrait is above the fold, so it loads eagerly (check:images needs an explicit loading attr).
  it('the portrait image loads eagerly', async () => {
    mount('long name', { extrasOk: true, extras: NO_EXTRAS });
    await settle();
    const portrait = screen.getAllByRole('img').find((el) => el.getAttribute('alt') === 'Maria-Fernanda Alejandra de los Santos');
    expect(portrait?.getAttribute('loading')).toBe('eager');
  });

  // F4: prod stores ISO codes; the chips show names, and unknown codes never appear raw.
  it('language codes render as names; unknown codes are hidden', async () => {
    mount('photoless', { extrasOk: true, extras: { ...NO_EXTRAS, languages: ['en', 'es', 'xx'] } });
    await settle();
    expect(q('dancer-languages')!.textContent).toContain('English, Spanish');
    expect(q('dancer-languages')!.textContent).not.toContain('xx');
  });

  it('only unknown language codes: no Speaks section at all', async () => {
    mount('photoless', { extrasOk: true, extras: EXTRAS.unknownCodes });
    await settle();
    expect(q('dancer-languages')).toBeNull();
  });

  it('surname hidden: no surname on screen', async () => {
    mount('surname hidden', { extrasOk: true, extras: NO_EXTRAS });
    await settle();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Fay');
  });

  it('200% text, long name: the heading wraps instead of overflowing', async () => {
    document.documentElement.style.fontSize = '200%';
    mount('long name', { extrasOk: true, extras: EXTRAS.full });
    await settle();
    expect(q('dancer-name')!.className).toContain('break-words');
  });
});

describe('Going next through the real /dancers/:id page (going_next 0 / 1 / 2 / 3, hidden)', () => {
  const nights = (n: number) => Array.from({ length: n }, (_, i) => ({
    occurrence_id: `o${i}`, public_event_id: `e${i}`, event_title: `Night ${i}`, occurrence_date: `2099-01-0${i + 1}`, starts_at_local: `2099-01-0${i + 1}T21:00:00`,
  }));
  it.each([
    [0, 0, false],
    [1, 1, false],
    [2, 2, false],
    [3, 2, true],
  ] as const)('%i nights: %i cards, See all %s, for every viewer', async (n, cards, seeAll) => {
    for (const v of VIEWERS) {
      h.user = v.user;
      mount('photoless', { extrasOk: true, extras: { ...NO_EXTRAS, goingNext: nights(n) } });
      await settle();
      expect(screen.queryAllByTestId('dancer-going-card'), v.name).toHaveLength(cards);
      expect(q('dancer-going') !== null, v.name).toBe(n > 0);
      expect(q('dancer-going-see-all') !== null, v.name).toBe(seeAll);
      cleanup();
    }
  });
  it('hidden page (extras NULL -> the loader gives NO_EXTRAS) and a failed extras read: no section', async () => {
    mount('photoless', { extrasOk: true, extras: NO_EXTRAS });
    await settle();
    expect(q('dancer-going')).toBeNull();
    cleanup();
    mount('photoless', { extrasOk: false, extras: NO_EXTRAS });
    await settle();
    expect(q('dancer-going')).toBeNull();
  });
  it('switch off: no section, even with nights', async () => {
    h.on = false;
    mount('photoless', { extrasOk: true, extras: { ...NO_EXTRAS, goingNext: nights(3) } });
    await settle();
    expect(q('dancer-going')).toBeNull();
  });
});
