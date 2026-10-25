// @vitest-environment jsdom
/**
 * The dancer app's routes, gate and RedirectIfAllowed, through renderInShell
 * (the same util every wave-2 test uses). Table-driven:
 * - reachability: every route renders inside the shell for an allowed,
 *   complete person; /app redirects to /app/home; an unknown /app path too;
 * - gate matrix: signed out (NO gate request, bounced to /auth by AuthGuard),
 *   closed + unlisted, listed, open, error;
 * - RedirectIfAllowed matrix on /account, /account/dancer, /finish-profile:
 *   allowed complete -> /app/home, incomplete -> /app/welcome, organiser-type
 *   or open request or old organiser link -> stays, failed reads -> stays,
 *   gate loading -> today's page, never a blank screen;
 * - funnel events are never sent for a signed-out visitor.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';

vi.mock('@/hooks/useAuth', async (importOriginal) =>
  (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));

import { renderInShell, resetShell } from '@/modules/dancer-app/shell/renderInShell';
import { createFakeBackend } from '@/modules/dancer-app/api/fakeBackend';
import { DANCER_ROUTES, DANCER_TABS, activeTabFor } from '@/modules/dancer-app/shell/routes';
import { DANCER_SCREENS } from '@/modules/dancer-app/shell/DancerAppRoutes';
import { setDancerAnalyticsUser, trackDancerEvent } from '@/modules/dancer-app/analytics/events';
import { allowedRedirectTarget } from '@/modules/dancer-app/gate/redirectModel';

afterEach(() => {
  cleanup();
  resetShell();
  delete (window as { dataLayer?: unknown }).dataLayer;
});

const gateCalls = (b: ReturnType<typeof createFakeBackend>) => b.calls.filter((c) => c.fn === 'fetchGate').length;

describe('route table', () => {
  it('is exactly the INTERFACE section 5 list, each with a screen', () => {
    expect(DANCER_ROUTES.map((r) => r.path)).toEqual([
      '/app/welcome',
      '/app/home',
      '/app/nights',
      '/app/me',
      '/app/me/edit',
      '/app/me/photo',
      '/app/page',
      '/app/options',
    ]);
    for (const r of DANCER_ROUTES) expect(DANCER_SCREENS[r.id], r.id).toBeTypeOf('function');
  });

  it.each([
    ['/app/home', 'home'],
    ['/app/nights', 'nights'],
    ['/app/me', 'me'],
    ['/app/me/edit', 'me'],
    ['/app/me/photo', 'me'],
    ['/app/options', 'options'],
    ['/app/welcome', null],
    ['/APP/Home/', 'home'],
  ])('active tab for %s is %s', (path, tab) => {
    expect(activeTabFor(path)).toBe(tab);
  });
});

describe('reachability: an allowed, complete person reaches every route inside the shell', () => {
  it.each(DANCER_ROUTES.map((r) => [r.path, r.id] as const))('%s', async (path, id) => {
    const { location } = renderInShell({ path });
    expect(await screen.findByTestId(`dancer-screen-${id}`)).toBeTruthy();
    expect(screen.getByTestId('dancer-app-shell').getAttribute('data-profile')).toBe('dancer');
    // H5: /app/welcome keeps the setup frame until the profile read says the required steps are done.
    await waitFor(() => expect(screen.getByTestId('dancer-app-shell').getAttribute('data-chrome')).toBe('full'));
    // D120/D131: the "Bachata Calendar" home link is the one way to "/"; there is no Events button.
    expect(screen.getByTestId('site-home-link').getAttribute('href')).toBe('/');
    expect(screen.getByTestId('site-home-link').textContent).toBe('Bachata Calendar');
    expect(screen.queryByTestId('dancer-app-events')).toBeNull();
    expect(screen.getByTestId('dancer-app-type-label').textContent).toBe('Dancer');
    expect(DANCER_TABS.map((t) => screen.getByTestId(`dancer-app-tab-${t.id}`).getAttribute('href'))).toEqual(DANCER_TABS.map((t) => t.path));
    const current = DANCER_TABS.filter((t) => screen.getByTestId(`dancer-app-tab-${t.id}`).getAttribute('aria-current') === 'page');
    expect(current.map((t) => t.id)).toEqual(activeTabFor(path) ? [activeTabFor(path)] : []);
    expect(location()).toBe(path);
  });

  it.each(['/app', '/app/', '/app/not-a-screen'])('%s -> /app/home', async (path) => {
    const { location } = renderInShell({ path });
    expect(await screen.findByTestId('dancer-screen-home')).toBeTruthy();
    expect(location()).toBe('/app/home');
  });

  it('marks every /app page noindex', async () => {
    renderInShell({ path: '/app/me' });
    await screen.findByTestId('dancer-screen-me');
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex,nofollow');
  });
});

describe('gate matrix on /app/home', () => {
  it('signed out: NO gate request, bounced to /auth with returnTo', async () => {
    const backend = createFakeBackend({ gate: { open: true, allowed: true } });
    const { location } = renderInShell({ path: '/app/home', auth: 'signed-out', backend });
    await waitFor(() => expect(location()).toMatch(/^\/auth\?/));
    expect(location()).toContain(`returnTo=${encodeURIComponent('/app/home')}`);
    expect(gateCalls(backend)).toBe(0);
    expect(backend.calls).toEqual([]);
    expect(screen.queryByTestId('dancer-app-shell')).toBeNull();
  });

  it.each([
    ['closed + unlisted', { open: false, allowed: false }, '/account'],
    ['closed + listed', { open: false, allowed: true }, '/app/home'],
    ['open', { open: true, allowed: true }, '/app/home'],
  ])('%s -> %s', async (_label, gate, expected) => {
    const backend = createFakeBackend({ gate });
    const { location } = renderInShell({ path: '/app/home', backend });
    await waitFor(() => expect(location()).toBe(expected));
    if (expected === '/account') {
      expect(await screen.findByTestId('today-account')).toBeTruthy();
      expect(screen.queryByTestId('dancer-app-shell')).toBeNull();
    } else {
      expect(await screen.findByTestId('dancer-screen-home')).toBeTruthy();
    }
    expect(gateCalls(backend)).toBe(1);
  });

  it('gate error (every attempt fails): fails CLOSED to /account', async () => {
    const backend = createFakeBackend({ gate: { open: true, allowed: true } });
    backend.fetchGate = () => Promise.reject(new Error('network down'));
    const { location } = renderInShell({ path: '/app/home', backend });
    await waitFor(() => expect(location()).toBe('/account'));
    expect(screen.queryByTestId('dancer-app-shell')).toBeNull();
  });

  it('one failed gate read is retried once; a recovered read lets the person in', async () => {
    const backend = createFakeBackend({ gate: { open: false, allowed: true } });
    backend.failNextWith('unknown');
    const { location } = renderInShell({ path: '/app/home', backend });
    expect(await screen.findByTestId('dancer-screen-home')).toBeTruthy();
    expect(gateCalls(backend)).toBe(2);
    expect(location()).toBe('/app/home');
  });

  it('gate loading: no shell, no screen (a quiet placeholder)', async () => {
    const backend = createFakeBackend();
    backend.fetchGate = () => new Promise(() => {});
    renderInShell({ path: '/app/home', backend });
    expect(await screen.findByTestId('dancer-app-gate-loading')).toBeTruthy();
    expect(screen.queryByTestId('dancer-app-shell')).toBeNull();
  });
});

describe('RedirectIfAllowed on today\'s account pages', () => {
  const pages = [
    ['/account', 'account'],
    ['/account/dancer', 'account-dancer'],
    ['/finish-profile', 'finish-profile'],
  ] as const;

  describe.each(pages)('%s', (path, stub) => {
    it('signed out: today\'s page, NO gate request', async () => {
      const backend = createFakeBackend({ gate: { open: true, allowed: true } });
      const { location } = renderInShell({ path, auth: 'signed-out', backend });
      expect(await screen.findByTestId(`today-${stub}`)).toBeTruthy();
      await new Promise((r) => setTimeout(r, 20));
      expect(location()).toBe(path);
      expect(backend.calls).toEqual([]);
    });

    it('closed + unlisted: today\'s page', async () => {
      const backend = createFakeBackend({ gate: { open: false, allowed: false } });
      const { location } = renderInShell({ path, backend });
      expect(await screen.findByTestId(`today-${stub}`)).toBeTruthy();
      await waitFor(() => expect(gateCalls(backend)).toBe(1));
      await new Promise((r) => setTimeout(r, 20));
      expect(location()).toBe(path);
    });

    it('gate error (every attempt fails): today\'s page (fails closed)', async () => {
      const backend = createFakeBackend({ gate: { open: true, allowed: true } });
      let attempts = 0;
      backend.fetchGate = () => {
        attempts += 1;
        return Promise.reject(new Error('network down'));
      };
      const { location } = renderInShell({ path, backend });
      await waitFor(() => expect(attempts).toBe(2));
      await new Promise((r) => setTimeout(r, 30));
      expect(location()).toBe(path);
      expect(screen.getByTestId(`today-${stub}`)).toBeTruthy();
    });

    it('gate loading: today\'s page is on screen (never blank)', async () => {
      const backend = createFakeBackend();
      backend.fetchGate = () => new Promise(() => {});
      const { location } = renderInShell({ path, backend });
      expect(await screen.findByTestId(`today-${stub}`)).toBeTruthy();
      expect(location()).toBe(path);
    });

    it.each([
      ['listed, complete', { open: false, allowed: true }, 'fourFieldComplete', '/app/home'],
      ['open, complete', { open: true, allowed: true }, 'fourFieldComplete', '/app/home'],
      ['listed, incomplete', { open: false, allowed: true }, 'nameCityOnly', '/app/welcome'],
      ['listed, empty stub', { open: false, allowed: true }, 'emptyStub', '/app/welcome'],
    ] as const)('%s -> %s', async (_l, gate, shape, target) => {
      const { location } = renderInShell({ path, backend: { gate, shape } });
      await waitFor(() => expect(location()).toBe(target));
    });

    it.each([
      ['organiser', { organisers: 1 }],
      ['open access request', { openRequests: 1 }],
      ['organiser read failed', { organisers: 'fail' as const }],
      ['requests read failed', { openRequests: 'fail' as const }],
      ['organiser read still loading', { organisers: 'pending' as const }],
    ])('allowed but %s: /account/dancer opens the app (it IS the dancer side); the others stay', async (_l, extra) => {
      const backend = createFakeBackend({ gate: { open: true, allowed: true } });
      const { location } = renderInShell({ path, backend, ...extra });
      await waitFor(() => expect(gateCalls(backend)).toBe(1));
      if (path === '/account/dancer') {
        // Owner report 2026-10-15: an organiser's "Your dancer profile" kept them on the old home.
        await waitFor(() => expect(location()).toBe('/app/home'));
        return;
      }
      await new Promise((r) => setTimeout(r, 30));
      expect(location()).toBe(path);
      expect(screen.getByTestId(`today-${stub}`)).toBeTruthy();
    });

    it.each([
      ['profile check loading', 'loading' as const],
      ['no persona', 'no_profile' as const],
      ['profile check error', 'error' as const],
    ])('allowed but %s: stays on today\'s page', async (_l, profileGate) => {
      const { location } = renderInShell({ path, backend: { gate: { open: true, allowed: true } }, profileGate });
      await new Promise((r) => setTimeout(r, 30));
      expect(location()).toBe(path);
    });
  });

  it('an old organiser link (/account?add=1) is never redirected, even for an allowed non-organiser', async () => {
    const { location } = renderInShell({ path: '/account?add=1', backend: { gate: { open: true, allowed: true } } });
    await new Promise((r) => setTimeout(r, 30));
    expect(location()).toBe('/account?add=1');
  });
});

describe('allowedRedirectTarget (the decision, as a table)', () => {
  const base = { legacyParams: false, organiserCount: 0, openRequestCount: 0, profile: 'complete' as const };
  it.each([
    ['complete non-organiser', base, '/app/home'],
    ['incomplete', { ...base, profile: 'incomplete' as const }, '/app/welcome'],
    ['no_profile', { ...base, profile: 'no_profile' as const }, null],
    ['error', { ...base, profile: 'error' as const }, null],
    ['loading', { ...base, profile: 'loading' as const }, null],
    ['no profile context', { ...base, profile: null }, null],
    ['organiser', { ...base, organiserCount: 2 }, null],
    ['open request', { ...base, openRequestCount: 1 }, null],
    ['legacy link', { ...base, legacyParams: true }, null],
    ['organiser read failed', { ...base, organiserCount: null }, null],
    ['requests read failed', { ...base, openRequestCount: null }, null],
    ['organiser read loading', { ...base, organiserCount: undefined }, null],
  ])('%s -> %s', (_l, facts, target) => {
    expect(allowedRedirectTarget(facts)).toBe(target);
  });
});

describe('funnel events', () => {
  it('trackDancerEvent sends nothing for a signed-out visitor', () => {
    window.dataLayer = [];
    setDancerAnalyticsUser(null);
    expect(trackDancerEvent('dancer_app_entered', { source: 'test' })).toBe(false);
    expect(window.dataLayer).toEqual([]);
  });

  it('sends through trackAnalyticsEvent once the shell publishes a signed-in person', async () => {
    window.dataLayer = [];
    renderInShell({ path: '/app/home' });
    await screen.findByTestId('dancer-screen-home');
    expect(trackDancerEvent('onboarding_step', { step: 'photo' })).toBe(true);
    expect(window.dataLayer).toEqual([{ event: 'onboarding_step', step: 'photo' }]);
  });

  it('a signed-out render of /app publishes nobody', async () => {
    window.dataLayer = [];
    const { location } = renderInShell({ path: '/app/home', auth: 'signed-out' });
    await waitFor(() => expect(location()).toMatch(/^\/auth/));
    expect(trackDancerEvent('feedback_sent', {})).toBe(false);
    expect(window.dataLayer).toEqual([]);
  });
});
