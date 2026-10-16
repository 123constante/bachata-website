// @vitest-environment jsdom
/**
 * The "Continue as..." screen and the "Switch profile" sheet render what
 * lib/accountRouting decides, for each account shape: the chooser never
 * appears for a single-side person, the sheet lists only the sides the person
 * really has, and every control the copy names is on screen.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { profileSides, type SidesFacts } from '@/lib/accountRouting';
import { DELETION_STATUS_KEY, type DeletionStatus } from '@/lib/accountDeletion';

const sides = vi.hoisted(() => ({ facts: null as unknown as SidesFacts }));
const auth = vi.hoisted(() => ({ signOut: vi.fn(async () => 'signed_out' as const) }));

vi.mock('../useProfileSides', () => ({
  useProfileSides: () => ({ facts: sides.facts, state: profileSides(sides.facts), openRequestCount: 0 }),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'me' }, signOut: auth.signOut }) }));
// The sign-in landing's deletion read (lib/accountDeletion). `seed` is what the cache already holds
// (undefined = nothing: the fetch runs, and `fetchFails` makes it reject).
const deletion = vi.hoisted(() => ({ seed: undefined as DeletionStatus | undefined, fetchFails: false }));
vi.mock('@/lib/accountDeletion', async (orig) => ({
  ...(await orig<typeof import('@/lib/accountDeletion')>()),
  fetchDeletionStatus: vi.fn(async () => {
    if (deletion.fetchFails) throw new Error('offline');
    return deletion.seed ?? { state: 'none', requested_at: null, restore_until: null };
  }),
}));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
vi.mock('@/components/auth/AuthGuard', () => ({ AuthGuard: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

import ContinueAsPage from '../ContinueAsPage';
import { ProfileSwitcher } from '../ProfileSwitcher';

const ORG_A = { id: 'org-a', name: 'Bachata Nights', avatar_url: null };
const ORG_B = { id: 'org-b', name: 'Sensual Sundays', avatar_url: null };
const FACE = { firstName: 'Ana', avatarUrl: null };

let here = '';
const Probe = () => {
  here = `${useLocation().pathname}${useLocation().search}`;
  return null;
};

const NONE: DeletionStatus = { state: 'none', requested_at: null, restore_until: null };
const mountAt = (path: string, ui: React.ReactNode, seed: DeletionStatus | null = NONE) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (seed) qc.setQueryData([DELETION_STATUS_KEY, 'me'], seed);
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="*" element={<>{ui}<Probe /></>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const SHAPES: Array<[string, SidesFacts, string[]]> = [
  ['dancer only', { organisers: [], dancer: 'complete', areaAllowed: true, dancerFace: FACE }, ['Ana']],
  ['organiser only', { organisers: [ORG_A], dancer: 'no_profile', areaAllowed: false }, ['Bachata Nights']],
  ['organiser + dancer', { organisers: [ORG_A], dancer: 'complete', areaAllowed: true, dancerFace: FACE }, ['Bachata Nights', 'Ana']],
  ['two organisers + dancer', { organisers: [ORG_A, ORG_B], dancer: 'complete', areaAllowed: true, dancerFace: FACE }, ['Bachata Nights', 'Sensual Sundays', 'Ana']],
  ['admin only', { organisers: [], dancer: 'no_profile', areaAllowed: false }, []],
];

afterEach(cleanup);

beforeEach(() => {
  here = '';
  auth.signOut.mockClear();
});

describe('Continue as...', () => {
  it.each(SHAPES)('%s', async (_n, facts, names) => {
    sides.facts = facts;
    mountAt('/account/continue', <ContinueAsPage />);
    if (names.length < 2) {
      await waitFor(() => expect(here).not.toBe('/account/continue'));
      expect(screen.queryByTestId('continue-as')).toBeNull();
      return;
    }
    expect(screen.getByRole('heading').textContent).toBe('Continue as…');
    const buttons = screen.getAllByRole('link');
    expect(buttons.map((b) => b.querySelector('.truncate')?.textContent)).toEqual(names);
    // Organisers first and primary; the dancer last.
    expect(buttons.map((b) => b.textContent?.endsWith('Organiser') ? 'Organiser' : 'Dancer')).toEqual(names.map((_, i) => (i < names.length - 1 ? 'Organiser' : 'Dancer')));
    fireEvent.click(buttons[0]);
    await waitFor(() => expect(here.startsWith('/account/o')).toBe(true));
  });

  it('the dancer button opens the dancer app', async () => {
    sides.facts = SHAPES[2][1];
    mountAt('/account/continue', <ContinueAsPage />);
    fireEvent.click(screen.getByTestId('continue-as-dancer'));
    await waitFor(() => expect(here).toBe('/app/home'));
  });

  // Delete = hide (admin PR #820): a deleted account goes to /account/restore before any side, for
  // every account shape; a failed read never blocks the sign-in.
  const PENDING: DeletionStatus = { state: 'pending', requested_at: '2026-10-01T10:00:00Z', restore_until: '2026-10-31T10:00:00Z' };
  const EXPIRED: DeletionStatus = { state: 'expired', requested_at: '2026-08-01T10:00:00Z', restore_until: '2026-08-31T10:00:00Z' };
  it.each(SHAPES.flatMap(([n, f]) => [[`${n}, pending`, f, PENDING] as const, [`${n}, expired`, f, EXPIRED] as const]))(
    'deleted account (%s) lands on /account/restore',
    async (_n, facts, seed) => {
      sides.facts = facts;
      mountAt('/account/continue', <ContinueAsPage />, seed);
      await waitFor(() => expect(here).toBe('/account/restore'));
    },
  );

  it('a failed deletion read carries on to the normal landing', async () => {
    deletion.fetchFails = true;
    sides.facts = SHAPES[0][1];
    mountAt('/account/continue', <ContinueAsPage />, null);
    await waitFor(() => expect(here).toBe('/app/home'));
    deletion.fetchFails = false;
  });

  it('waits (never a blank screen) while the reads load', () => {
    sides.facts = { organisers: undefined, dancer: 'complete', areaAllowed: true };
    mountAt('/account/continue', <ContinueAsPage />);
    expect(screen.getByTestId('continue-as-loading').textContent).toContain('Signing you in');
  });
});

describe('Switch profile sheet', () => {
  it.each(SHAPES.filter(([, , names]) => names.length > 0))('%s, in the dancer app', (_n, facts, names) => {
    sides.facts = facts;
    mountAt('/app/home', <ProfileSwitcher where={{ area: 'dancer' }} />);
    const several = names.length > 1;
    expect(screen.getByTestId('profile-switcher-button').getAttribute('aria-label')).toBe(several ? 'Switch profile' : 'Your account');
    fireEvent.click(screen.getByTestId('profile-switcher-button'));
    const sheet = screen.getByTestId('profile-switcher-sheet');
    expect(sheet.querySelector('h2')?.textContent).toBe(several ? 'Switch profile' : 'Your account');
    const items = [...screen.getByTestId('profile-switcher-sides').querySelectorAll('a')];
    expect(items.map((a) => a.querySelector('.font-semibold')?.textContent)).toEqual(names);
    const ticked = items.filter((a) => a.getAttribute('aria-current') === 'true').map((a) => a.querySelector('.font-semibold')?.textContent);
    expect(ticked).toEqual(facts.dancer === 'complete' ? ['Ana'] : []);
    expect(screen.getByTestId('profile-switcher-settings').getAttribute('href')).toBe('/account/settings');
    expect(screen.getByTestId('profile-switcher-sign-out')).toBeTruthy();
  });

  it('in the organiser area the tick follows ?o=', () => {
    sides.facts = SHAPES[3][1];
    mountAt('/account/o?o=org-b', <ProfileSwitcher where={{ area: 'organiser', organiserId: 'org-b' }} />);
    fireEvent.click(screen.getByTestId('profile-switcher-button'));
    expect(screen.getByTestId('profile-switcher-side-organiser:org-b').getAttribute('aria-current')).toBe('true');
    expect(screen.getByTestId('profile-switcher-side-dancer').getAttribute('aria-current')).toBeNull();
  });

  it('one tap switches, and the sheet closes', async () => {
    sides.facts = SHAPES[2][1];
    mountAt('/app/home', <ProfileSwitcher where={{ area: 'dancer' }} />);
    fireEvent.click(screen.getByTestId('profile-switcher-button'));
    fireEvent.click(screen.getByTestId('profile-switcher-side-organiser:org-a'));
    await waitFor(() => expect(here).toBe('/account/o'));
    expect(screen.queryByTestId('profile-switcher-sheet')).toBeNull();
  });

  it('sign out signs out and goes home', async () => {
    sides.facts = SHAPES[0][1];
    mountAt('/app/home', <ProfileSwitcher where={{ area: 'dancer' }} />);
    fireEvent.click(screen.getByTestId('profile-switcher-button'));
    fireEvent.click(screen.getByTestId('profile-switcher-sign-out'));
    await waitFor(() => expect(here).toBe('/'));
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });
});
