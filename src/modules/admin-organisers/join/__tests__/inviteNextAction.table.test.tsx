// @vitest-environment jsdom
/**
 * Invite landing /invite/:token, the "what can I do next" table: every link state x who is looking, and
 * every email-entry outcome (bind_organiser_invite_email_v1: bad email, rate limited, bound). The step
 * machine itself is joinMachine.table; this pins that no state is a dead end: each shows a named control
 * the person can use (send a code, finish About you, Join, or the home link), never words alone.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ProfileCompletion } from '@/lib/profileCompletion';

const TOKEN = 'ab'.repeat(32);
const ORG = 'Sensual Vibes';
const h = vi.hoisted(() => ({
  auth: { user: null as null | { id: string; email: string }, authStatus: 'ready' as 'ready' | 'resolving', signOut: async () => 'signed-out' },
  completion: { status: 'signed_out', missing: [], profileId: null } as ProfileCompletion,
  rpc: vi.fn(),
  otp: vi.fn(async () => ({ data: {}, error: null })),
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
    auth: { signInWithOtp: (...a: unknown[]) => h.otp(...a), verifyOtp: vi.fn(), getSession: async () => ({ data: { session: null } }) },
  },
}));

import InviteRedeemPage from '../../InviteRedeemPage';


const ME = { id: 'u1', email: 'ana@example.com' };
const ok = (data: unknown) => Promise.resolve({ data, error: null });
const open = (extra: Record<string, unknown> = {}) => ({ status: 'open', organiser_name: ORG, inviter_first_name: 'Ricky', email_hint: null, ...extra });
let bind: unknown = { status: 'bound' };

function mount(url = `/invite/${TOKEN}`) {
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
const stepIs = (s: string) => waitFor(() => expect(screen.getByTestId('join-step').getAttribute('data-step')).toBe(s), { timeout: 4000 });
const signedOut = () => { h.auth = { ...h.auth, user: null }; h.completion = { status: 'signed_out', missing: [], profileId: null }; };
const signedIn = (status: 'complete' | 'incomplete') => {
  h.auth = { ...h.auth, user: ME };
  h.completion = status === 'complete' ? { status, missing: [], profileId: 'p1' } : { status, missing: ['avatar_url'], profileId: 'p1' };
};

beforeEach(() => {
  h.rpc.mockReset();
  h.organisers = [];
  bind = { status: 'bound' };
  signedOut();
  h.rpc.mockImplementation((fn: string) => {
    if (fn === 'organiser_invite_preview_v1') return ok(open());
    if (fn === 'bind_organiser_invite_email_v1') return ok(bind);
    if (fn === 'redeem_organiser_invite_v1') return ok({ ok: false, reason: 'invalid' });
    return ok({});
  });
  window.history.replaceState(null, '', `/invite/${TOKEN}`);
});
afterEach(cleanup);

const DEAD: [string, unknown][] = [
  ['used', { ...open(), status: 'used' }],
  ['revoked', { ...open(), status: 'revoked' }],
  ['expired', { ...open(), status: 'expired' }],
  ['unknown token', {}],
];

describe('dead links: words plus a way on', () => {
  it.each(DEAD)('%s: says why, and the home link is on screen', async (_n, preview) => {
    h.rpc.mockImplementation((fn: string) => (fn === 'organiser_invite_preview_v1' ? ok(preview) : ok({ ok: false, reason: 'invalid' })));
    mount();
    await stepIs('dead');
    expect(screen.getByTestId('invite-card').textContent?.trim().length).toBeGreaterThan(20);
    expect(screen.getByTestId('invite-home').getAttribute('href')).toBe('/');
  });

  it('a malformed token never asks the server, and still offers the home link', async () => {
    mount('/invite/not-a-token');
    await stepIs('dead');
    expect(h.rpc).not.toHaveBeenCalledWith('organiser_invite_preview_v1', expect.anything());
    expect(screen.getByTestId('invite-home')).toBeTruthy();
  });
});

describe('open link: the next action is on screen for each person', () => {
  it('signed out: an email box and an enabled-by-typing Send my code', async () => {
    mount();
    await stepIs('email');
    expect(screen.getByTestId('join-email-input')).toBeTruthy();
    expect(screen.getByTestId('join-send').textContent).toBe('Send my code');
  });
  it('signed in without a complete dancer profile: About you, inline, with its save button', async () => {
    signedIn('incomplete');
    mount();
    await stepIs('about');
    expect(screen.getByTestId('join-about-form')).toBeTruthy();
    expect(screen.getByTestId('join-about-save')).toBeTruthy();
    expect(screen.queryByTestId('elsewhere')).toBeNull();
  });
  it('signed in with a complete profile: a Join button naming the page', async () => {
    signedIn('complete');
    mount();
    await stepIs('join');
    expect(screen.getByTestId('invite-join').textContent).toContain(ORG);
  });
});

describe('email entry: bind_organiser_invite_email_v1 outcomes', () => {
  const send = async (email: string) => {
    mount();
    await stepIs('email');
    fireEvent.change(screen.getByTestId('join-email-input'), { target: { value: email } });
    fireEvent.click(screen.getByTestId('join-send'));
  };
  it('a typo shape is stopped before the server, with words and the box still there', async () => {
    await send('ana@');
    await waitFor(() => expect(screen.getByText('Use an email like name@example.com.')).toBeTruthy());
    expect(h.rpc).not.toHaveBeenCalledWith('bind_organiser_invite_email_v1', expect.anything());
    expect(screen.getByTestId('join-email-input')).toBeTruthy();
  });
  it('server says bad_email: the same words, the box stays, no code sent', async () => {
    bind = { status: 'bad_email' };
    await send(ME.email);
    await waitFor(() => expect(screen.getByText('Use an email like name@example.com.')).toBeTruthy());
    expect(screen.getByTestId('join-step').getAttribute('data-step')).toBe('email');
    expect(h.otp).not.toHaveBeenCalled();
  });
  it('server says rate_limited: a stop screen with Try again', async () => {
    bind = { status: 'rate_limited' };
    await send(ME.email);
    await waitFor(() => expect(screen.getByTestId('join-step').getAttribute('data-stop')).toBe('rate_limited'));
    expect(screen.getByTestId('join-retry')).toBeTruthy();
    expect(h.otp).not.toHaveBeenCalled();
  });
  it('server says bound: the code box', async () => {
    await send(ME.email);
    await stepIs('code');
    expect(screen.getByTestId('join-code')).toBeTruthy();
    expect(h.rpc).toHaveBeenCalledWith('bind_organiser_invite_email_v1', { p_token: TOKEN, p_email: ME.email });
  });
});
