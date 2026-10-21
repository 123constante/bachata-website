// @vitest-environment jsdom
/**
 * Slice B audit fixes on /app/options: H3 (terms and privacy are live links),
 * H10 (sign-out goes through the shared sign-out-to-home), M16 (one word:
 * hidden, shared strings, Options x Home table), L9 (one control per
 * destination, organiser row below Help), L12 (no coming-soon role rows),
 * L13 (the account link label), L15 (native share sheet, else copy).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

vi.mock('@/hooks/useAuth', async (importOriginal) =>
  (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));

const h = vi.hoisted(() => ({
  signOutToHome: null as unknown as ReturnType<typeof import('vitest')['vi']['fn']>,
}));
vi.mock('@/components/account/profiles/signOutToHome', async (importOriginal) => {
  const mod = await importOriginal<Record<string, unknown>>();
  return { ...mod, useSignOutToHome: () => ({ signOutToHome: (...a: unknown[]) => h.signOutToHome(...a), busy: false }) };
});
vi.mock('@/contexts/CityContext', () => ({
  CityProvider: ({ children }: { children: ReactNode }) => children,
  useCity: () => ({ citySlug: 'london-gb', setCitySlug: () => {} }),
}));
vi.mock('@/hooks/useCalendarEventsRpc', () => ({ useCalendarEvents: () => ({ data: [], isLoading: false, isError: false }) }));
vi.mock('@/integrations/supabase/getSupabase', () => ({
  getSupabase: async () => ({
    rpc: async () => ({ data: [], error: null }),
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { slug: 'london-gb' }, error: null }) }) }) }),
  }),
}));

import { renderInShell, resetShell } from '@/modules/dancer-app/shell/renderInShell';
import { CITY_LONDON, FAKE_PROFILE_ID, makeProfile } from '@/modules/dancer-app/api/fixtures';
import { ACCOUNT_SETTINGS_LABEL, HIDDEN_STATE_LINE, SHOW_AGAIN_LABEL } from '@/modules/dancer-app/copy/sharedCopy';
import { SIGN_OUT_FAILED } from '@/components/account/profiles/signOutToHome';
import * as model from '../optionsModel';
import { optionsRows, shareUrlFor } from '../optionsModel';
import { withFromApp } from '@/lib/accountSettings';

const OWNED = [
  'src/modules/dancer-app/screens/options/OptionsScreen.tsx',
  'src/modules/dancer-app/screens/options/optionsModel.ts',
  'src/modules/dancer-app/screens/home/HomeScreen.tsx',
  'src/modules/dancer-app/screens/home/RateNudge.tsx',
  'src/modules/dancer-app/screens/home/LineupPeople.tsx',
  'src/modules/dancer-app/screens/nights/NightsScreen.tsx',
  'src/modules/dancer-app/screens/nights/nightsModel.ts',
];
const readSrc = async (f: string) => (await import('node:fs')).readFileSync(f, 'utf8');

const hidden = makeProfile({ first_name: 'Ana', based_city_id: CITY_LONDON.id, is_active: false });
const options = async (profile = makeProfile({ first_name: 'Ana', based_city_id: CITY_LONDON.id })) => {
  const r = renderInShell({ path: '/app/options', backend: { profile } });
  await screen.findByTestId('opt-share');
  return r;
};

beforeEach(() => { h.signOutToHome = vi.fn(); });
afterEach(() => { cleanup(); resetShell(); vi.unstubAllGlobals(); });

describe('H3: terms and privacy are live pages', () => {
  it('two working links, no disabled row, no "not published" reason', async () => {
    const rows = optionsRows(makeProfile());
    expect(rows.find((r) => r.id === 'terms')).toMatchObject({ label: 'Terms', href: '/terms' });
    expect(rows.find((r) => r.id === 'privacy')).toMatchObject({ label: 'Privacy policy', href: '/privacy' });
    expect(rows.find((r) => r.id === 'terms')?.disabledReason).toBeUndefined();
    expect('TERMS_REASON' in model).toBe(false);
    await options();
    expect(screen.getByTestId('opt-terms').getAttribute('href')).toBe('/terms');
    expect(screen.getByTestId('opt-privacy').getAttribute('href')).toBe('/privacy');
  });

  it.each(OWNED)('%s carries no "not published" / "not live" text', async (f) => {
    expect(await readSrc(f)).not.toMatch(/not (yet )?published|not live/i);
  });
});

describe('H10: sign-out goes through the shared sign-out-to-home', () => {
  it('confirm calls signOutToHome once', async () => {
    h.signOutToHome.mockResolvedValue('ok');
    await options();
    fireEvent.click(screen.getByTestId('opt-sign-out'));
    fireEvent.click(await screen.findByTestId('opt-signout-confirm'));
    await waitFor(() => expect(h.signOutToHome).toHaveBeenCalledTimes(1));
  });

  it("'failed' (still mounted): the shared failure line, and the button offers Retry", async () => {
    h.signOutToHome.mockResolvedValue('failed');
    await options();
    fireEvent.click(screen.getByTestId('opt-sign-out'));
    fireEvent.click(await screen.findByTestId('opt-signout-confirm'));
    expect((await screen.findByRole('alert')).textContent).toBe(SIGN_OUT_FAILED);
    expect(screen.getByTestId('opt-signout-confirm').textContent).toBe('Retry');
  });
});

describe('M16: one word for the hidden state (Options x Home)', () => {
  const surfaces = [
    {
      name: 'Options',
      render: async () => { await options(hidden); return screen.getByTestId('dancer-screen-options'); },
      line: () => screen.getByTestId('opt-why-share'),
    },
    {
      name: 'Home',
      render: async () => { renderInShell({ path: '/app/home', backend: { profile: hidden } }); await screen.findByTestId('paused-banner'); return screen.getByTestId('dancer-screen-home'); },
      line: () => screen.getByTestId('paused-banner'),
    },
  ];
  it.each(surfaces)('$name: the shared hidden line, the shared show-again label, no paused/unpause', async (s) => {
    const root = await s.render();
    expect(s.line().textContent).toContain(HIDDEN_STATE_LINE);
    expect(s.line().textContent).toContain(SHOW_AGAIN_LABEL);
    expect(root.textContent).not.toMatch(/paus/i);
    // The page the line points at is linked on screen.
    expect(within(root).getAllByRole('link').some((a) => (a.getAttribute('href') ?? '').startsWith('/account/settings'))).toBe(true);
  });

  it.each(OWNED)('%s never says paused / Unpause in copy', async (f) => {
    const src = (await readSrc(f)).replace(/data-testid="paused-banner"/g, '');
    expect(src).not.toMatch(/['"`>][^'"`<]*\b(un)?paused?\b/i);
  });
});

describe('L9 / L12: one control per destination; organiser below Help; no coming-soon rows', () => {
  it.each([
    ['pure dancer', []],
    ['teacher + DJ', ['teaching', 'djing']],
    ['organiser', ['organising']],
  ] as const)('%s', async (_n, roles) => {
    const rows = optionsRows(makeProfile({ other_roles: [...roles] }));
    const ids = rows.map((r) => r.id);
    expect(ids.indexOf('switch-organiser')).toBeGreaterThan(ids.indexOf('help'));
    expect(ids).not.toContain('switch-teacher');
    expect(ids).not.toContain('switch-dj');
    expect(rows.some((r) => /coming soon/i.test(`${r.label} ${r.disabledReason ?? ''}`))).toBe(false);
  });

  it('the screen has one link to the site home, not two', async () => {
    await options();
    const toHome = within(screen.getByTestId('dancer-screen-options')).getAllByRole('link').filter((a) => a.getAttribute('href') === '/');
    expect(toHome).toHaveLength(1);
    expect(screen.queryByTestId('opt-browse-events')).toBeNull();
  });
});

describe('L13: the account link uses the shared label', () => {
  it('reads ACCOUNT_SETTINGS_LABEL from sharedCopy', async () => {
    await options();
    expect(screen.getByRole('link', { name: ACCOUNT_SETTINGS_LABEL }).getAttribute('href')).toBe('/account/settings?from=app');
    expect(await readSrc(OWNED[0])).toMatch(/ACCOUNT_SETTINGS_LABEL/);
  });
});

describe('M4: Options opens settings in the from=app context', () => {
  it('the link is lib/accountSettings withFromApp, so settings shows Back to Options', () => {
    expect(model.ACCOUNT_SETTINGS_PATH).toBe(withFromApp('/account/settings', true));
  });
});

describe('L15: Share opens the native sheet when there is one', () => {
  it('navigator.share available: shares the URL, does not copy', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn();
    vi.stubGlobal('navigator', { ...navigator, share, clipboard: { writeText } });
    await options();
    fireEvent.click(screen.getByTestId('opt-share'));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(share.mock.calls[0][0]).toMatchObject({ url: shareUrlFor(FAKE_PROFILE_ID) });
    expect(writeText).not.toHaveBeenCalled();
  });

  it('the person cancels the share sheet: nothing is copied, no message', async () => {
    const share = vi.fn().mockRejectedValue(Object.assign(new Error('cancel'), { name: 'AbortError' }));
    const writeText = vi.fn();
    vi.stubGlobal('navigator', { ...navigator, share, clipboard: { writeText } });
    await options();
    fireEvent.click(screen.getByTestId('opt-share'));
    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.queryByText('Link copied')).toBeNull();
  });

  it('share fails for another reason: falls back to copying', async () => {
    const share = vi.fn().mockRejectedValue(new Error('NotAllowed'));
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, share, clipboard: { writeText } });
    await options();
    fireEvent.click(screen.getByTestId('opt-share'));
    await screen.findByText('Link copied');
    expect(writeText).toHaveBeenCalledWith(shareUrlFor(FAKE_PROFILE_ID));
  });

  it('no share and no clipboard: the manual field (kept)', async () => {
    vi.stubGlobal('navigator', { ...navigator, share: undefined, clipboard: undefined });
    await options();
    fireEvent.click(screen.getByTestId('opt-share'));
    expect(((await screen.findByTestId('opt-share-field')) as HTMLInputElement).value).toBe(shareUrlFor(FAKE_PROFILE_ID));
  });
});

describe('seeds', () => {
  it('long name + hidden + no city: Options renders every row', async () => {
    await options(makeProfile({ first_name: 'Maria-Fernanda-Alejandra-Xim', surname: 'Rodriguez-Villanueva', is_active: false }));
    expect(screen.getByTestId('opt-sign-out')).toBeTruthy();
  });
});

describe('journey check b: Options with no dancer profile says what to do', () => {
  it('shows the server reason and the Message us link, not a Retry that cannot help', async () => {
    renderInShell({ path: '/app/options', backend: { profile: null } });
    const link = await screen.findByRole('link', { name: /message us/i });
    expect(link.getAttribute('href')).toContain(encodeURIComponent('has no dancer profile yet'));
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });
});
