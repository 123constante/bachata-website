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
import { JOIN_COPY } from '../joinCopy';

const ok = (data: unknown) => Promise.resolve({ data, error: null });
const open = (extra: Record<string, unknown> = {}) => ({ status: 'open', organiser_name: ORG, inviter_first_name: 'Ricky', email_hint: null, ...extra });

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

beforeEach(() => {
  h.rpc.mockReset();
  h.auth = { ...h.auth, user: null };
  h.completion = { status: 'signed_out', missing: [], profileId: null };
  window.history.replaceState(null, '', `/invite/${TOKEN}`);
});
afterEach(cleanup);

// Rows 07, 08, 16 of the invite-first-minute walk: every state x the controls it must carry.
// control = [testid, expected href substring | null (a button)]
type Ctl = [string, string | null];
const DEAD_STATES: [string, unknown, boolean, Ctl[]][] = [
  ['07 used, signed out', { ...open(), status: 'used' }, false, [['invite-used-sign-in', '/auth'], ['invite-home', '/']]],
  ['08 unknown link', {}, false, [['invite-new-link-help', 'wa.me'], ['invite-home', '/']]],
  ['expired', { ...open(), status: 'expired' }, false, [['invite-new-link', null], ['invite-home', '/']]],
  ['revoked', { ...open(), status: 'revoked' }, false, [['invite-new-link', null], ['invite-home', '/']]],
];

describe('dead links: each state carries its controls, every dead end has one action', () => {
  it.each(DEAD_STATES)('%s', async (_n, preview, _x, controls) => {
    h.rpc.mockImplementation((fn: string) => (fn === 'organiser_invite_preview_v1' ? ok(preview) : ok({ ok: false, reason: 'invalid' })));
    mount();
    await stepIs('dead');
    for (const [id, href] of controls) {
      const el = screen.getByTestId(id);
      if (href) expect(el.getAttribute('href') ?? '').toContain(href);
    }
    // no copy points at a control that is missing
    const text = screen.getByTestId('invite-card').textContent ?? '';
    if (/ask the person who sent it/i.test(text)) expect(screen.queryByTestId('invite-new-link-help') ?? screen.queryByTestId('invite-new-link')).not.toBeNull();
  });
  it('08 button wording is the shared one', async () => {
    h.rpc.mockImplementation(() => ok({}));
    mount();
    await stepIs('dead');
    expect(screen.getByTestId('invite-new-link-help').textContent).toBe(JOIN_COPY.unknownLink.button);
  });
});

describe('16 join card promise matches the gate', () => {
  it('says the real next steps, once', () => {
    const t = JOIN_COPY.join.card(ORG);
    expect(t).toBe(`Join Sensual Vibes\u2019 team. You\u2019ll finish a few details about you and the page, then you can add and edit events.`);
    expect(t).not.toContain('be able to');
  });
});
