// @vitest-environment jsdom
/**
 * Folded from PR #959's inviteSelfBoundGate.test.tsx (superseded by W1): the dancer-profile gate NEVER
 * redirects /invite. Whatever the link (unbound, admin-bound, self-bound, person-bound) and however
 * unfinished the profile, the page stays on /invite and asks About you inline; /finish-profile is
 * never visited and nothing is redeemed without the Join tap. Both layers are checked: the path
 * list (isDancerGatedPath) and the gate component itself.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ProfileCompletion } from '@/lib/profileCompletion';

const TOKEN = 'cd'.repeat(32);
const h = vi.hoisted(() => ({
  completion: { status: 'complete', missing: [], profileId: 'p1' } as ProfileCompletion,
  rpc: vi.fn(),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'ana@example.com' }, authStatus: 'ready', signOut: async () => 'signed-out' }) }));
vi.mock('@/hooks/useProfileCompletion', () => ({
  useProfileCompletion: () => ({ ...h.completion, refetch: async () => h.completion }),
  profileCompletionQueryKey: (id: string) => ['profile-completion', id],
}));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/lib/claimMyDancerProfile', () => ({ claimAtSignIn: async () => ({ status: 'not_applicable', profileId: null }) }));
vi.mock('@/components/ui/city-picker', () => ({ CityPicker: () => <input data-testid="city" /> }));
vi.mock('@/components/profile/DanceRolePicker', () => ({ DanceRolePicker: () => <input data-testid="role" /> }));
vi.mock('@/components/profile/AvatarUpload', () => ({ AvatarUpload: () => <input data-testid="avatar" /> }));
vi.mock('@/modules/organiser/shared/selfServeApi', () => ({
  ORGANISER_HOME_KEY: ['organiser-home'],
  organiserHomeQueryKey: (id: string | undefined) => ['organiser-home', id ?? null],
  fetchOrganiserHome: async () => ({ organisers: [] }),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...a: unknown[]) => h.rpc(...a),
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
    auth: { signInWithOtp: vi.fn(), verifyOtp: vi.fn(), getSession: async () => ({ data: { session: null } }) },
  },
}));

import InviteRedeemPage from '../../InviteRedeemPage';
import { DancerProfileGate } from '@/components/account/DancerProfileGate';
import { isDancerGatedPath } from '@/lib/accountRouting';

const ok = (data: unknown) => Promise.resolve({ data, error: null });
const HINT = 'a***@example.com';
const LINKS: Array<[string, Record<string, unknown>]> = [
  ['unbound', {}],
  ['admin-bound', { email_hint: HINT, self_bound: false }],
  ['self-bound', { email_hint: HINT, self_bound: true }],
  ['bound, key absent (pre-#956)', { email_hint: HINT }],
  ['person-bound (A2)', { email_hint: HINT, person: { first_name: 'Papacito', avatar_url: null, city: 'London' } }],
];

function mount(link: Record<string, unknown>, element: ReactNode = <InviteRedeemPage />) {
  h.rpc.mockImplementation((fn: string) => (fn === 'organiser_invite_preview_v1' ? ok({ status: 'open', organiser_name: 'Ritmo', inviter_first_name: 'Diego', ...link }) : ok({})));
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[`/invite/${TOKEN}`]}>
        <Routes>
          <Route path="/invite/:token" element={element} />
          <Route path="/finish-profile" element={<p data-testid="finish">finish</p>} />
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

describe('the path list: /invite is not a dancer-gated path', () => {
  it.each(['/invite', `/invite/${TOKEN}`, '/INVITE/x', '/invite/'])('%s', (path) => expect(isDancerGatedPath(path)).toBe(false));
  it.each(['/account', '/account/o', '/account/o/welcome', '/account/dancer'])('%s stays gated', (path) => expect(isDancerGatedPath(path)).toBe(true));
});

describe('the gate component, mounted on /invite by mistake, passes the page through', () => {
  it.each(['incomplete', 'no_profile', 'loading'] as const)('profile %s: no redirect, no wait screen', async (status) => {
    h.completion = { status, missing: status === 'incomplete' ? ['first_name'] : [], profileId: status === 'no_profile' ? null : 'p1' };
    mount({}, <DancerProfileGate><p data-testid="through">through</p></DancerProfileGate>);
    expect(await screen.findByTestId('through')).toBeTruthy();
    expect(screen.queryByTestId('finish')).toBeNull();
  });
});

describe.each(LINKS)('%s link', (_name, extra) => {
  it('profile complete: the Join card, no redeem without a tap', async () => {
    h.completion = { status: 'complete', missing: [], profileId: 'p1' };
    mount(extra);
    expect(await screen.findByTestId('invite-join')).toBeTruthy();
    expect(h.rpc).not.toHaveBeenCalledWith('redeem_organiser_invite_v1', expect.anything());
  });

  it('profile incomplete: About you inline on /invite, never /finish-profile, nothing redeemed', async () => {
    h.completion = { status: 'incomplete', missing: ['first_name'], profileId: 'p1' };
    mount(extra);
    expect(await screen.findByTestId('join-about-form')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('join-step').getAttribute('data-step')).toBe('about'));
    expect(screen.queryByTestId('finish')).toBeNull();
    expect(screen.queryByTestId('elsewhere')).toBeNull();
    expect(screen.queryByTestId('invite-join')).toBeNull();
    expect(h.rpc).not.toHaveBeenCalledWith('redeem_organiser_invite_v1', expect.anything());
  });
});
