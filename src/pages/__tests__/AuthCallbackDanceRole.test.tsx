// @vitest-environment jsdom
/**
 * The dance role chosen at sign-up rides the EXISTING profile-fill path: the
 * signup trigger mints the stub, and /auth/callback fills it from the sign-up
 * metadata through save_my_dancer_profile_v1. Only a value the column admits is
 * sent.
 *
 * The save lands on the RESOLVED persona (resolve_my_person_id_v1 ->
 * _my_dancer_profile_id_v1: a linked admin-made profile, else the caller's own
 * row), and it overwrites dance_role whenever the key is present and name/city
 * whenever a value is sent. So the callback reads THAT row and sends only the
 * fields that are empty there -- never a key whose value is already set.
 *
 * The one-time Finish-your-profile hop is armed on the account's FIRST sign-in
 * only; later sign-ins get the banner.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';

type Row = { id: string; first_name: string | null; based_city_id: string | null; dance_role: string | null; meta_data: null };

const h = vi.hoisted(() => ({
  rows: {} as Record<string, unknown>,
  personaId: 'u1' as string | null,
  readIds: [] as string[],
}));
const getSession = vi.hoisted(() => vi.fn());
const saveMyDancerProfile = vi.hoisted(() => vi.fn());
const resolveCanonicalCity = vi.hoisted(() => vi.fn());
const rpcLoose = vi.hoisted(() => vi.fn());
const user = vi.hoisted(() => ({
  id: 'u1',
  user_metadata: {} as Record<string, unknown>,
  email_confirmed_at: null as string | null,
  last_sign_in_at: null as string | null,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: (_col: string, id: string) => ({
          maybeSingle: async () => {
            h.readIds.push(id);
            return { data: h.rows[id] ?? null, error: null };
          },
        }),
      }),
    }),
    auth: {
      getSession,
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}));
vi.mock('@/integrations/supabase/rpcLoose', () => ({ rpcLoose }));
vi.mock('@/lib/saveMyDancerProfile', () => ({ saveMyDancerProfile }));
vi.mock('@/lib/city-canonical', () => ({ resolveCanonicalCity }));
vi.mock('@/modules/organiser-self-serve/selfServeApi', () => ({ fetchOrganiserHome: vi.fn() }));
vi.mock('@/lib/featureFlags', () => ({ flags: { organiserSelfServe: true } }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));

import AuthCallback from '../AuthCallback';
import { POST_LOGIN_PROMPT_KEY } from '@/lib/auth-otp-routing';

const STUB: Row = { id: 'u1', first_name: null, based_city_id: null, dance_role: null, meta_data: null };
const FIRST = { email_confirmed_at: '2026-10-10T10:00:00Z', last_sign_in_at: '2026-10-10T10:00:02Z' };
const LATER = { email_confirmed_at: '2026-09-01T10:00:00Z', last_sign_in_at: '2026-10-10T10:00:00Z' };
const META = { first_name: 'Ana', city: 'London', dance_role: 'Follower' };

const mount = (mode = 'signup') =>
  render(
    <MemoryRouter initialEntries={[`/auth/callback?mode=${mode}`]}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="*" element={<p>landed</p>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  h.rows = { u1: STUB };
  h.personaId = 'u1';
  h.readIds = [];
  Object.assign(user, FIRST);
  rpcLoose.mockReset().mockImplementation(async (fn: string) =>
    fn === '_my_dancer_profile_id_v1' ? { data: h.personaId, error: null } : { data: null, error: { message: 'unexpected' } },
  );
  resolveCanonicalCity.mockReset().mockResolvedValue({ cityId: 'c1' });
  saveMyDancerProfile.mockReset().mockImplementation(async (p: Record<string, string>) => ({
    first_name: p.first_name ?? 'kept',
    based_city_id: p.based_city_id ?? 'kept',
  }));
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

// Metadata is always the full sign-up set (Ana / London / Follower); what is sent
// depends only on what the RESOLVED persona already holds.
describe.each([
  ['own row empty, resolver returns the same id: fills all three', 'u1', STUB, { first_name: 'Ana', based_city_id: 'c1', dance_role: 'Follower' }],
  [
    'resolver returns a linked admin profile with role, name and city set: sends nothing',
    'admin-p',
    { id: 'admin-p', first_name: 'Bea', based_city_id: 'c9', dance_role: 'Leader', meta_data: null },
    null,
  ],
  [
    'linked profile with name and role, no city: sends only the city',
    'admin-p',
    { id: 'admin-p', first_name: 'Bea', based_city_id: null, dance_role: 'Leader', meta_data: null },
    { based_city_id: 'c1' },
  ],
  [
    'partially filled: city set, name and role empty: sends only name and role',
    'u1',
    { ...STUB, based_city_id: 'c9' },
    { first_name: 'Ana', dance_role: 'Follower' },
  ],
  [
    'partially filled: role set, name and city empty: never sends the role',
    'u1',
    { ...STUB, dance_role: 'Leader' },
    { first_name: 'Ana', based_city_id: 'c1' },
  ],
  [
    'whitespace-only name counts as empty',
    'u1',
    { ...STUB, first_name: '   ', based_city_id: 'c9', dance_role: 'Leader' },
    { first_name: 'Ana' },
  ],
  [
    'returning sign-in on a second device (the first filled it): sends nothing',
    'u1',
    { ...STUB, first_name: 'Ana', based_city_id: 'c1', dance_role: 'Follower' },
    null,
  ],
] as [string, string, Row, Record<string, string> | null][])('%s', (_name, personaId, row, expected) => {
  it('reads the resolved persona and sends only its empty fields', async () => {
    user.user_metadata = { ...META };
    // The account's own stub stays empty in every case: it must not be what decides.
    h.rows = { u1: personaId === 'u1' ? row : STUB, [personaId]: row };
    h.personaId = personaId;
    mount();
    await screen.findByText('landed');
    expect(h.readIds).toEqual([personaId]);
    if (expected === null) {
      expect(saveMyDancerProfile).not.toHaveBeenCalled();
    } else {
      expect(saveMyDancerProfile).toHaveBeenCalledTimes(1);
      expect(saveMyDancerProfile.mock.calls[0][0]).toEqual(expected);
    }
  });
});

it('no profile row (the resolver finds none): nothing is sent, the sign-in still lands', async () => {
  user.user_metadata = { ...META };
  h.personaId = null;
  h.rows = {};
  mount();
  await screen.findByText('landed');
  expect(saveMyDancerProfile).not.toHaveBeenCalled();
});

describe.each([
  ['first sign-in after sign-up', FIRST, 'signup', STUB, true],
  ['first sign-in, even when the link says signin (typed code on another tab)', FIRST, 'signin', STUB, true],
  ['a later sign-in, profile still incomplete (banner only)', LATER, 'signin', STUB, false],
  ['a later sign-in through a sign-up link (existing account)', LATER, 'signup', STUB, false],
  ['a later sign-in, profile complete', LATER, 'signin', { ...STUB, first_name: 'Ana', based_city_id: 'c1', dance_role: 'Follower' }, false],
] as [string, typeof FIRST, string, Row, boolean][])('post-login prompt: %s', (_name, stamps, mode, row, armed) => {
  it(armed ? 'arms the one-time hop' : 'does not arm it', async () => {
    Object.assign(user, stamps);
    user.user_metadata = { ...META };
    h.rows = { u1: row };
    mount(mode);
    await screen.findByText('landed');
    expect(sessionStorage.getItem(POST_LOGIN_PROMPT_KEY)).toBe(armed ? '1' : null);
  });
});
