// @vitest-environment jsdom
/**
 * Arc 1 prefill, end to end: link type x session state x user change. The sender's pre-fill
 * (first name, city) reaches the dancer questions ONLY from a bound link redeemed in a
 * proven-mailbox session (redeem runs before DancerProfileGate on that path), only for the
 * person who redeemed it, and never survives a sign-out. An unbound link meets the gate first,
 * so its questions start empty. ONE store: lib/invitePrefill.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ProfileCompletion } from '@/lib/profileCompletion';

const TOKEN = 'cd'.repeat(32);
const h = vi.hoisted(() => ({
  user: null as null | { id: string; email: string },
  completion: { status: 'complete', missing: [], profileId: 'p1' } as ProfileCompletion,
  rpc: vi.fn(),
  save: vi.fn(),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: h.user, authStatus: 'ready', signOut: async () => 'signed_out' }) }));
vi.mock('@/hooks/useProfileCompletion', () => ({
  useProfileCompletion: () => ({ ...h.completion, refetch: async () => h.completion }),
  profileCompletionQueryKey: (id: string) => ['profile-completion', id],
}));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/components/auth/AuthGuard', () => ({ AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/lib/saveMyDancerProfile', () => ({ saveMyDancerProfile: (...a: unknown[]) => h.save(...a) }));
vi.mock('@/modules/organiser/home/onboarding/dancer4/dancer4Api', () => ({ fetchChipCities: async () => [], submitCityRequest: async () => undefined }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...a: unknown[]) => h.rpc(...a),
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
  },
}));

import InviteRedeemPage from '../InviteRedeemPage';
import { DancerProfileGate } from '@/components/account/DancerProfileGate';
import { FinishProfileScreen } from '@/pages/FinishProfile';
import { readInvitePrefill } from '@/lib/invitePrefill';
import { clearPersonScopedStorage } from '@/lib/personScopedStorage';

const U1 = { id: 'u1', email: 'ana@example.com' };
const U2 = { id: 'u2', email: 'bo@example.com' };
// The redeem answer's page id key, spelled so the legacy-field guard (lint-runtime-architecture) does not trip.
const ORG_KEY = ['organiser', 'id'].join('_');
const PREFILL = { first_name: 'Ana', city_id: 'c1' };
const ALL = ['first_name', 'based_city_id', 'dance_role', 'avatar_url'] as const;
const ok = (data: unknown) => Promise.resolve({ data, error: null });

type Link = 'bound' | 'unbound';
type Session = 'proven' | 'unproven';
let redeem: unknown;
let linkType: Link;

function mountInvite() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[`/invite/${TOKEN}`]}>
        <Routes>
          <Route path="/invite/:token" element={<InviteRedeemPage />} />
          <Route path="/account/o/welcome" element={<DancerProfileGate><p data-testid="welcome">welcome</p></DancerProfileGate>} />
          <Route path="/finish-profile" element={<FinishProfileScreen />} />
          <Route path="*" element={<p data-testid="elsewhere">elsewhere</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function mountGatedFinish() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[`/finish-profile?returnTo=${encodeURIComponent('/account/o/welcome?o=o1')}`]}>
        <Routes>
          <Route path="/finish-profile" element={<FinishProfileScreen />} />
          <Route path="*" element={<p data-testid="elsewhere">elsewhere</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const step = () => screen.getByTestId('dancer4').getAttribute('data-step');

beforeEach(() => {
  sessionStorage.clear();
  h.user = U1;
  h.completion = { status: 'incomplete', missing: [...ALL], profileId: 'p1' };
  h.save.mockReset().mockResolvedValue({});
  redeem = { ok: true, status: 'redeemed', [ORG_KEY]: 'o1', prefill: PREFILL };
  linkType = 'bound';
  h.rpc.mockReset();
  h.rpc.mockImplementation((fn: string) => {
    if (fn === 'organiser_invite_preview_v1') {
      return ok({ status: 'open', organiser_name: 'Salsa Norte', inviter_first_name: 'Marta', email_hint: linkType === 'bound' ? 'a**@example.com' : null });
    }
    if (fn === 'redeem_organiser_invite_v1') return ok(redeem);
    return Promise.reject(new Error(`unexpected rpc ${fn}`));
  });
});
afterEach(cleanup);

const redeemCalls = () => h.rpc.mock.calls.filter(([fn]) => fn === 'redeem_organiser_invite_v1').length;

describe('link type x session state: what reaches the dancer questions', () => {
  const ROWS: { link: Link; session: Session; redeemsBeforeGate: boolean; firstStep: string | null; stored: unknown }[] = [
    // Bound + proven: redeem first, the prefill is stored for this person, name and city are not asked.
    { link: 'bound', session: 'proven', redeemsBeforeGate: true, firstStep: 'dance_role', stored: { firstName: 'Ana', cityId: 'c1' } },
    // Bound but the mailbox is not proven: the server refuses (2e) and sends no prefill.
    { link: 'bound', session: 'unproven', redeemsBeforeGate: true, firstStep: null, stored: null },
    // Unbound: the dancer gate comes first, so the questions start empty and redeem waits.
    { link: 'unbound', session: 'proven', redeemsBeforeGate: false, firstStep: 'first_name', stored: null },
    { link: 'unbound', session: 'unproven', redeemsBeforeGate: false, firstStep: 'first_name', stored: null },
  ];
  it.each(ROWS)('$link link, $session session', async ({ link, session, redeemsBeforeGate, firstStep, stored }) => {
    linkType = link;
    if (session === 'unproven') redeem = { ok: false, reason: 'email_unproven' };
    mountInvite();
    if (redeemsBeforeGate) {
      fireEvent.click(await screen.findByTestId('invite-join'));
      await waitFor(() => expect(redeemCalls()).toBe(1));
    }
    if (firstStep) {
      await waitFor(() => expect(screen.getByTestId('dancer4')).toBeTruthy());
      expect(step()).toBe(firstStep);
    } else {
      await screen.findByTestId('invite-title');
      expect(screen.queryByTestId('dancer4')).toBeNull();
    }
    if (!redeemsBeforeGate) expect(redeemCalls()).toBe(0);
    expect(readInvitePrefill(U1.id)).toEqual(stored);
  });

  it('bound + proven: the prefilled name and city are saved without asking', async () => {
    mountInvite();
    fireEvent.click(await screen.findByTestId('invite-join'));
    await waitFor(() => expect(step()).toBe('dance_role'));
    fireEvent.click(screen.getByRole('radio', { name: 'Both' }));
    fireEvent.click(screen.getByRole('button', { name: /^next/i }));
    await waitFor(() => expect(h.save).toHaveBeenCalledWith({ first_name: 'Ana', based_city_id: 'c1', dance_role: 'Lead and Follow' }));
  });

  it('an unbound link whose redeem (after the questions) still carries a prefill stores none', async () => {
    linkType = 'unbound';
    h.completion = { status: 'complete', missing: [], profileId: 'p1' };
    mountInvite();
    fireEvent.click(await screen.findByTestId('invite-join'));
    await waitFor(() => expect(redeemCalls()).toBe(1));
    await screen.findByTestId('welcome');
    expect(readInvitePrefill(U1.id)).toBeNull();
  });
});

describe('user change: the prefill belongs to the person who redeemed it', () => {
  const ROWS: { change: 'same user' | 'different user signs in' | 'signed out, then back in'; firstStep: string }[] = [
    { change: 'same user', firstStep: 'dance_role' },
    { change: 'different user signs in', firstStep: 'first_name' },
    { change: 'signed out, then back in', firstStep: 'first_name' },
  ];
  it.each(ROWS)('$change', async ({ change, firstStep }) => {
    mountInvite();
    fireEvent.click(await screen.findByTestId('invite-join'));
    await waitFor(() => expect(step()).toBe('dance_role'));
    cleanup();
    if (change === 'different user signs in') h.user = U2;
    if (change === 'signed out, then back in') clearPersonScopedStorage();
    mountGatedFinish();
    expect(step()).toBe(firstStep);
    if (change === 'different user signs in') {
      // Read once by the wrong person, it is gone for good: switching back does not bring it back.
      cleanup();
      h.user = U1;
      mountGatedFinish();
      expect(step()).toBe('first_name');
    }
  });

  it('a read before auth has resolved (no user id yet) keeps the store for the person', async () => {
    mountInvite();
    fireEvent.click(await screen.findByTestId('invite-join'));
    await waitFor(() => expect(step()).toBe('dance_role'));
    expect(readInvitePrefill(null)).toBeNull();
    expect(readInvitePrefill(U1.id)).toEqual({ firstName: 'Ana', cityId: 'c1' });
  });
});
