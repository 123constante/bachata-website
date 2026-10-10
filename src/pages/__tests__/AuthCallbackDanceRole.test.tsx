// @vitest-environment jsdom
/**
 * The dance role chosen at sign-up rides the EXISTING profile-fill path: the
 * signup trigger mints the stub, and /auth/callback fills it from the sign-up
 * metadata through save_my_dancer_profile_v1. Only a value the column admits is
 * sent. A successful sign-in also arms the one-time Finish-your-profile prompt.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';

const maybeSingle = vi.hoisted(() => vi.fn());
const getSession = vi.hoisted(() => vi.fn());
const saveMyDancerProfile = vi.hoisted(() => vi.fn());
const resolveCanonicalCity = vi.hoisted(() => vi.fn());
const user = vi.hoisted(() => ({ id: 'u1', user_metadata: {} as Record<string, unknown> }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
    auth: {
      getSession,
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}));
vi.mock('@/lib/saveMyDancerProfile', () => ({ saveMyDancerProfile }));
vi.mock('@/lib/city-canonical', () => ({ resolveCanonicalCity }));
vi.mock('@/modules/organiser-self-serve/selfServeApi', () => ({ fetchOrganiserHome: vi.fn() }));
vi.mock('@/lib/featureFlags', () => ({ flags: { organiserSelfServe: true } }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));

import AuthCallback from '../AuthCallback';
import { POST_LOGIN_PROMPT_KEY } from '@/lib/auth-otp-routing';

const STUB = { id: 'u1', first_name: null, based_city_id: null, meta_data: null };

const mount = () =>
  render(
    <MemoryRouter initialEntries={['/auth/callback?mode=signup']}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="*" element={<p>landed</p>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  maybeSingle.mockReset().mockResolvedValue({ data: STUB, error: null });
  resolveCanonicalCity.mockReset().mockResolvedValue({ cityId: 'c1' });
  saveMyDancerProfile.mockReset().mockResolvedValue({ first_name: 'Ana', based_city_id: 'c1' });
  getSession.mockReset().mockImplementation(async () => ({ data: { session: { user } } }));
});
afterEach(cleanup);

describe.each([
  ['Leader', { dance_role: 'Leader' }],
  ['Follower', { dance_role: 'Follower' }],
  ['Lead and Follow', { dance_role: 'Lead and Follow' }],
  ['a value the column refuses', {}],
  ['no role (older sign-up screens)', {}],
] as [string, Record<string, string>][])('metadata role: %s', (name, expected) => {
  it('fills the stub with it only when the column admits it', async () => {
    const role = name.startsWith('a value') ? 'Ninja' : name.startsWith('no role') ? undefined : name;
    user.user_metadata = { first_name: 'Ana', city: 'London', ...(role ? { dance_role: role } : {}) };
    mount();
    await waitFor(() => expect(saveMyDancerProfile).toHaveBeenCalledTimes(1));
    const sent = saveMyDancerProfile.mock.calls[0][0];
    expect(sent).toEqual({ first_name: 'Ana', based_city_id: 'c1', ...expected });
  });
});

it('a successful sign-in arms the one-time Finish-your-profile prompt', async () => {
  user.user_metadata = { first_name: 'Ana', city: 'London' };
  mount();
  await waitFor(() => expect(sessionStorage.getItem(POST_LOGIN_PROMPT_KEY)).toBe('1'));
});
