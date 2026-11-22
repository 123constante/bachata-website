// @vitest-environment jsdom
/**
 * Dancer layout C, slice S2 (brief dancer-layout-c-s2): three tabs, Me gets Settings, the
 * /app/options and /app/tickets redirects, and the preview (teaser) twins. Layout C is ON for
 * this whole file (the route table reads it once); ticketing and teaser flip per test.
 * Flag-off behaviour stays pinned by the existing shell / options / tickets tests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({ tix: false, teaser: false }));
vi.mock('@/hooks/useAuth', async (importOriginal) =>
  (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));
vi.mock('@/modules/dancer-app/screens/home/layoutCFlag', () => ({ DANCER_LAYOUT_C_ENABLED: true }));
vi.mock('@/modules/dancer-app/screens/teaser/teaserFlag', () => ({ get TICKET_TEASER_ENABLED() { return h.teaser; } }));
vi.mock('@/lib/featureFlags', async (orig) => {
  const real = await orig<typeof import('@/lib/featureFlags')>();
  return { ...real, flags: new Proxy(real.flags, { get: (t, k) => (k === 'publicTicketing' ? h.tix : Reflect.get(t, k)) }) };
});
const api = vi.hoisted(() => ({ mine: vi.fn(), order: vi.fn() }));
vi.mock('@/modules/tickets/myTicketsApi', () => ({ fetchOrderQr: api.order, fetchMyTickets: api.mine }));

import { renderInShell, resetShell } from '@/modules/dancer-app/shell/renderInShell';
import { makeProfile } from '@/modules/dancer-app/api/fixtures';
import { DANCER_APP_PATHS, LAYOUT_C_REDIRECTS, LAYOUT_C_TABS, shellTabs } from '@/modules/dancer-app/shell/routes';
import { CATCHALL_CLIENT_PATHS } from '@/components/catchallClientPaths';
import { ME_SETTINGS_ORDER, meSettingsRows } from '@/modules/dancer-app/screens/me/MeScreen';
import { BECOME_ORGANISER_LABEL, BECOME_ORGANISER_BETA_NOTE } from '@/modules/dancer-app/screens/options/optionsModel';

const COMPLETE = makeProfile({ first_name: 'Ana', based_city_id: '00000000-0000-4000-8000-000000000001', dance_role: 'leader', bachata_level: 'intermediate' } as never);

beforeEach(() => {
  h.tix = false;
  h.teaser = false;
  api.mine.mockResolvedValue({ kind: 'ok', reply: { tickets: [], truncated: false, totalCount: 0 } });
});
afterEach(() => {
  cleanup();
  resetShell();
});

const tabIds = () => Array.from(screen.getByTestId('dancer-app-tabs').querySelectorAll('[data-testid^="dancer-app-tab-"]')).map((el) => el.getAttribute('data-testid')!.replace('dancer-app-tab-', ''));

describe('layout C tabs (pure)', () => {
  it.each([
    [false, false, ['home', 'nights', 'me', 'options']],
    [true, false, ['tickets', 'home', 'nights', 'me', 'options']],
    [false, true, ['home', 'nights', 'me']],
    [true, true, ['home', 'nights', 'me']],
  ] as const)('ticketsOn %s, layoutC %s -> %j', (tix, c, ids) => {
    expect(shellTabs(tix, c).map((t) => t.id)).toEqual(ids);
  });
  it('keeps both old route ids answering, and in the catch-all list', () => {
    expect(LAYOUT_C_REDIRECTS).toEqual({ options: '/app/me', tickets: '/app/home' });
    for (const p of ['/app/options', '/app/tickets']) {
      expect(DANCER_APP_PATHS).toContain(p);
      expect(CATCHALL_CLIENT_PATHS.some((c) => c === p || c === '/app/*')).toBe(true);
    }
    expect(LAYOUT_C_TABS.map((t) => t.label)).toEqual(['Home', 'Nights', 'Me']);
  });
});

describe('layout C shell tabs (rendered): publicTicketing x teaser x who', () => {
  it.each([
    ['ticketing off, complete', false, false, { profile: COMPLETE }, '/app/me', false],
    ['ticketing on, complete', true, false, { profile: COMPLETE }, '/app/me', false],
    ['ticketing on, teaser on, unfinished', true, true, { profile: makeProfile() }, '/app/me', false],
    ['ticketing on, no profile (locked)', true, false, { profile: null }, '/app/me', true],
  ] as const)('%s: exactly Home, Nights, Me', async (_n, tix, teaser, backend, path, locked) => {
    h.tix = tix;
    h.teaser = teaser;
    renderInShell({ path, backend: backend as never });
    await waitFor(() => expect(tabIds()).toEqual(['home', 'nights', 'me']));
    if (locked) {
      await waitFor(() => expect(screen.getByTestId('dancer-app-tab-home').getAttribute('data-locked')).toBe('true'));
    }
  });
});

describe('layout C shell tabs: view-only buyer', () => {
  it('keeps the Tickets tab on /app/tickets (their only screen), tabs locked', async () => {
    h.tix = true;
    h.teaser = false;
    renderInShell({ path: '/app/tickets', backend: { gate: { open: false, allowed: false } } });
    await waitFor(() => expect(tabIds()).toEqual(['tickets', 'home', 'nights', 'me']));
    await waitFor(() => expect(screen.getByTestId('dancer-app-tab-home').getAttribute('data-locked')).toBe('true'));
  });
});

describe('layout C redirects', () => {
  it.each([
    ['/app/options', '/app/me'],
    ['/app/tickets', '/app/home'],
    ['/app/tickets?o=abc', '/app/home?o=abc'],
  ])('%s -> %s', async (from, to) => {
    const r = renderInShell({ path: from, backend: { profile: COMPLETE } });
    await waitFor(() => expect(r.location()).toBe(to));
  });
  it('a view-only buyer keeps /app/tickets (their only screen)', async () => {
    h.tix = true;
    const r = renderInShell({ path: '/app/tickets', backend: { gate: { open: false, allowed: false } } });
    await screen.findByTestId('dancer-app-tabs');
    await new Promise((res) => setTimeout(res, 50));
    expect(r.location()).toBe('/app/tickets');
  });
});

describe('layout C Me', () => {
  it('Settings rows in the owner order, from optionsRows', () => {
    expect(ME_SETTINGS_ORDER).toEqual(['account', 'areas', 'switch-organiser', 'feedback', 'help', 'install', 'terms', 'privacy']);
    const rows = meSettingsRows([]);
    expect(rows.map((r) => r.label)).toEqual(['Account settings', 'Your areas', BECOME_ORGANISER_LABEL, "Send feedback: what's missing?", 'Help and message us', "Add to my phone's home screen", 'Terms', 'Privacy policy']);
    expect(rows[2].sublabel).toBe(BECOME_ORGANISER_BETA_NOTE);
    expect(meSettingsRows(['organising'])[2]).toMatchObject({ label: 'I run events', href: '/account/o' });
  });

  it('renders profile rows, Settings, Back to website; no My page, no Share, no Sign out', async () => {
    renderInShell({ path: '/app/me', backend: { profile: COMPLETE } });
    await screen.findByTestId('me-settings');
    expect(screen.getByTestId('me-settings-head').textContent).toBe('Settings');
    const ids = Array.from(screen.getByTestId('me-settings').querySelectorAll('[data-testid^="me-set-"]')).map((e) => e.getAttribute('data-testid'));
    expect(ids).toEqual(ME_SETTINGS_ORDER.map((id) => `me-set-${id}`));
    expect(screen.getByTestId('me-public-page')).toBeTruthy();
    expect(screen.getByTestId('me-back-to-site').getAttribute('href')).toBe('/');
    expect(screen.getByTestId('me-set-areas').getAttribute('href')).toBe('/account/areas');
    expect(screen.getByTestId('me-set-account').getAttribute('href')).toMatch(/^\/account/);
    expect(screen.queryByTestId('me-my-page')).toBeNull();
    expect(screen.queryByText('Share my page')).toBeNull();
    expect(screen.queryByText('Sign out')).toBeNull();
    // Section order: Settings after the profile rows, Back to website last.
    const all = Array.from(document.querySelectorAll('[data-testid="me-public-page"], [data-testid="me-settings"], [data-testid="me-back-to-site"]')).map((e) => e.getAttribute('data-testid'));
    expect(all).toEqual(['me-public-page', 'me-settings', 'me-back-to-site']);
  });

  it('Send feedback and Add to home screen open their sheets', async () => {
    renderInShell({ path: '/app/me', backend: { profile: COMPLETE } });
    fireEvent.click(await screen.findByTestId('me-set-install'));
    expect(await screen.findByTestId('opt-install-sheet')).toBeTruthy();
  });

  it('a hidden profile keeps See my public page disabled', async () => {
    renderInShell({ path: '/app/me', backend: { profile: { ...COMPLETE, is_active: false } } });
    await screen.findByTestId('me-settings');
    expect(screen.getByTestId('me-public-page-reason')).toBeTruthy();
  });

  it('no profile: Me keeps the way out (Account settings, Sign out)', async () => {
    renderInShell({ path: '/app/me', backend: { profile: null } });
    await screen.findByTestId('dancer-state-me');
    await waitFor(() => expect(screen.getByText('Sign out')).toBeTruthy());
  });
});

describe('layout C preview (teaser) twins', () => {
  beforeEach(() => {
    h.tix = true;
    h.teaser = true;
  });
  it('Me: ghosts Edit + See my public page, live Settings except feedback/install, Back, then Sign out last', async () => {
    renderInShell({ path: '/app/me', backend: { profile: makeProfile() } });
    await screen.findByTestId('teaser-me');
    await screen.findByTestId('me-settings');
    const me = screen.getByTestId('teaser-me');
    const ghosts = Array.from(me.querySelectorAll('.tz-lock')).map((b) => b.getAttribute('aria-label')!.split(',')[0]);
    expect(ghosts).toEqual(['Edit my profile', 'See my public page', "Send feedback: what's missing?", "Add to my phone's home screen"]);
    expect(screen.getByTestId('me-set-feedback').getAttribute('data-locked')).toBe('true');
    expect(screen.getByTestId('me-set-areas').getAttribute('href')).toBe('/account/areas');
    const order = Array.from(me.querySelectorAll('[data-testid="me-settings"], [data-testid="me-back-to-site"], [data-testid="teaser-me-sign-out"]')).map((e) => e.getAttribute('data-testid'));
    expect(order).toEqual(['me-settings', 'me-back-to-site', 'teaser-me-sign-out']);
    fireEvent.click(me.querySelectorAll('.tz-lock')[2]);
    expect(await screen.findByTestId('teaser-sheet')).toBeTruthy();
  });
  it('Home: ghosts Share my page, Preview my page, Plans, Nights attended', async () => {
    renderInShell({ path: '/app/home', backend: { profile: makeProfile() } });
    const home = await screen.findByTestId('teaser-home');
    const ghosts = Array.from(home.querySelectorAll('.tz-lock')).map((b) => b.getAttribute('aria-label')!.split(',')[0]);
    expect(ghosts).toEqual(['Share my page', 'Preview my page', 'Plans', 'Nights attended']);
  });
  it('the teaser Options screen is not reachable', async () => {
    const r = renderInShell({ path: '/app/options', backend: { profile: makeProfile() } });
    await screen.findByTestId('teaser-me');
    expect(r.location()).toBe('/app/me');
    expect(screen.queryByTestId('teaser-options')).toBeNull();
  });
});
