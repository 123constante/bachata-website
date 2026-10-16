// @vitest-environment jsdom
/**
 * H10: sign-out lands on the site home "/", never /auth?mode=signin -- the
 * person leaves the guarded page BEFORE the session goes (AuthGuard would
 * otherwise redirect first). A failure is told truthfully and nothing moves.
 * L23: the switcher asks before signing out, like Options and Account settings.
 * L10: the sheet is the dancer plum surface inside the dancer app.
 * L13: the account page is called ACCOUNT_SETTINGS_LABEL.
 * L26: no raw Unicode punctuation in these sources.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { profileSides, type SidesFacts } from '@/lib/accountRouting';
import { ACCOUNT_SETTINGS_LABEL } from '@/modules/dancer-app/copy/sharedCopy';

const sides = vi.hoisted(() => ({ facts: null as unknown as SidesFacts }));
const auth = vi.hoisted(() => ({ outcome: 'signed-out' as 'signed-out' | 'failed', at: [] as string[] }));
const toastError = vi.hoisted(() => vi.fn());
let here = '';

vi.mock('../useProfileSides', () => ({
  useProfileSides: () => ({ facts: sides.facts, state: profileSides(sides.facts), openRequestCount: 0 }),
}));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'me' },
    signOut: async () => {
      auth.at.push(here);
      return auth.outcome;
    },
  }),
}));
vi.mock('sonner', () => ({ toast: { error: toastError } }));

import { ProfileSwitcher } from '../ProfileSwitcher';
import { SIGN_OUT_FAILED, useSignOutToHome } from '../signOutToHome';

const Probe = () => {
  const l = useLocation();
  here = `${l.pathname}${l.search}`;
  return null;
};

const mountAt = (p: string, ui: React.ReactNode) =>
  render(
    <MemoryRouter initialEntries={[p]}>
      <Routes>
        <Route path="*" element={<>{ui}<Probe /></>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  here = '';
  auth.outcome = 'signed-out';
  auth.at = [];
  toastError.mockClear();
  sides.facts = { organisers: [], dancer: 'complete', areaAllowed: true, dancerFace: { firstName: 'Ana', avatarUrl: null } };
});
afterEach(cleanup);

let result: 'signed-out' | 'signed-out-locally' | 'failed' | null = null;
const HookProbe = () => {
  const { signOutToHome, busy } = useSignOutToHome();
  return (
    <button type="button" data-testid="go" data-busy={busy ? '1' : '0'} onClick={() => void signOutToHome().then((r) => (result = r))}>
      go
    </button>
  );
};

describe('useSignOutToHome', () => {
  it.each(['/app/options', '/app/home?x=1', '/account/o'])('from %s: leaves for / first, then signs out, and stays on /', async (from) => {
    result = null;
    mountAt(from, <HookProbe />);
    await act(async () => fireEvent.click(screen.getByTestId('go')));
    await waitFor(() => expect(result).toBe('signed-out'));
    expect(auth.at).toEqual(['/']);
    expect(here).toBe('/');
    expect(toastError).not.toHaveBeenCalled();
  });

  it('failure: a true error, and the person is back where they were (still signed in)', async () => {
    result = null;
    auth.outcome = 'failed';
    mountAt('/app/options', <HookProbe />);
    await act(async () => fireEvent.click(screen.getByTestId('go')));
    await waitFor(() => expect(result).toBe('failed'));
    expect(toastError).toHaveBeenCalledWith(SIGN_OUT_FAILED);
    expect(here).toBe('/app/options');
  });
});

describe('switcher sign-out asks first (L23)', () => {
  const open = () => {
    mountAt('/app/home', <ProfileSwitcher where={{ area: 'dancer' }} />);
    fireEvent.click(screen.getByTestId('profile-switcher-button'));
  };

  it('the first tap only asks; Cancel signs nothing out', () => {
    open();
    fireEvent.click(screen.getByTestId('profile-switcher-sign-out'));
    expect(auth.at).toEqual([]);
    expect(screen.getByTestId('profile-switcher-signout-confirm').textContent).toContain('Yes, sign out');
    fireEvent.click(screen.getByTestId('profile-switcher-signout-cancel'));
    expect(screen.queryByTestId('profile-switcher-signout-confirm')).toBeNull();
    expect(screen.getByTestId('profile-switcher-sign-out')).toBeTruthy();
    expect(auth.at).toEqual([]);
  });

  it('Yes, sign out: signs out from the site home and lands on /', async () => {
    open();
    fireEvent.click(screen.getByTestId('profile-switcher-sign-out'));
    await act(async () => fireEvent.click(screen.getByTestId('profile-switcher-signout-confirm')));
    await waitFor(() => expect(here).toBe('/'));
    expect(auth.at).toEqual(['/']);
  });
});

describe('sheet surface and naming', () => {
  it('L10: inside the dancer app the sheet is the plum dancer surface', () => {
    mountAt('/app/home', <ProfileSwitcher where={{ area: 'dancer' }} />);
    fireEvent.click(screen.getByTestId('profile-switcher-button'));
    const sheet = screen.getByTestId('profile-switcher-sheet');
    expect(sheet.closest('[data-profile="dancer"]')).not.toBeNull();
    expect(sheet.style.background).toBe('var(--da-surface)');
  });

  it('the organiser area keeps the site surface', () => {
    mountAt('/account/o', <ProfileSwitcher where={{ area: 'organiser', organiserId: null }} />);
    fireEvent.click(screen.getByTestId('profile-switcher-button'));
    expect(screen.getByTestId('profile-switcher-sheet').closest('[data-profile="dancer"]')).toBeNull();
  });

  // Review #789 S1: inside the dancer app the settings row keeps "Back to Options"; elsewhere a plain link.
  it.each([
    [{ area: 'dancer' as const }, '/account/settings?from=app'],
    [{ area: 'organiser' as const, organiserId: null }, '/account/settings'],
  ])('S1: settings row from %o goes to %s', (where, href) => {
    mountAt('/app/home', <ProfileSwitcher where={where} />);
    fireEvent.click(screen.getByTestId('profile-switcher-button'));
    expect(screen.getByTestId('profile-switcher-settings').getAttribute('href')).toBe(href);
  });

  it('S1: the dancer-app hidden-profile banners link in-app to settings with ?from=app', () => {
    for (const f of ['src/modules/dancer-app/screens/home/HomeScreen.tsx', 'src/modules/dancer-app/screens/me/MeScreen.tsx']) {
      const src = readFileSync(path.resolve(__dirname, '../../../../..', f), 'utf8');
      expect(src).not.toMatch(/<a\s+href=\{?["'`]?(\/account\/settings|\{ACCOUNT_SETTINGS_PATH)/);
      expect(src).toMatch(/<Link to=\{APP_ACCOUNT_SETTINGS_PATH\}/);
    }
  });

  it('L13: the settings row is called ACCOUNT_SETTINGS_LABEL', () => {
    mountAt('/app/home', <ProfileSwitcher where={{ area: 'dancer' }} />);
    fireEvent.click(screen.getByTestId('profile-switcher-button'));
    expect(screen.getByTestId('profile-switcher-settings').textContent).toBe(ACCOUNT_SETTINGS_LABEL);
  });
});

describe('L26: no raw Unicode punctuation in the owned sources', () => {
  const ROOT = path.resolve(__dirname, '../../../../..');
  const FILES = [
    'src/components/account/profiles/ProfileSwitcher.tsx',
    'src/components/account/profiles/SideAvatar.tsx',
    'src/components/account/profiles/PersonAvatar.tsx',
    'src/components/account/profiles/avatarFallback.ts',
    'src/components/account/profiles/signOutToHome.ts',
    'src/components/account/profiles/ContinueAsPage.tsx',
    'src/components/account/profiles/useProfileSides.ts',
    'src/modules/dancer-app/shell/DancerAppShell.tsx',
    'src/modules/dancer-app/shell/DancerAppRoutes.tsx',
    'src/modules/dancer-app/shell/focusChrome.ts',
    'src/modules/dancer-app/shell/routes.ts',
    'src/modules/dancer-app/screens/me/ui.tsx',
  ];
  it.each(FILES)('%s', (f) => {
    const src = readFileSync(path.join(ROOT, f), 'utf8');
    expect(src.match(/[‐-‟… ]/g) ?? []).toEqual([]);
  });
});
