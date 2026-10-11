// @vitest-environment jsdom
/**
 * The dancer-first gate enforced on the SERVER (a separate admin PR: the
 * organiser create / claim / request RPCs refuse an unfinished dancer profile
 * with PROFILE_INCOMPLETE_CODE). Wherever one of those calls is made, the
 * refusal sends the person to the gated Finish screen with returnTo = where
 * they were -- never a raw error, never the generic line.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc, auth: { signInWithOtp: vi.fn(), verifyOtp: vi.fn() } },
}));

import { PublicClaimCard } from '../components/PublicClaimCard';
import { OrganiserSheet, type SheetTask } from '../../home/onboarding/OrganiserSheet';
import { ownershipFacts } from '../ownership';
import { PROFILE_INCOMPLETE_CODE, selfServeErrorCopy } from '../selfServeErrors';
import type { ClaimCandidate } from '../selfServeApi';
import { ProfileGateContext, type ProfileGateValue } from '@/hooks/useAuth';

const refused = { data: null, error: { message: PROFILE_INCOMPLETE_CODE, code: 'P0001' } };
const ORG = { id: 'aaaaaaaa-0000-0000-0000-000000000001', name: 'Ritmo Bachata London' };

function Probe() {
  const { pathname, search } = useLocation();
  return <output data-testid="probe">{`${pathname}${search}`}</output>;
}
const landed = () => new URL(screen.getByTestId('probe').textContent!, 'https://x.test');

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue(refused);
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

describe('PROFILE_INCOMPLETE_CODE', () => {
  it('is the one string the admin PR must raise, and reads as the gate, not "Something went wrong"', () => {
    expect(PROFILE_INCOMPLETE_CODE).toBe('profile_incomplete');
    expect(selfServeErrorCopy(refused.error)).toEqual({
      message: 'Finish your dancer profile first, then you can set up your organiser page.',
      next: 'finish_profile',
    });
  });
});

describe('the organiser onboarding sheet (/account/o)', () => {
  const candidate = { id: ORG.id, name: ORG.name } as ClaimCandidate;
  const mount = (task: SheetTask) =>
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/account/o']}>
          <Probe />
          <Routes>
            <Route
              path="/account/o"
              element={<OrganiserSheet task={task} onTaskChange={vi.fn()} email="diego@ritmo.example" mailboxProven onDone={vi.fn()} />}
            />
            <Route path="*" element={null} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

  it.each([
    ['claim', { kind: 'claim', org: candidate } as SheetTask, 'onboarding-claim-confirm', 'claim_organiser_v1'],
    ['request', { kind: 'request', org: candidate } as SheetTask, 'onboarding-request-send', 'request_organiser_access_v1'],
  ])('a refused %s goes to the gated Finish screen and back to /account/o', async (_n, task, button, fn) => {
    mount(task);
    fireEvent.click(await screen.findByTestId(button));
    await waitFor(() => expect(landed().pathname).toBe('/finish-profile'));
    expect(rpc.mock.calls[0][0]).toBe(fn);
    expect(landed().searchParams.get('gate')).toBe('organiser');
    expect(landed().searchParams.get('returnTo')).toBe('/account/o');
    expect(document.body.textContent).not.toContain(PROFILE_INCOMPLETE_CODE);
  });
});

describe('the public "Is this you?" claim card', () => {
  let setGate: (g: ProfileGateValue | 'loading' | null) => void = () => {};
  function GateHarness({ initial, children }: { initial: ProfileGateValue | 'loading' | null; children: ReactNode }) {
    const [gate, set] = useState(initial);
    setGate = set;
    return <ProfileGateContext.Provider value={gate}>{children}</ProfileGateContext.Provider>;
  }
  const mount = (gate: ProfileGateValue | 'loading' | null = null) =>
    render(
      <GateHarness initial={gate}>
        <MemoryRouter initialEntries={['/organisers/ritmo']}>
          <Probe />
          <Routes>
            <Route
              path="/organisers/ritmo"
              element={
                <PublicClaimCard
                  facts={ownershipFacts({ flagOn: true, signedIn: true, ownership: { is_managed: false, i_own_it: false, my_role: null }, hint: 'email_matches' })}
                  hint="email_matches"
                  organiser={ORG}
                  user={{ id: 'me', email: 'diego@ritmo.example' }}
                  mailboxProven
                  returnTo="/organisers/ritmo"
                  onChanged={vi.fn()}
                />
              }
            />
            <Route path="*" element={null} />
          </Routes>
        </MemoryRouter>
      </GateHarness>,
    );
  const published = (status: ProfileGateValue['status']) => ({ status }) as ProfileGateValue;
  const tapClaim = () => {
    fireEvent.click(screen.getByTestId('public-claim-open'));
    fireEvent.click(screen.getByTestId('public-claim-confirm'));
  };

  it.each(['incomplete', 'no_profile'] as const)(
    'a %s dancer profile already known: the claim is not sent; the gated Finish screen first',
    async (status) => {
      mount(published(status));
      tapClaim();
      await waitFor(() => expect(landed().pathname).toBe('/finish-profile'));
      expect(rpc).not.toHaveBeenCalled();
      expect(landed().searchParams.get('gate')).toBe('organiser');
      expect(landed().searchParams.get('returnTo')).toBe('/organisers/ritmo?claim=1');
    },
  );

  it('a failed completeness check does not block on the client: the server decides', async () => {
    mount(published('error'));
    tapClaim();
    await waitFor(() => expect(landed().pathname).toBe('/finish-profile'));
    expect(rpc.mock.calls[0][0]).toBe('claim_organiser_v1');
  });

  // Both loading forms AppChrome publishes: the string before the chrome mounts, then
  // the chrome's own value while its read is in flight.
  it.each([
    ['chrome not mounted yet', 'loading' as const],
    ['chrome mounted, read in flight', { status: 'loading' } as ProfileGateValue],
  ])('a claim intent waits while the completeness is still loading (%s), then follows it', async (_n, loading) => {
    window.history.replaceState(null, '', '/organisers/ritmo?claim=1');
    try {
      mount(loading);
      await new Promise((r) => setTimeout(r, 30));
      expect(rpc).not.toHaveBeenCalled();
      act(() => setGate(published('incomplete')));
      await waitFor(() => expect(landed().pathname).toBe('/finish-profile'));
      expect(rpc).not.toHaveBeenCalled();
    } finally {
      window.history.replaceState(null, '', '/');
    }
  });

  it('a complete dancer profile claims as before', async () => {
    rpc.mockResolvedValue({ data: { already_claimed: false }, error: null });
    mount(published('complete'));
    tapClaim();
    await waitFor(() => expect(screen.getByTestId('public-claim-done')).toBeTruthy());
    expect(landed().pathname).toBe('/organisers/ritmo');
  });

  it('completeness not known yet: the server decides, and its refusal goes to the gated Finish screen and back to the card with the claim intent', async () => {
    mount();
    tapClaim();
    await waitFor(() => expect(landed().pathname).toBe('/finish-profile'));
    expect(landed().searchParams.get('gate')).toBe('organiser');
    expect(landed().searchParams.get('returnTo')).toBe('/organisers/ritmo?claim=1');
  });
});
