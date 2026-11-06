// @vitest-environment jsdom
/**
 * Brief claim-sheet-honest-retry: a refused claim switches the sheet to "Ask to join" (P3 wording, never
 * "request access"); a failed page search offers Try again. Shapes: the real refusal codes
 * (organiser_already_claimed / email_mismatch / no_contact_email), mailbox_unproven and
 * request_already_open unchanged, an untouched sheet sends nothing, search error then success.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: vi.fn(), from: vi.fn() } }));
vi.mock('@/modules/organiser/wizard/wizardCountries', () => ({ wizardCountries: () => Promise.resolve([]) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'sam@example.com' } }) }));
vi.mock('@/components/account/profiles/signOutToHome', () => ({ SIGN_OUT_FAILED: 'failed', useSignOutToHome: () => ({ signOutToHome: vi.fn(async () => 'ok'), busy: false }) }));
vi.mock('../../data/useP3Data', () => ({ useP3Home: () => ({ data: { organisers: [] }, isPending: false, isError: false, refetch: vi.fn() }) }));

import OnboardingFlow from '../OnboardingFlow';
import type { PageReads, PageWrites } from '../pageApi';
import type { PersonReads, PersonWrites } from '../personApi';

const PAGES = [{ id: 'leeds', name: 'Bachata Nights Leeds', slug: null, avatar_url: null, city_id: null, hint: 'email_matches' as const }];
const PERSON_READS: PersonReads = {
  dancer: async () => ({ first_name: 'Sam', avatar_url: null, dance_role: 'Follower', nationality: 'GB', languages: ['English'] }),
  intent: async () => ({ roles: [], declined: [] }) as never,
  teacher: async () => null as never,
  organiser: async () => null as never,
};

function mount(opts: { claimFail?: string; findFailTimes?: number } = {}) {
  let finds = 0;
  const reads: PageReads = {
    page: vi.fn(async () => null),
    phone: vi.fn(async () => null),
    status: vi.fn(async () => null),
    findPages: vi.fn(async () => {
      finds += 1;
      if (finds <= (opts.findFailTimes ?? 0)) throw new Error('network');
      return PAGES;
    }),
    cities: vi.fn(async () => []),
    requests: vi.fn(async () => []),
  };
  const writes: PageWrites = {
    run: vi.fn(async () => undefined),
    create: vi.fn(async () => 'o1'),
    claim: vi.fn(async () => { if (opts.claimFail) throw new Error(opts.claimFail); }),
    ask: vi.fn(async () => undefined),
    rename: vi.fn(async () => undefined),
  };
  const personWrites: PersonWrites = { run: vi.fn(async () => undefined), skipAbout: vi.fn(async () => undefined) };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/account/p3/start?at=find']}>
        <Routes>
          <Route path="/account/p3/start" element={<OnboardingFlow reads={reads} writes={writes} personReads={PERSON_READS} personWrites={personWrites} organiserDetail upload={async () => ''} />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { reads, writes };
}

const search = async () => {
  await screen.findByTestId('p3-ob-find-q');
  fireEvent.change(screen.getByTestId('p3-ob-find-q'), { target: { value: 'Leed' } });
};

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('refused claim -> Ask to join', () => {
  it.each(['organiser_already_claimed', 'email_mismatch', 'no_contact_email'])('%s', async (code) => {
    const { writes } = mount({ claimFail: code });
    await search();
    fireEvent.click(await screen.findByTestId('p3-ob-find-leeds'));
    const go = await screen.findByTestId('p3-ob-claim-go');
    expect(go.textContent).toBe('Claim it');
    expect(writes.claim).not.toHaveBeenCalled();
    fireEvent.click(go);
    await screen.findByTestId('p3-ob-claim-err');
    expect(writes.claim).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('p3-ob-claim-err').textContent?.toLowerCase()).not.toContain('request access');
    expect(screen.getByTestId('p3-ob-claim-go').textContent).toBe('Ask to join');
    fireEvent.click(screen.getByTestId('p3-ob-claim-go'));
    await waitFor(() => expect(writes.ask).toHaveBeenCalledTimes(1));
    expect(writes.claim).toHaveBeenCalledTimes(1);
  });

  it('mailbox_unproven keeps Claim it and the email-code path', async () => {
    mount({ claimFail: 'mailbox_unproven' });
    await search();
    fireEvent.click(await screen.findByTestId('p3-ob-find-leeds'));
    fireEvent.click(await screen.findByTestId('p3-ob-claim-go'));
    await screen.findByTestId('p3-ob-claim-err');
    expect(screen.getByTestId('p3-ob-claim-go').textContent).toBe('Claim it');
    expect(screen.getByText('Confirm with an email code')).toBeTruthy();
  });
});

describe('search error -> Try again', () => {
  it('shows the button, tap refetches, success replaces the error', async () => {
    const { reads } = mount({ findFailTimes: 1 });
    await search();
    const retry = await screen.findByTestId('p3-ob-find-retry');
    expect(retry.textContent).toBe('Try again');
    expect(reads.findPages).toHaveBeenCalledTimes(1);
    fireEvent.click(retry);
    await screen.findByTestId('p3-ob-find-leeds');
    expect(reads.findPages).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('p3-ob-find-retry')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
