// @vitest-environment jsdom
/**
 * Arc 1 flow 6 (claim a page with no invite): every claim hint x the screen it
 * opens (6a-6e, plus the failed-hint row), from ONE mapping (claimStates.ts).
 * Table-driven: title, line, primary button, "Not this one", and what the
 * primary does. The address on file is never shown.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const api = vi.hoisted(() => ({
  search: vi.fn(),
  claim: vi.fn(),
  request: vi.fn(),
  create: vi.fn(),
  otp: vi.fn(),
  verify: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { signInWithOtp: api.otp, verifyOtp: api.verify }, rpc: api.rpc },
}));
vi.mock('@/modules/organiser/shared/selfServeApi', async () => ({
  searchClaimableOrganisers: api.search,
  claimOrganiser: api.claim,
  requestOrganiserAccess: api.request,
  createOrganiserProfile: api.create,
}));

import type { ClaimHint } from '@/modules/organiser/shared/claimHint';
import { OnboardingView } from '../onboarding/OnboardingView';
import { ORG_PATHS } from '../../shell/paths';
import { CLAIM_HINTS, NOT_THIS_ONE, NO_EMAIL_COPY, claimScreen, hintRowText } from '../onboarding/claimStates';
import { rowAction } from '../onboarding/onboardingModel';

const NAME = 'Salsa Norte';
const org = (hint: ClaimHint | null) => ({ id: 'o1', name: NAME, slug: 'o1', avatar_url: null, city_id: null, hint });

function mount(hint: ClaimHint | null, mailboxProven = true) {
  api.search.mockResolvedValue([org(hint)]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/door']}>
        <Routes>
          <Route
            path="/door"
            element={
              <OnboardingView
                user={{ id: 'u1', email: 'me@x.example' }}
                mailboxProven={mailboxProven}
                myOrganiserIds={new Set()}
                requests={[]}
                firstRun
                onChanged={vi.fn()}
              />
            }
          />
          <Route path={ORG_PATHS.home} element={<p data-testid="at-home" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByTestId('onboarding-search'), { target: { value: 'salsa' } });
}

const openRow = async () => {
  const row = (await screen.findAllByTestId('onboarding-result'))[0];
  const button = row.querySelector('button');
  if (!button) throw new Error('row has no button');
  fireEvent.click(button);
  return screen.findByTestId('onboarding-sheet');
};

beforeEach(() => Object.values(api).forEach((f) => f.mockReset()));
afterEach(cleanup);

// The approved copy (invite-flows-mockups.html flow 6), per hint, verbatim (6a keeps the
// mockup's "owner" wording: owner decision on the PR 3 review). `row` is what the search row
// says and `rowButton` the button it carries: the row and its screen read ONE map.
const EXPECTED: Array<{
  hint: ClaimHint | null;
  row: string;
  rowButton: string;
  screen: string;
  title: string;
  sub: string;
  primary: string;
  primaryTestId: string;
  notThisOne: boolean;
}> = [
  { hint: 'yours', row: 'Yours', rowButton: 'onboarding-home', screen: '6a', title: `${NAME} is yours`, sub: 'You are already its owner.', primary: 'Go to Home', primaryTestId: 'onboarding-yours-home', notThisOne: false },
  { hint: 'managed', row: 'Has a team', rowButton: 'onboarding-request', screen: '6b', title: `${NAME} already has an owner`, sub: 'You can ask to join the team.', primary: 'Ask to join', primaryTestId: 'onboarding-request-send', notThisOne: true },
  { hint: 'email_matches', row: 'Email on file is yours', rowButton: 'onboarding-claim', screen: '6c', title: `Claim ${NAME}`, sub: 'Your email matches the one on file.', primary: 'Claim it', primaryTestId: 'onboarding-claim-confirm', notThisOne: true },
  { hint: 'email_differs', row: 'Has an email on file', rowButton: 'onboarding-request', screen: '6d', title: `Is ${NAME} yours?`, sub: 'The email on file is not yours. Ask to join and we will check.', primary: 'Ask to join', primaryTestId: 'onboarding-request-send', notThisOne: true },
  { hint: 'no_email', row: NO_EMAIL_COPY, rowButton: 'onboarding-request', screen: '6e', title: `Is ${NAME} yours?`, sub: 'We have no email for this page. Ask to join and we will check.', primary: 'Ask to join', primaryTestId: 'onboarding-request-send', notThisOne: true },
  { hint: null, row: 'Ask to join', rowButton: 'onboarding-request', screen: 'unknown', title: `Is ${NAME} yours?`, sub: 'Ask to join and we will check.', primary: 'Ask to join', primaryTestId: 'onboarding-request-send', notThisOne: true },
];

describe('claimScreen: one mapping for every hint', () => {
  it('covers every hint the database returns, and the failed hint call', () => {
    expect(new Set(EXPECTED.map((e) => e.hint))).toEqual(new Set([...CLAIM_HINTS, null]));
  });

  it.each(EXPECTED)('$screen ($hint)', ({ hint, screen: id, title, sub, primary, notThisOne }) => {
    const s = claimScreen(hint, NAME);
    expect(s).toMatchObject({ screen: id, title, sub, primaryLabel: primary, notThisOne });
    // Never an address, never a sentence that names one.
    expect(`${s.title} ${s.sub}`).not.toMatch(/@/);
  });
});

describe('every hint x every screen: the row and the sheet it opens say the same thing', () => {
  it.each(EXPECTED)('$screen ($hint): row words, row button, then the screen', async ({ hint, row, rowButton, title, sub }) => {
    expect(hintRowText(hint)).toBe(row);
    mount(hint);
    const result = (await screen.findAllByTestId('onboarding-result'))[0];
    expect(result.querySelector('[data-testid="onboarding-hint"]')?.textContent).toBe(row);
    expect(result.querySelector(`[data-testid="${rowButton}"]`)).not.toBeNull();
    await openRow();
    expect(screen.getByTestId('onboarding-claim-title').textContent).toBe(title);
    expect(screen.getByTestId('onboarding-claim-sub').textContent).toBe(sub);
  });

  it.each(EXPECTED)('$screen ($hint): the row action is the screen primary', ({ hint }) => {
    const primary = claimScreen(hint, NAME).primary;
    expect(rowAction(hint, false)).toBe(primary);
    // An earlier ask replaces every ask-or-claim button, never your own page's Home.
    expect(rowAction(hint, true)).toBe(primary === 'home' ? 'home' : 'requested');
  });
});

describe('the sheet each row opens (390x844 copy, real component)', () => {
  it.each(EXPECTED)('$screen ($hint): title, line, primary, Not this one', async ({ hint, title, sub, primary, primaryTestId, notThisOne }) => {
    mount(hint);
    const sheet = await openRow();
    expect(sheet.textContent).toContain(title);
    // The deciding sentence wraps in the body: the sheet header truncates long page names.
    expect(screen.getByTestId('onboarding-claim-title').textContent).toBe(title);
    expect(screen.getByTestId('onboarding-claim-sub').textContent).toBe(sub);
    expect((await screen.findByTestId(primaryTestId)).textContent).toContain(primary);
    if (notThisOne) {
      const back = screen.getByTestId('onboarding-not-this-one');
      expect(back.textContent).toBe(NOT_THIS_ONE);
      fireEvent.click(back);
      await waitFor(() => expect(screen.queryByTestId('onboarding-claim-sub')).toBeNull());
      // Back on the search, the row still there.
      expect(screen.getAllByTestId('onboarding-result')).toHaveLength(1);
    } else {
      expect(screen.queryByTestId('onboarding-not-this-one')).toBeNull();
    }
  });

  it('6a: Go to Home leaves onboarding for Home', async () => {
    mount('yours');
    await openRow();
    fireEvent.click(await screen.findByTestId('onboarding-yours-home'));
    expect(await screen.findByTestId('at-home')).toBeTruthy();
  });

  it('6c with an unproven mailbox: the same title and line, then the code step first (no Claim button yet)', async () => {
    mount('email_matches', false);
    await openRow();
    expect(screen.getByTestId('onboarding-claim-sub').textContent).toBe('Your email matches the one on file.');
    expect(screen.queryByTestId('onboarding-claim-confirm')).toBeNull();
    expect(await screen.findByTestId('email-code-send')).toBeTruthy();
  });

  it.each(['managed', 'email_differs', 'no_email'] as const)('%s: Ask to join sends the request for that page', async (hint) => {
    api.request.mockResolvedValue({ request_id: 'r', status: 'open' });
    mount(hint);
    await openRow();
    fireEvent.click(await screen.findByTestId('onboarding-request-send'));
    await waitFor(() => expect(api.request).toHaveBeenCalledWith('o1', ''));
  });

  it('6c: Claim it claims that page', async () => {
    api.claim.mockResolvedValue({ already_claimed: false });
    mount('email_matches');
    await openRow();
    fireEvent.click(await screen.findByTestId('onboarding-claim-confirm'));
    await waitFor(() => expect(api.claim).toHaveBeenCalledWith('o1'));
  });

  it('a refused claim becomes the ask-to-join screen without claiming the email matches', async () => {
    api.claim.mockRejectedValue({ message: 'email_mismatch' });
    mount('email_matches');
    await openRow();
    fireEvent.click(await screen.findByTestId('onboarding-claim-confirm'));
    expect(await screen.findByTestId('onboarding-request-send')).toBeTruthy();
    expect(screen.getByTestId('onboarding-claim-sub').textContent).toBe('Ask to join and we will check.');
  });
});
