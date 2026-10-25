// @vitest-environment jsdom
/**
 * Dancer bar blend (ticket dt_b9192c70afac): /dancers/:id with flags.personHub ON shows exactly ONE
 * Back ("Back to <name>" in the bar; the dancer card's own Back is dropped only while the bar is
 * on screen), and flag OFF renders today's page (the card's Back, no bar). Table-driven over the
 * prod dancer shapes (thin, overfull, no photo, nameless, long name) x role shapes (no public role,
 * one role, two roles) x person read (answered / not yet).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { renderToStaticMarkup } from 'react-dom/server';
import { installJsdomPolyfills } from '../../../../../tests/client/jsdomPolyfills';
import { flags } from '@/lib/featureFlags';
import type { PersonRole } from '@/lib/searchEntities';
import { contrastRatio } from '@/modules/dancer-app/theme/tokens';
import { DancerRoleBar } from '../DancerRoleBar';
import { NO_EXTRAS, type PublicPageV2Data } from '../model';
import { EXTRAS, SHAPES, type ShapeKey } from './shapes';

const h = vi.hoisted(() => ({ roles: [] as PersonRole[], answered: true }));
vi.mock('@/hooks/useAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useAuth')>()),
  useAuth: () => ({ user: null, isLoading: false, authStatus: 'ready' }),
}));
vi.mock('@/hooks/useMyPersonaId', () => ({ useMyPersonaId: () => null }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: async () => ({ data: null, error: null }), from: () => ({}) } }));
vi.mock('@/integrations/supabase/getSupabase', () => ({ getSupabase: async () => ({ rpc: async () => ({ data: null, error: null }) }) }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/modules/person-page/badges', async (orig) => {
  const real = await orig<typeof import('@/modules/person-page/badges')>();
  return {
    ...real,
    usePeopleBadges: (ids: string[]) => ({
      badges: h.roles.length && ids.length ? new Map(ids.map((id) => [id, { id, roles: h.roles, djName: null, djHasUpcoming: false, nextGigDate: null }])) : new Map(),
      isLoading: false,
      isError: false,
    }),
  };
});
vi.mock('@/modules/person-page/usePersonRoles', () => ({
  usePersonSnapshot: (id: string | undefined) => ({
    snapshot: id && h.answered && h.roles.length ? { name: 'Marta Silva', roles: h.roles } : null,
    answered: !!id && h.answered,
  }),
}));

import DancerProfile from '@/pages/DancerProfile';

const HUB_DEFAULT = flags.personHub;
const setHub = (on: boolean) => { (flags as { personHub: boolean }).personHub = on; };

const mount = (key: ShapeKey, page: PublicPageV2Data, embedded = false) => {
  const rec = SHAPES[key];
  const slug = key.replace(/\W+/g, '-');
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(['entity-resolve', 'dancer_profiles', 'id', slug], { id: rec.id, slug });
  qc.setQueryData(['dancer-profile', rec.id], rec);
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/dancers/${slug}`]}>
        <Routes>
          <Route path="/dancers/:id" element={<DancerProfile publicPage={page} embedded={embedded} />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 60)); });
const q = (id: string) => screen.queryByTestId(id);
/** Every visible Back control on the page, whatever it says after "Back". */
const backs = () => screen.queryAllByRole('link').filter((a) => /^\s*Back\b/.test(a.textContent ?? ''));

beforeEach(() => {
  installJsdomPolyfills();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  h.roles = [];
  h.answered = true;
  setHub(false);
});
afterEach(() => {
  cleanup();
  setHub(HUB_DEFAULT);
  vi.restoreAllMocks();
});

// thin = nameless + no extras; overfull = every field + every extra; no photo; long name.
const DANCERS: [string, ShapeKey, PublicPageV2Data][] = [
  ['thin', 'nameless', { extrasOk: true, extras: NO_EXTRAS }],
  ['overfull', 'complete + all extras', { extrasOk: true, extras: EXTRAS.full }],
  ['no photo', 'photoless', { extrasOk: true, extras: NO_EXTRAS }],
  ['long name', 'long name', { extrasOk: true, extras: EXTRAS.manyLanguages }],
];
// Prod role shapes for a dancer row (badges survey 2026-10-22): no public role,
// teacher+dancer (teacher page closed = one role page), dj+dancer (two role pages).
// Dancer-only is left out on purpose: whether one held role gets the bar is decided by
// person-page roleSwitchModel (W2-D: /people/<slug> 302s a one-role person back to this
// page, so no bar) and pinned in person-page/__tests__/roleSwitch.test.tsx.
const ROLES: [string, PersonRole[], boolean][] = [
  ['no public role (hub would 404)', [], false],
  ['one role page (teacher closed)', ['teacher', 'dancer'], true],
  ['two roles', ['dj', 'dancer'], true],
];

describe.each(DANCERS)('%s dancer', (_n, key, page) => {
  describe.each(ROLES)('%s', (_r, roles, hub) => {
    it('flag OFF: today\'s page, the card\'s own Back only, no bar', async () => {
      h.roles = roles;
      mount(key, page);
      await settle();
      expect(backs()).toHaveLength(1);
      expect(q('dancer-back')).not.toBeNull();
      expect(q('role-switch')).toBeNull();
    });

    it('flag ON, person read answered: exactly one Back', async () => {
      setHub(true);
      h.roles = roles;
      mount(key, page);
      await settle();
      expect(backs()).toHaveLength(1);
      // The bar's "Back to <name>" when there is a hub to go back to; otherwise today's Back.
      expect(q('role-switch-back') !== null).toBe(hub);
      expect(q('dancer-back') !== null).toBe(!hub);
      if (hub) expect(backs()[0].textContent).toBe('Back to Marta Silva');
      // Share stays in the card's top row either way.
      expect(q('dancer-share')).not.toBeNull();
    });

    it('flag ON, person read not answered yet: today\'s Back, never two', async () => {
      setHub(true);
      h.roles = roles;
      h.answered = false;
      mount(key, page);
      await settle();
      expect(backs()).toHaveLength(1);
      expect(q('dancer-back')).not.toBeNull();
      expect(q('role-switch')).toBeNull();
    });
  });
});

describe('a /people/:id tab (embedded prop, no context)', () => {
  it('flag ON: no bar and no Back (the person page owns Back)', async () => {
    setHub(true);
    h.roles = ['dj', 'dancer'];
    mount('photoless', { extrasOk: true, extras: NO_EXTRAS }, true);
    await settle();
    expect(q('dancer-role-bar')).toBeNull();
    expect(backs()).toHaveLength(0);
  });
});

describe('the bar blends into the teal page (flag ON)', () => {
  it('its warm ground is a layer behind the content that fades out at the sides AND the bottom', async () => {
    setHub(true);
    h.roles = ['dj', 'dancer'];
    mount('photoless', { extrasOk: true, extras: NO_EXTRAS });
    await settle();
    const bar = q('dancer-role-bar') as HTMLElement;
    // No solid box on the bar itself, nor on the switcher inside it: the ground lives in its own layer.
    expect(bar.style.background).toBe('');
    expect((q('role-switch') as HTMLElement).getAttribute('style')).toBeNull();
    const ground = q('dancer-role-bar-ground') as HTMLElement;
    expect(ground.getAttribute('aria-hidden')).toBe('true');
    expect(ground.parentElement).toBe(bar);
    expect(ground.className).toContain('-z-10');
    // jsdom drops calc() and mask styles, so the layer's styles are read from React's own markup.
    const html = renderToStaticMarkup(
      <MemoryRouter><DancerRoleBar model={{ back: { href: '/people/p1', label: 'Back to Marta Silva' }, pills: [] }} /></MemoryRouter>,
    );
    const side = 'linear-gradient(to right, transparent 0px, black 24px, black calc(100% - 24px), transparent 100%)';
    expect(html).toContain(`mask-image:${side}`);
    expect(html).toContain(`-webkit-mask-image:${side}`);
    expect(html).toContain('background:linear-gradient(to bottom, rgba(30, 20, 16, 0) 0px, #1E1410 12px, #1E1410 calc(100% - 32px), rgba(30, 20, 16, 0) 100%)');
    expect(html).toContain('padding-top:12px;padding-bottom:32px');
  });
});

describe('hero labels on the lightest teal stop', () => {
  const LIGHTEST = '#1C7D93';
  // Today's colours, kept byte for byte with the flag OFF (DANCER, then the facts and SPEAKS).
  const TODAY = ['#cff3f6', '#bfe9ee', '#bfe9ee', '#bfe9ee', '#bfe9ee'];
  const hex = (rgb: string) => `#${(rgb.match(/\d+/g) ?? []).slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
  const labels = () => Array.from((q('dancer-portrait') as HTMLElement).querySelectorAll<HTMLElement>('.tracking-\\[2px\\]'));

  it('flag ON: every small label measures >= 4.5 even on the lightest stop', async () => {
    setHub(true);
    mount('complete + all extras', { extrasOk: true, extras: EXTRAS.full });
    await settle();
    expect(labels().map((l) => l.textContent)).toEqual(['DANCER', 'Dancing', 'Level', 'Style', 'SPEAKS']);
    for (const l of labels()) expect(contrastRatio(hex(l.style.color), LIGHTEST), l.textContent ?? '').toBeGreaterThanOrEqual(4.5);
  });

  it('flag OFF: today\'s label colours, unchanged', async () => {
    mount('complete + all extras', { extrasOk: true, extras: EXTRAS.full });
    await settle();
    expect(labels().map((l) => hex(l.style.color))).toEqual(TODAY);
  });
});
