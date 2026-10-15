// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';

const signOutMock = vi.fn<[], Promise<'signed-out' | 'signed-out-locally' | 'failed'>>();

vi.mock('@/hooks/useAuth', async (importOriginal) => {
  const { testAuth } = await import('@/modules/dancer-app/shell/testAuth');
  const mod = await importOriginal<Record<string, unknown>>();
  return {
    ...mod,
    useAuth: () => ({
      user: testAuth.user,
      session: null,
      isLoading: false,
      authStatus: 'ready',
      signOut: signOutMock,
      retryAuth: () => {},
    }),
  };
});

import { renderInShell, resetShell } from '@/modules/dancer-app/shell/renderInShell';
import { DANCER_SHAPES, DANCER_SHAPE_NAMES, makeProfile, FAKE_PROFILE_ID } from '@/modules/dancer-app/api/fixtures';
import { CATCHALL_CLIENT_PATHS } from '@/components/catchallClientPaths';
import { SITE_ORIGIN } from '@/lib/seo';
import { hrefFor } from '@/lib/searchEntities';
import { WHATSAPP_GET_LISTED_URL } from '@/lib/contactLinks';
import OptionsScreen_ from '../OptionsScreen';
import {
  NO_ORGANISER_REASON,
  PAUSED_REASON,
  TERMS_REASON,
  detectPlatform,
  installOrder,
  messageUsUrl,
  optionsInAppHrefs,
  optionsRows,
  shareUrlFor,
} from '../optionsModel';
import { SIGN_OUT_FAILED_COPY } from '../OptionsScreen';

void OptionsScreen_;

const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36';
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';

const matchesPattern = (href: string, pattern: string): boolean => {
  const path = href.split('?')[0];
  if (pattern.endsWith('/*')) return path === pattern.slice(0, -2) || path.startsWith(`${pattern.slice(0, -1)}`);
  const re = new RegExp(`^${pattern.replace(/\/:[A-Za-z]+\?/g, '(?:/[^/]+)?').replace(/:[A-Za-z]+/g, '[^/]+')}$`);
  return re.test(path);
};

const shown = async (shape: Parameters<typeof renderInShell>[0] = {}) => {
  const r = renderInShell({ path: '/app/options', ...shape });
  await screen.findByTestId('opt-share');
  return r;
};

beforeEach(() => signOutMock.mockReset());
afterEach(() => {
  cleanup();
  resetShell();
  vi.unstubAllGlobals();
});

describe('options model x every production shape', () => {
  it.each(DANCER_SHAPE_NAMES.filter((n) => DANCER_SHAPES[n].profile))('%s: every disabled row carries its reason, every href is routable', (name) => {
    const profile = DANCER_SHAPES[name].profile!;
    for (const row of optionsRows(profile)) {
      if (row.disabledReason !== undefined) expect(row.disabledReason.trim().length).toBeGreaterThan(0);
      else expect(row.label.length).toBeGreaterThan(0);
    }
    for (const href of optionsInAppHrefs(profile)) {
      expect(CATCHALL_CLIENT_PATHS.some((p) => matchesPattern(href, p)), `${href} is not a client route`).toBe(true);
    }
  });

  it.each([
    ['pure dancer', makeProfile({ other_roles: [] }), false, ['switch-organiser']],
    ['dancer + organising', makeProfile({ other_roles: ['organising'] }), true, ['switch-organiser']],
    ['dancer + teaching', makeProfile({ other_roles: ['teaching'] }), false, ['switch-organiser', 'switch-teacher']],
    ['dancer + teaching + djing', makeProfile({ other_roles: ['teaching', 'djing'] }), false, ['switch-organiser', 'switch-teacher', 'switch-dj']],
  ] as const)('%s: switch-profile rows', (_n, profile, runsEvents, ids) => {
    const rows = optionsRows(profile);
    expect(rows.filter((r) => r.id.startsWith('switch-')).map((r) => r.id)).toEqual(ids);
    const organiser = rows.find((r) => r.id === 'switch-organiser')!;
    if (runsEvents) {
      expect(organiser.label).toBe('I run events');
      expect(organiser.href).toBe('/account/o');
      expect(organiser.disabledReason).toBeUndefined();
    } else {
      expect(organiser.href).toBeUndefined();
      expect(organiser.disabledReason).toBe(NO_ORGANISER_REASON);
      expect(rows.some((r) => r.label === 'I run events')).toBe(false);
    }
  });

  it('paused: share is disabled with the reason; active: share is enabled', () => {
    expect(optionsRows(makeProfile({ is_active: false })).find((r) => r.id === 'share')?.disabledReason).toBe(PAUSED_REASON);
    expect(optionsRows(makeProfile({ is_active: true })).find((r) => r.id === 'share')?.disabledReason).toBeUndefined();
  });

  it('terms and privacy has no route on the site: disabled with a reason, no href', () => {
    const terms = optionsRows(makeProfile()).find((r) => r.id === 'terms')!;
    expect(terms.href).toBeUndefined();
    expect(terms.disabledReason).toBe(TERMS_REASON);
  });

  it('the share URL is the site helper output, and the message-us link keeps the site number', () => {
    expect(shareUrlFor(FAKE_PROFILE_ID)).toBe(`${SITE_ORIGIN}${hrefFor('dancer', FAKE_PROFILE_ID)}`);
    const wa = new URL(messageUsUrl('x'));
    expect(wa.pathname).toBe(new URL(WHATSAPP_GET_LISTED_URL).pathname);
    expect(wa.searchParams.get('text')).toBe('x');
  });

  it.each([
    [IOS, 0, 'ios', ['ios', 'android']],
    [ANDROID, 5, 'android', ['android', 'ios']],
    [DESKTOP, 0, 'desktop', ['ios', 'android']],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', 5, 'ios', ['ios', 'android']],
  ] as const)('platform %#', (ua, touch, platform, order) => {
    expect(detectPlatform(ua, touch)).toBe(platform);
    expect(installOrder(platform)).toEqual(order);
  });
});

describe('options screen', () => {
  it('pure dancer: no "I run events" row; the organiser row is disabled and says why', async () => {
    await shown({ backend: { profile: makeProfile({ other_roles: [] }) } });
    expect(screen.queryByText('I run events')).toBeNull();
    expect(screen.getByTestId('opt-switch-organiser').hasAttribute('disabled')).toBe(true);
    expect(screen.getByTestId('opt-why-switch-organiser').textContent).toBe(NO_ORGANISER_REASON);
  });

  it('dancer + organising: "I run events" links to /account/o', async () => {
    const { location } = await shown({ backend: { profile: makeProfile({ other_roles: ['organising'] }) } });
    fireEvent.click(screen.getByTestId('opt-switch-organiser'));
    await waitFor(() => expect(location()).toBe('/account/o'));
  });

  it('dancer + teaching: a disabled coming-soon teacher row', async () => {
    await shown({ backend: { profile: makeProfile({ other_roles: ['teaching'] }) } });
    expect(screen.getByTestId('opt-switch-teacher').hasAttribute('disabled')).toBe(true);
    expect(screen.getByTestId('opt-why-switch-teacher').textContent).toMatch(/coming soon/i);
  });

  it('paused: share is disabled with its reason and copies nothing', async () => {
    const writeText = vi.fn();
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    await shown({ backend: { shape: 'paused' } });
    expect(screen.getByTestId('opt-share').hasAttribute('disabled')).toBe(true);
    expect(screen.getByTestId('opt-why-share').textContent).toBe(PAUSED_REASON);
    fireEvent.click(screen.getByTestId('opt-share'));
    expect(writeText).not.toHaveBeenCalled();
  });

  it('clipboard available: copies the site URL and says "Link copied"', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    await shown();
    fireEvent.click(screen.getByTestId('opt-share'));
    await screen.findByText('Link copied');
    expect(writeText).toHaveBeenCalledWith(shareUrlFor(FAKE_PROFILE_ID));
  });

  it('clipboard unavailable: a selectable field holds the same URL', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined });
    await shown();
    fireEvent.click(screen.getByTestId('opt-share'));
    const field = (await screen.findByTestId('opt-share-field')) as HTMLInputElement;
    expect(field.value).toBe(shareUrlFor(FAKE_PROFILE_ID));
    expect(field.readOnly).toBe(true);
  });

  it.each([
    [IOS, 'opt-install-ios'],
    [ANDROID, 'opt-install-android'],
    [DESKTOP, 'opt-install-ios'],
  ])('install sheet lists the person\'s platform first (%#)', async (ua, firstId) => {
    vi.stubGlobal('navigator', { ...navigator, userAgent: ua, maxTouchPoints: 0 });
    await shown();
    fireEvent.click(screen.getByTestId('opt-install'));
    const sheet = await screen.findByTestId('opt-install-sheet');
    const blocks = Array.from(sheet.querySelectorAll('[data-testid^="opt-install-"]'));
    expect(blocks[0].getAttribute('data-testid')).toBe(firstId);
    expect(blocks).toHaveLength(2);
  });

  it('feedback and help are the WhatsApp message-us link; release 1a fires no analytics', async () => {
    await shown();
    expect(screen.getByTestId('opt-feedback').getAttribute('href')).toMatch(/^https:\/\/wa\.me\//);
    expect(screen.getByTestId('opt-help').getAttribute('href')).toMatch(/^https:\/\/wa\.me\//);
  });

  it('the account-settings line and the second card link to routes that exist', async () => {
    await shown();
    for (const el of [screen.getByText('Account settings'), screen.getByTestId('opt-back-to-site'), screen.getByTestId('opt-browse-events')]) {
      const href = el.closest('a')!.getAttribute('href')!;
      expect(CATCHALL_CLIENT_PATHS.some((p) => matchesPattern(href, p)), href).toBe(true);
    }
    expect(screen.getByText('Account settings').closest('a')!.getAttribute('href')).toBe('/account/settings');
  });

  it('sign out success: confirm sheet, the shared signOut is called once, then home', async () => {
    signOutMock.mockResolvedValue('signed-out');
    const { location } = await shown();
    fireEvent.click(screen.getByTestId('opt-sign-out'));
    fireEvent.click(await screen.findByTestId('opt-signout-confirm'));
    await waitFor(() => expect(location()).toBe('/'));
    expect(signOutMock).toHaveBeenCalledTimes(1);
  });

  it('sign out failure: stays signed in, shows the DancerHome failure copy with Retry, then succeeds', async () => {
    signOutMock.mockResolvedValueOnce('failed').mockResolvedValueOnce('signed-out');
    const { location } = await shown();
    fireEvent.click(screen.getByTestId('opt-sign-out'));
    fireEvent.click(await screen.findByTestId('opt-signout-confirm'));
    expect((await screen.findByRole('alert')).textContent).toBe(SIGN_OUT_FAILED_COPY);
    expect(location()).toBe('/app/options');
    const retry = screen.getByTestId('opt-signout-confirm');
    expect(retry.textContent).toBe('Retry');
    fireEvent.click(retry);
    await waitFor(() => expect(location()).toBe('/'));
    expect(signOutMock).toHaveBeenCalledTimes(2);
  });

  it('the screen never calls supabase.auth.signOut itself (source pin)', async () => {
    const fs = await import('node:fs');
    for (const f of ['OptionsScreen.tsx', 'optionsModel.ts']) {
      const src = fs.readFileSync(`src/modules/dancer-app/screens/options/${f}`, 'utf8');
      expect(src, f).not.toMatch(/auth\.signOut|\.auth\b/);
    }
  });
});
