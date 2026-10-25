// @vitest-environment jsdom
/**
 * B-WEB4: the "What do you do?" roles chosen at sign-up, at /auth/callback.
 *
 * Table-driven: {roles chosen} x {organiser seat yes/no} x {dancer claim linked
 * yes/no} x {returnTo set/unset} x {carried by the e-mailed link's metadata /
 * by this browser's storage (typed code)} -> where the account lands, whether
 * the C13 "Already listed?" screen shows first, and that set_my_role_intent_v1
 * is called exactly once (zero for a sign-in).
 *
 * Landing (no honoured returnTo): an organiser seat keeps today's landing;
 * else Teacher -> /account/t; else DJ -> /account/dj; else today's landing
 * (/account/o for an Organiser sign-up, its create/ask-for-a-page path; else
 * /account/continue). A returnTo wins over all of these, except that an
 * Organiser sign-up drops a plain public-page returnTo (/event/e1 here; W2
 * walk fix 7) and lands by the rule above. Paths are literals here on purpose:
 * the test must not share the code's constants.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

const h = vi.hoisted(() => ({
  claimStatus: 'no_match' as string,
  claimed: [] as { organiserId: string; name: string }[],
  seat: { data: { organisers: [] as unknown[] }, error: null } as { data: unknown; error: unknown },
  intentAnswer: { data: { roles: [], declined: [], changed: true }, error: null } as { data: unknown; error: unknown },
}));
const maybeSingle = vi.hoisted(() => vi.fn());
const getSession = vi.hoisted(() => vi.fn());
const rpcLoose = vi.hoisted(() => vi.fn());
const rpc = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => vi.fn());
// A brand-new account by default: confirmed and signed in at the same moment (isFirstSignIn).
const NEW_ACCOUNT = { email_confirmed_at: '2026-10-21T09:00:00Z', last_sign_in_at: '2026-10-21T09:00:05Z' };
const user = vi.hoisted(() => ({ id: 'u1', user_metadata: {} as Record<string, unknown>, email_confirmed_at: '', last_sign_in_at: '' }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc,
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
    auth: { getSession, onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) },
  },
}));
vi.mock('@/integrations/supabase/rpcLoose', () => ({ rpcLoose }));
vi.mock('@/lib/claimMyDancerProfile', () => ({
  claimAtSignIn: async () => ({ status: h.claimStatus, profileId: h.claimStatus === 'linked' ? 'p1' : null }),
  shouldArmFinishHop: () => false,
}));
// The organiser claim at its own boundary (lib/claimMyOrganisers parses the contract; its tests cover that).
vi.mock('@/lib/claimMyOrganisers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/claimMyOrganisers')>()),
  claimMyOrganisers: async () => h.claimed,
  claimOrganisersAtSignIn: async () => h.claimed,
}));
vi.mock('@/lib/myPersona', () => ({ fetchMyPersonaId: async () => 'p1' }));
vi.mock('@/lib/accountDeletion', () => ({ signInDeletionTarget: async () => null }));
vi.mock('@/hooks/use-toast', () => ({ toast }));
vi.mock('@/lib/termsConsent', () => ({ acceptTerms: async () => true }));
vi.mock('@/lib/featureFlags', () => ({ flags: { organiserSelfServe: true } }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));

import AuthCallback from '../AuthCallback';

type Role = 'dancer' | 'organiser' | 'teacher' | 'dj';
const COMPLETE = { id: 'p1', first_name: 'Ana', based_city_id: 'c1', dance_role: 'Follower' };

function Landed() {
  const l = useLocation();
  return <div data-testid="landed">{l.pathname}</div>;
}

const mount = (entry: string) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="*" element={<Landed />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

const intentCalls = () => rpcLoose.mock.calls.filter(([fn]) => fn === 'set_my_role_intent_v1');
const seatReads = () => rpc.mock.calls.filter(([fn]) => fn === 'organiser_home_v1');

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  h.claimStatus = 'no_match';
  h.claimed = [];
  h.seat = { data: { organisers: [] }, error: null };
  h.intentAnswer = { data: { roles: [], declined: [], changed: true }, error: null };
  user.user_metadata = {};
  Object.assign(user, NEW_ACCOUNT);
  toast.mockReset();
  maybeSingle.mockReset().mockResolvedValue({ data: COMPLETE, error: null });
  getSession.mockResolvedValue({ data: { session: { user } } });
  rpcLoose.mockReset().mockImplementation(async (fn: string) => {
    if (fn === 'set_my_role_intent_v1') return h.intentAnswer;
    return { data: null, error: { message: `unexpected ${fn}` } };
  });
  rpc.mockReset().mockImplementation(async (fn: string) =>
    fn === 'organiser_home_v1' ? h.seat : { data: null, error: { message: `unexpected ${fn}` } },
  );
});
afterEach(cleanup);

/** What Auth.tsx stores for a sign-up: the roles, plus the older single user_type. */
const carry = (roles: Role[], carrier: 'link' | 'code') => {
  const userType = roles.includes('organiser') ? 'organiser' : 'dancer';
  if (carrier === 'link') user.user_metadata = { user_type: userType, role_intent: roles };
  else {
    localStorage.setItem('pending_role_intent', JSON.stringify(roles));
    localStorage.setItem('pending_profile_role', userType);
  }
};

/** The rule, written out independently of the code. */
const expectedLanding = (roles: Role[], seat: boolean, returnTo: boolean): string => {
  if (returnTo && !roles.includes('organiser')) return '/event/e1';
  const todays = roles.includes('organiser') ? '/account/o' : '/account/continue';
  if (seat) return todays;
  if (roles.includes('teacher')) return '/account/t';
  if (roles.includes('dj')) return '/account/dj';
  return todays;
};

const ROLE_SETS: Role[][] = [
  ['dancer'],
  ['dancer', 'organiser'],
  ['dancer', 'teacher'],
  ['dancer', 'dj'],
  ['dancer', 'teacher', 'dj'],
  ['organiser', 'teacher'],
  ['dj'],
];

const signupEntry = (returnTo: boolean) =>
  `/auth/callback?mode=signup${returnTo ? `&returnTo=${encodeURIComponent('/event/e1')}` : ''}`;

/** Follows the C13 screen when it shows; returns where the account landed. */
const finish = async (expectC13: boolean): Promise<string> => {
  if (expectC13) {
    expect(await screen.findByText('Already listed on Bachata Calendar?')).toBeTruthy();
    expect(screen.queryByTestId('landed')).toBeNull();
    const ask = screen.getByRole('link', { name: 'Ask us to link your profile' });
    expect(ask.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
    expect(ask.className).toMatch(/(^|\s)min-h-\[44px\](\s|$)/);
    const cont = screen.getByRole('button', { name: 'Continue' });
    expect(cont.className).toMatch(/(^|\s)min-h-\[44px\](\s|$)/);
    fireEvent.click(cont);
  }
  const landed = await screen.findByTestId('landed');
  expect(screen.queryByText('Already listed on Bachata Calendar?')).toBeNull();
  return landed.textContent as string;
};

describe('sign-up roles: landing x C13 x one intent call', () => {
  for (const roles of ROLE_SETS) {
    for (const seat of [true, false]) {
      for (const linked of [true, false]) {
        for (const returnTo of [true, false]) {
          for (const carrier of ['link', 'code'] as const) {
            const label = `[${roles.join(',')}] seat=${seat ? 'yes' : 'no'} claim=${linked ? 'linked' : 'no_match'} returnTo=${returnTo ? 'set' : 'unset'} via ${carrier}`;
            it(label, async () => {
              carry(roles, carrier);
              h.claimStatus = linked ? 'linked' : 'no_match';
              h.seat = { data: { organisers: seat ? [{ id: 'o1', name: 'Ritmo' }] : [] }, error: null };
              mount(signupEntry(returnTo));
              const teacherOrDj = roles.includes('teacher') || roles.includes('dj');
              const landed = await finish(teacherOrDj && !linked);
              await waitFor(() => expect(landed).toBe(expectedLanding(roles, seat, returnTo)));
              expect(intentCalls()).toEqual([['set_my_role_intent_v1', { p_roles: roles }]]);
              expect(localStorage.getItem('pending_role_intent')).toBeNull();
            });
          }
        }
      }
    }
  }
});

describe('sign-in never records or moves', () => {
  for (const roles of ROLE_SETS) {
    it(`sign-in of an account created with [${roles.join(',')}]: no intent call, no C13, today's landing`, async () => {
      user.user_metadata = { user_type: 'dancer', role_intent: roles };
      h.claimStatus = 'no_match';
      mount('/auth/callback?mode=signin');
      expect(await screen.findByTestId('landed')).toBeTruthy();
      expect(screen.getByTestId('landed').textContent).toBe('/account/continue');
      expect(screen.queryByText('Already listed on Bachata Calendar?')).toBeNull();
      expect(intentCalls()).toHaveLength(0);
      expect(seatReads()).toHaveLength(0);
    });
  }
});

// S2 (review of Release B): set_my_role_intent_v1 REPLACES the stored roles, so the sign-up form used again on an
// account that already exists must not overwrite what that account chose at its real sign-up.
describe('sign-up mode, existing account -> zero intent calls', () => {
  for (const carrier of ['link', 'code'] as const) {
    it(`an account that signed in before taps Create account again (default [dancer], via ${carrier}): no intent call`, async () => {
      carry(['dancer'], carrier);
      Object.assign(user, { email_confirmed_at: '2026-10-01T09:00:00Z', last_sign_in_at: '2026-10-21T09:00:00Z' });
      h.claimStatus = 'linked';
      mount(signupEntry(false));
      expect(await screen.findByTestId('landed')).toBeTruthy();
      expect(intentCalls()).toHaveLength(0);
      expect(localStorage.getItem('pending_role_intent')).toBeNull();
    });
  }
});

describe('failures never hold or strand the sign-up', () => {
  it('set_my_role_intent_v1 missing on the database: still lands by the roles', async () => {
    carry(['dancer', 'teacher'], 'link');
    h.claimStatus = 'linked';
    h.intentAnswer = { data: null, error: { message: 'Could not find the function public.set_my_role_intent_v1' } };
    mount(signupEntry(false));
    expect((await screen.findByTestId('landed')).textContent).toBe('/account/t');
    expect(intentCalls()).toHaveLength(1);
  });

  it('set_my_role_intent_v1 throws: still lands', async () => {
    carry(['dancer', 'dj'], 'code');
    h.claimStatus = 'linked';
    rpcLoose.mockImplementation(async (fn: string) => {
      if (fn === 'set_my_role_intent_v1') throw new Error('network');
      return { data: null, error: { message: `unexpected ${fn}` } };
    });
    mount(signupEntry(false));
    expect((await screen.findByTestId('landed')).textContent).toBe('/account/dj');
  });

  it('the seat read fails: today\'s landing, never a guess', async () => {
    carry(['dancer', 'teacher'], 'link');
    h.claimStatus = 'linked';
    h.seat = { data: null, error: { message: 'boom' } };
    mount(signupEntry(false));
    expect((await screen.findByTestId('landed')).textContent).toBe('/account/continue');
  });

  it('pages claimed at this sign-up are a seat: /account/o, and the seat is not read again', async () => {
    carry(['dancer', 'teacher'], 'link');
    h.claimStatus = 'linked';
    h.claimed = [{ organiserId: 'o1', name: 'Ritmo' }];
    mount(signupEntry(false));
    expect((await screen.findByTestId('landed')).textContent).toBe('/account/o');
    expect(seatReads()).toHaveLength(0);
    expect(intentCalls()).toHaveLength(1);
  });

  it('no roles carried (an older sign-up link): no intent call, no seat read, today\'s landing', async () => {
    user.user_metadata = { user_type: 'dancer' };
    mount(signupEntry(false));
    expect((await screen.findByTestId('landed')).textContent).toBe('/account/continue');
    expect(intentCalls()).toHaveLength(0);
    expect(seatReads()).toHaveLength(0);
  });

  it('attacker-shaped roles: unknown values are dropped before the call', async () => {
    user.user_metadata = { user_type: 'dancer', role_intent: ['admin', 'teacher', 'teacher', 42] };
    h.claimStatus = 'linked';
    mount(signupEntry(false));
    expect((await screen.findByTestId('landed')).textContent).toBe('/account/t');
    expect(intentCalls()).toEqual([['set_my_role_intent_v1', { p_roles: ['teacher'] }]]);
  });

  it.each(['ambiguous', 'unavailable', 'already_linked', 'email_unproven'])(
    'claim %s: no C13 (only "found no person" shows it)',
    async (status) => {
      carry(['dancer', 'teacher'], 'link');
      h.claimStatus = status;
      mount(signupEntry(false));
      expect((await screen.findByTestId('landed')).textContent).toBe('/account/t');
    },
  );
});
