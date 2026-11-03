// @vitest-environment jsdom
/**
 * W1 state-machine table (PLAN.md section 4): every row of the /invite step table x {new, returning
 * incomplete, returning complete, already member}. The step is derived from SERVER truth (preview,
 * session, profile completeness, membership), never from local state. Red on main's journey first.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ProfileCompletion } from '@/lib/profileCompletion';

const TOKEN = 'ab'.repeat(32);
const ORG = 'Sensual Vibes';
const h = vi.hoisted(() => ({
  auth: { user: null as null | { id: string; email: string }, authStatus: 'ready' as 'ready' | 'resolving', signOut: async () => 'signed-out' },
  completion: { status: 'signed_out', missing: [], profileId: null } as ProfileCompletion,
  rpc: vi.fn(),
  organisers: [] as { id: string; name: string }[],
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => h.auth }));
vi.mock('@/hooks/useProfileCompletion', () => ({
  useProfileCompletion: () => ({ ...h.completion, refetch: async () => h.completion }),
  profileCompletionQueryKey: (id: string | null) => ['profile-completion', id],
}));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/lib/claimMyDancerProfile', () => ({ claimAtSignIn: async () => ({ status: 'not_applicable', profileId: null }) }));
vi.mock('@/modules/organiser/shared/selfServeApi', () => ({
  ORGANISER_HOME_KEY: ['organiser-home'],
  organiserHomeQueryKey: (id: string | undefined) => ['organiser-home', id ?? null],
  fetchOrganiserHome: async () => ({ organisers: h.organisers }),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...a: unknown[]) => h.rpc(...a),
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
    auth: { signInWithOtp: vi.fn(), verifyOtp: vi.fn(), getSession: async () => ({ data: { session: null } }) },
  },
}));

import InviteRedeemPage from '../../InviteRedeemPage';

type Person = 'new' | 'returning_incomplete' | 'returning_complete' | 'already_member';
const PERSONS: Person[] = ['new', 'returning_incomplete', 'returning_complete', 'already_member'];
const ME = { id: 'u1', email: 'ana@example.com' };

function becomePerson(p: Person) {
  h.organisers = [];
  if (p === 'new') {
    h.auth = { ...h.auth, user: null };
    h.completion = { status: 'signed_out', missing: [], profileId: null };
    return;
  }
  h.auth = { ...h.auth, user: ME };
  if (p === 'returning_incomplete') h.completion = { status: 'incomplete', missing: ['avatar_url'], profileId: 'p1' };
  else h.completion = { status: 'complete', missing: [], profileId: 'p1' };
  if (p === 'already_member') h.organisers = [{ id: 'o1', name: ORG }];
}

const ok = (data: unknown) => Promise.resolve({ data, error: null });
const open = (extra: Record<string, unknown> = {}) => ({ status: 'open', organiser_name: ORG, inviter_first_name: 'Ricky', email_hint: null, ...extra });

/** preview answer, redeem answer (for the used-link membership check), url, and the expected step per person. */
interface Row { name: string; preview: unknown | 'pending'; url?: string; redeem?: (p: Person) => unknown; expect: Record<Person, string> }
const ROWS: Row[] = [
  { name: 'checking', preview: 'pending', expect: { new: 'checking', returning_incomplete: 'checking', returning_complete: 'checking', already_member: 'checking' } },
  { name: 'dead (expired)', preview: { ...open(), status: 'expired' }, expect: { new: 'dead', returning_incomplete: 'dead', returning_complete: 'dead', already_member: 'dead' } },
  { name: 'dead (revoked)', preview: { ...open(), status: 'revoked' }, expect: { new: 'dead', returning_incomplete: 'dead', returning_complete: 'dead', already_member: 'dead' } },
  { name: 'dead (invalid: unknown link)', preview: {}, expect: { new: 'dead', returning_incomplete: 'dead', returning_complete: 'dead', already_member: 'dead' } },
  // A used link opened by the person who used it is not an error: redeem answers already_member and the page says so.
  { name: 'dead (used) / done for the member', preview: { ...open(), status: 'used' }, redeem: (p) => (p === 'already_member' ? { ok: true, status: 'already_member', organiser_id: 'o1' } : { ok: false, reason: 'used' }), expect: { new: 'dead', returning_incomplete: 'dead', returning_complete: 'dead', already_member: 'done' } },
  { name: 'email', preview: open(), expect: { new: 'email', returning_incomplete: 'about', returning_complete: 'join', already_member: 'done' } },
  { name: 'code (?step=code&email=)', preview: open(), url: `/invite/${TOKEN}?step=code&email=${encodeURIComponent(ME.email)}`, expect: { new: 'code', returning_incomplete: 'about', returning_complete: 'join', already_member: 'done' } },
  { name: 'about / join / done (open link, session decides)', preview: open({ email_hint: 'a***@example.com' }), expect: { new: 'email', returning_incomplete: 'about', returning_complete: 'join', already_member: 'done' } },
  { name: 'wrong_account (bound to another email)', preview: open({ email_hint: 'z***@other.com' }), expect: { new: 'email', returning_incomplete: 'wrong_account', returning_complete: 'wrong_account', already_member: 'wrong_account' } },
];

function mount(url: string) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/invite/:token" element={<InviteRedeemPage />} />
          <Route path="*" element={<p data-testid="elsewhere">elsewhere</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  h.rpc.mockReset();
  window.history.replaceState(null, '', `/invite/${TOKEN}`);
});
afterEach(cleanup);

describe.each(ROWS)('row: $name', (row) => {
  it.each(PERSONS)('%s', async (person) => {
    becomePerson(person);
    h.rpc.mockImplementation((fn: string) => {
      if (fn === 'organiser_invite_preview_v1') return row.preview === 'pending' ? new Promise(() => undefined) : ok(row.preview);
      if (fn === 'redeem_organiser_invite_v1') return ok(row.redeem ? row.redeem(person) : { ok: false, reason: 'invalid' });
      return ok({});
    });
    mount(row.url ?? `/invite/${TOKEN}`);
    const step = await screen.findByTestId('join-step');
    // The skeleton renders first; the row's step is what the page settles on once the server has answered.
    if (row.expect[person] !== 'checking') await waitFor(() => expect(step.getAttribute('data-step')).not.toBe('checking'), { timeout: 4000 });
    else await new Promise((r) => setTimeout(r, 50));
    expect(step.getAttribute('data-step')).toBe(row.expect[person]);
    // Server truth only: nothing is redeemed without a Join tap (the used-link membership check aside).
    if (row.name !== 'dead (used) / done for the member') expect(h.rpc).not.toHaveBeenCalledWith('redeem_organiser_invite_v1', expect.anything());
    // Never away from the invite page.
    expect(screen.queryByTestId('elsewhere')).toBeNull();
  });
});
