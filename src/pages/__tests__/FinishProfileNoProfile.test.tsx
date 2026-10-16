// @vitest-environment jsdom
/**
 * Audit H6: a signed-in account with NO dancer profile. The server cannot make one from the site
 * (my_dancer_edit_v1 and save_my_dancer_profile_v2 raise no_profile; the stub is made only by the
 * auth.users insert trigger), so /app/welcome cannot help either. The page is titled for a new
 * account and gives real next steps; the fact and the contact link are the ONE shared ones
 * (lib/profileCompletion), so their wording is fixed there, not here.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEffect, type ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ProfileCompletion } from '@/lib/profileCompletion';

const h = vi.hoisted(() => ({ completion: null as unknown as ProfileCompletion }));
vi.mock('@/hooks/useProfileCompletion', () => ({
  useProfileCompletion: () => ({ ...h.completion, refetch: async () => h.completion }),
  profileCompletionQueryKey: (id: string) => ['profile-completion', id],
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/lib/saveMyDancerProfile', () => ({ saveMyDancerProfile: vi.fn() }));
vi.mock('@/components/auth/AuthGuard', () => ({ AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));

import { FinishProfileScreen } from '../FinishProfile';
import { DANCER_GATE_REASON } from '@/lib/accountRouting';
import { NO_PROFILE_CONTACT_URL, completenessFact } from '@/lib/profileCompletion';
import { ACCOUNT_SETTINGS_LABEL } from '@/modules/dancer-app/copy/sharedCopy';

let path = '';
const Probe = () => {
  const l = useLocation();
  useEffect(() => {
    path = `${l.pathname}${l.search}`;
  });
  return null;
};
const mount = (at: string) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[at]}>
        <Probe />
        <Routes>
          <Route path="/finish-profile" element={<FinishProfileScreen />} />
          <Route path="*" element={<p>elsewhere</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  path = '';
  h.completion = { status: 'no_profile', missing: ['first_name', 'based_city_id', 'dance_role', 'avatar_url'], profileId: null };
});
afterEach(cleanup);

const PLAIN = `/finish-profile?returnTo=${encodeURIComponent('/')}`;
const GATED = `/finish-profile?returnTo=${encodeURIComponent('/account/o')}`;

describe.each([
  ['after sign-up (plain)', PLAIN],
  ['from the organiser link (gated)', GATED],
])('no dancer profile: %s', (_n, at) => {
  it('is titled for setting up, not finishing, and states the one shared fact', () => {
    mount(at);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Set up your dancer profile');
    expect(screen.getByTestId('finish-profile-no-profile').textContent).toBe(completenessFact(h.completion).text);
    expect(screen.queryByRole('button', { name: /^save/i })).toBeNull();
  });

  it('Message us is the one shared contact link', () => {
    mount(at);
    expect(screen.getByRole('link', { name: /message us on whatsapp/i }).getAttribute('href')).toBe(NO_PROFILE_CONTACT_URL);
  });

  it('keeps the account settings way out, under its one name', () => {
    mount(at);
    expect(screen.getByTestId('finish-profile-settings').textContent?.startsWith(ACCOUNT_SETTINGS_LABEL)).toBe(true);
  });
});

it('plain: says the site still works, and "Not now" goes on to where they were going', async () => {
  mount(`/finish-profile?returnTo=${encodeURIComponent('/event/e1')}`);
  expect(screen.getByText('You can still browse events in the meantime.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
  await waitFor(() => expect(path).toBe('/event/e1'));
});

it('gated: says why, and offers the calendar (the organiser page would bounce back)', () => {
  mount(GATED);
  expect(screen.getByTestId('finish-profile-gate-reason').textContent).toBe(DANCER_GATE_REASON);
  expect(screen.queryByRole('button', { name: 'Not now' })).toBeNull();
  expect(screen.queryByText(/browse events in the meantime/)).toBeNull();
  expect(screen.getByRole('link', { name: 'Back to the calendar' }).getAttribute('href')).toBe('/');
});
