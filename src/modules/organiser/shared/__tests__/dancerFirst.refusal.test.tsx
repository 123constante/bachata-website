// @vitest-environment jsdom
/**
 * Dancer first, then organiser (owner decision 2026-10-11). The organiser
 * create / claim / request RPCs refuse an unfinished dancer profile with
 * PROFILE_INCOMPLETE_CODE (the separate admin PR). Wherever one of those calls
 * is made, that refusal sends the person to the gated Finish screen -- which
 * explains itself and has no Skip -- with a returnTo that brings them back,
 * never a raw error. The public claim card also checks the completion the
 * site chrome already publishes, before asking the server at all.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc, auth: { signInWithOtp: vi.fn(), verifyOtp: vi.fn() } },
}));

import { PublicClaimCard } from '../components/PublicClaimCard';
import { OrganiserSheet } from '@/modules/organiser/home/onboarding/OrganiserSheet';
import { ownershipFacts } from '../ownership';
import { ProfileGateContext, type ProfileGateValue } from '@/hooks/useAuth';
import { PROFILE_INCOMPLETE_CODE, isDancerGatedTarget } from '@/lib/accountRouting';
import { finishProfileHref, profileGateValue, type ProfileCompletionStatus } from '@/lib/profileCompletion';

const ORG = { id: 'aaaaaaaa-0000-0000-0000-000000000001', name: 'Ritmo Bachata London' };
const ME = { id: 'me', email: 'diego@ritmo.example' };
const refused = { data: null, error: { message: PROFILE_INCOMPLETE_CODE, code: 'P0001' } };

function Where() {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{`${pathname}${search}`}</p>;
}

const gate = (status: ProfileCompletionStatus): ProfileGateValue =>
  profileGateValue({ status, missing: status === 'incomplete' ? ['dance_role'] : [], profileId: 'p1' });

const mountAt = (path: string, ui: ReactNode, gateValue: ProfileGateValue | 'loading' | null = null) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ProfileGateContext.Provider value={gateValue}>
        <MemoryRouter initialEntries={[path]}>
          <Where />
          <Routes>
            <Route path="/finish-profile" element={<p data-testid="finish">finish</p>} />
            <Route path="*" element={ui} />
          </Routes>
        </MemoryRouter>
      </ProfileGateContext.Provider>
    </QueryClientProvider>,
  );

const claimCard = () => (
  <PublicClaimCard
    facts={ownershipFacts({ flagOn: true, signedIn: true, ownership: { is_managed: false, i_own_it: false, my_role: null }, hint: 'email_matches' })}
    hint="email_matches"
    organiser={ORG}
    user={ME}
    mailboxProven
    returnTo="/organisers/ritmo"
    onChanged={vi.fn()}
  />
);
const BACK_TO_CLAIM = finishProfileHref('/organisers/ritmo?claim=1');

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: { already_claimed: false }, error: null });
});
afterEach(cleanup);

describe('the public claim card', () => {
  it('a server refusal for an unfinished profile goes to the gated Finish screen, back here to claim', async () => {
    rpc.mockResolvedValue(refused);
    mountAt('/organisers/ritmo', claimCard());
    fireEvent.click(screen.getByTestId('public-claim-open'));
    fireEvent.click(screen.getByTestId('public-claim-confirm'));
    await screen.findByTestId('finish');
    expect(screen.getByTestId('where').textContent).toBe(BACK_TO_CLAIM);
    // Gated: the Finish screen explains itself and offers no Skip.
    expect(isDancerGatedTarget('/organisers/ritmo?claim=1')).toBe(true);
  });

  it.each(['incomplete', 'no_profile', 'error'] as const)('a known %s profile never reaches the server', async (status) => {
    mountAt('/organisers/ritmo', claimCard(), gate(status));
    fireEvent.click(screen.getByTestId('public-claim-open'));
    fireEvent.click(screen.getByTestId('public-claim-confirm'));
    await screen.findByTestId('finish');
    expect(screen.getByTestId('where').textContent).toBe(BACK_TO_CLAIM);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('a complete profile claims as before', async () => {
    mountAt('/organisers/ritmo', claimCard(), gate('complete'));
    fireEvent.click(screen.getByTestId('public-claim-open'));
    fireEvent.click(screen.getByTestId('public-claim-confirm'));
    await waitFor(() => expect(screen.getByTestId('public-claim-done')).toBeTruthy());
    expect(rpc.mock.calls).toEqual([['claim_organiser_v1', { p_organiser_id: ORG.id }]]);
  });

  it('other refusals keep their own copy', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'email_mismatch', code: 'P0001' } });
    mountAt('/organisers/ritmo', claimCard(), gate('complete'));
    fireEvent.click(screen.getByTestId('public-claim-open'));
    fireEvent.click(screen.getByTestId('public-claim-confirm'));
    expect(await screen.findByText(/different contact email/)).toBeTruthy();
    expect(screen.queryByTestId('finish')).toBeNull();
  });
});

describe('the organiser onboarding sheet (claim / request / create)', () => {
  const candidate = { id: ORG.id, name: ORG.name, slug: null, avatar_url: null, city_id: null, hint: 'email_matches' as const };

  it.each([
    ['claim', { kind: 'claim' as const, org: candidate }, 'onboarding-claim-confirm'],
    ['request', { kind: 'request' as const, org: candidate }, 'onboarding-request-send'],
  ])('%s refused for an unfinished profile -> the gated Finish screen, back to this page', async (_name, task, button) => {
    rpc.mockResolvedValue(refused);
    mountAt(
      '/account/o?add=1',
      <OrganiserSheet task={task} onTaskChange={vi.fn()} email={ME.email} mailboxProven onClaimed={vi.fn()} onRequested={vi.fn()} onCreated={vi.fn()} onFindPage={vi.fn()} onHome={vi.fn()} />,
    );
    const send = screen.queryByTestId(button) ?? screen.getByRole('button', { name: /Send|Ask/ });
    fireEvent.click(send);
    await screen.findByTestId('finish');
    expect(screen.getByTestId('where').textContent).toBe(finishProfileHref('/account/o?add=1'));
    expect(screen.queryByTestId('onboarding-sheet-error')).toBeNull();
  });
});
