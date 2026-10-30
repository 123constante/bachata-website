// @vitest-environment jsdom
/**
 * Brief p3-landing-welcome (owner 2026-10-30): the already-asked state on P3's Welcome and Find your
 * page. A page the person already asked to join shows "Waiting for an answer, asked <date>" on its Find
 * row; its sheet has NO Ask to join button, only "You asked on <date>. We will get back to you." in
 * normal text (role=status, never the red error); Welcome lists the open requests. Shapes: prod's
 * no_email live page (Tropicana's), a claimable page, 0 / 1 / 2 open requests, a declined one (not
 * shown), the request read failing (nothing shown, the button stays), and the server's
 * request_already_open from a stale list (the same line, no date, not red).
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
import type { MyAccessRequest } from '../../../shared/selfServeApi';
import { askedLine, askedOn, waitingRowText } from '../../../home/onboarding/onboardingModel';
import { hintRowText } from '../../../home/onboarding/claimStates';

const ASKED = '2026-10-29T18:04:00Z';
const req = (organiserId: string, organiserName: string, status = 'open'): MyAccessRequest => ({ requestId: `r-${organiserId}`, organiserId, organiserName, status, createdAt: ASKED, resolvedAt: status === 'open' ? null : ASKED });
const PAGES = [
  { id: 'trop', name: 'Tropicana', slug: null, avatar_url: null, city_id: null, hint: 'no_email' as const },
  { id: 'leeds', name: 'Bachata Nights Leeds', slug: null, avatar_url: null, city_id: null, hint: 'email_matches' as const },
];
const PERSON_READS: PersonReads = {
  dancer: async () => ({ first_name: 'Sam', avatar_url: null, dance_role: 'Follower', nationality: 'GB', languages: ['English'] }),
  intent: async () => ({ roles: [], declined: [] }) as never,
  teacher: async () => null as never,
  organiser: async () => null as never,
};

function mount(opts: { at?: string; requests?: MyAccessRequest[] | 'fail' | 'none'; askFail?: string }) {
  const reads: PageReads = {
    page: vi.fn(async () => null),
    phone: vi.fn(async () => null),
    status: vi.fn(async () => null),
    findPages: vi.fn(async () => PAGES),
    cities: vi.fn(async () => []),
    ...(opts.requests === 'none' ? {} : { requests: vi.fn(async () => { if (opts.requests === 'fail') throw new Error('network'); return (opts.requests ?? []) as MyAccessRequest[]; }) }),
  };
  const writes: PageWrites = {
    run: vi.fn(async () => undefined),
    create: vi.fn(async () => 'o1'),
    claim: vi.fn(async () => undefined),
    ask: vi.fn(async () => { if (opts.askFail) throw new Error(opts.askFail); }),
    rename: vi.fn(async () => undefined),
  };
  const personWrites: PersonWrites = { run: vi.fn(async () => undefined), skipAbout: vi.fn(async () => undefined) };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/account/p3/start${opts.at ? `?at=${opts.at}` : ''}`]}>
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
  fireEvent.change(screen.getByTestId('p3-ob-find-q'), { target: { value: 'Trop' } });
  return screen.findByTestId('p3-ob-find-trop');
};

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('the one wording', () => {
  it('has the date, and a dateless form for the server-only case', () => {
    expect(askedOn(ASKED)).not.toBe('');
    expect(askedLine(ASKED)).toBe(`You asked on ${askedOn(ASKED)}. We will get back to you.`);
    expect(waitingRowText(ASKED)).toBe(`Waiting for an answer, asked ${askedOn(ASKED)}`);
    expect(askedLine(null)).toBe('You already asked to join this page. We will get back to you.');
    expect(askedLine('not a date')).toBe('You already asked to join this page. We will get back to you.');
  });
});

describe('Find your page x request shape', () => {
  const CASES = [
    { name: 'open request on Tropicana', requests: [req('trop', 'Tropicana')], asked: true },
    { name: 'two open requests', requests: [req('trop', 'Tropicana'), req('x', 'Other')], asked: true },
    { name: 'declined request only', requests: [req('trop', 'Tropicana', 'declined')], asked: false },
    { name: 'no request', requests: [], asked: false },
    { name: 'request read failed', requests: 'fail' as const, asked: false },
    { name: 'reads without requests (old callers)', requests: 'none' as const, asked: false },
  ];
  it.each(CASES)('$name', async ({ requests, asked }) => {
    const { writes } = mount({ at: 'find', requests });
    const row = await search();
    if (asked) await waitFor(() => expect(row.textContent).toContain(waitingRowText(ASKED)));
    else expect(row.textContent).toContain(hintRowText('no_email'));
    // The other page's row is never touched.
    expect(screen.getByTestId('p3-ob-find-leeds').textContent).not.toContain('Waiting');
    fireEvent.click(row);
    await screen.findByTestId('p3-ob-sheet-claim');
    if (asked) {
      expect(screen.getByTestId('p3-ob-claim-asked').textContent).toBe(askedLine(ASKED));
      expect(screen.getByTestId('p3-ob-claim-asked').getAttribute('role')).toBe('status');
      expect(screen.queryByTestId('p3-ob-claim-go')).toBeNull();
      expect(screen.queryByTestId('p3-ob-claim-err')).toBeNull();
      expect(document.body.textContent).not.toContain('You already asked for access');
      fireEvent.click(screen.getByTestId('p3-ob-claim-close'));
      await waitFor(() => expect(screen.queryByTestId('p3-ob-sheet-claim')).toBeNull());
    } else {
      expect(screen.getByTestId('p3-ob-claim-go').textContent).toBe('Ask to join');
      expect(screen.queryByTestId('p3-ob-claim-asked')).toBeNull();
    }
    expect(writes.ask).not.toHaveBeenCalled();
  });

  it('the server says request_already_open (stale list): the asked line, not the red error', async () => {
    const { writes } = mount({ at: 'find', requests: [], askFail: 'request_already_open' });
    fireEvent.click(await search());
    fireEvent.click(await screen.findByTestId('p3-ob-claim-go'));
    await screen.findByTestId('p3-ob-claim-asked');
    expect(screen.getByTestId('p3-ob-claim-asked').textContent).toBe(askedLine(null));
    expect(screen.queryByTestId('p3-ob-claim-err')).toBeNull();
    expect(screen.queryByTestId('p3-ob-claim-go')).toBeNull();
    expect(writes.ask).toHaveBeenCalledTimes(1);
  });

  it('any other refusal still shows as an error with the button', async () => {
    mount({ at: 'find', requests: [], askFail: 'request_limit_reached' });
    fireEvent.click(await search());
    fireEvent.click(await screen.findByTestId('p3-ob-claim-go'));
    expect((await screen.findByTestId('p3-ob-claim-err')).textContent).toContain('too many open requests');
    expect(screen.getByTestId('p3-ob-claim-go')).toBeTruthy();
  });
});

describe('Welcome x request shape', () => {
  it('open requests: one "Waiting for an answer" card, a row each with the asked line', async () => {
    mount({ requests: [req('trop', 'Tropicana'), req('x', 'Other'), req('d', 'Said no', 'declined')] });
    const rows = await screen.findAllByTestId('p3-ob-waiting-row');
    expect(rows.map((r) => r.textContent)).toEqual([`Tropicana: ${askedLine(ASKED)}`, `Other: ${askedLine(ASKED)}`]);
    expect(screen.getByTestId('p3-ob-waiting').textContent).toContain('Waiting for an answer');
    // Find your page is still the way on.
    expect(screen.getByTestId('p3-ob-continue')).toBeTruthy();
  });
  it.each([
    { name: 'no request', requests: [] as MyAccessRequest[] },
    { name: 'declined only', requests: [req('d', 'Said no', 'declined')] },
    { name: 'read failed', requests: 'fail' as const },
  ])('$name: no waiting card', async ({ requests }) => {
    mount({ requests });
    await screen.findByTestId('p3-ob-signedin');
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId('p3-ob-waiting')).toBeNull();
  });
});
