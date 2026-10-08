// @vitest-environment jsdom
/** W1 onboarding: search, claim (proven and via the email code), ask to join, create, refusal mapping. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

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
vi.mock('@/modules/organiser/shared/selfServeApi', async () => {
  const hint = await vi.importActual<typeof import('@/modules/organiser/shared/claimHint')>('@/modules/organiser/shared/claimHint');
  return {
    claimHint: hint.claimHint,
    searchClaimableOrganisers: api.search,
    claimOrganiser: api.claim,
    requestOrganiserAccess: api.request,
    createOrganiserProfile: api.create,
  };
});

import { OnboardingView } from '../onboarding/OnboardingView';
import { instagramProblem, rowAction, websiteProblem } from '../onboarding/onboardingModel';

const org = (id: string, name: string, contact_email: string | null, claimed_by: string | null = null) => ({
  id, name, slug: id, avatar_url: null, city_id: null, claimed_by, contact_email,
});

function mount(props: Partial<Parameters<typeof OnboardingView>[0]> = {}) {
  const onChanged = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <OnboardingView
          user={{ id: 'u1', email: 'me@x.example' }}
          mailboxProven
          myOrganiserIds={new Set()}
          requests={[]}
          firstRun
          onChanged={onChanged}
          {...props}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { onChanged };
}
const search = (value: string) => fireEvent.change(screen.getByTestId('onboarding-search'), { target: { value } });

beforeEach(() => Object.values(api).forEach((f) => f.mockReset()));
afterEach(cleanup);

describe('search results', () => {
  it('offers Claim only when the listed email is yours, Ask to join otherwise, nothing for your own', async () => {
    api.search.mockResolvedValue([
      org('a', 'Alpha', 'me@x.example'),
      org('b', 'Beta', 'other@x.example'),
      org('c', 'Gamma', null, 'someone'),
      org('d', 'Delta', null, 'u1'),
    ]);
    mount();
    search('al');
    const rows = await screen.findAllByTestId('onboarding-result');
    expect(rows).toHaveLength(4);
    expect(rows[0].querySelector('[data-testid="onboarding-claim"]')).toBeTruthy();
    expect(rows[1].querySelector('[data-testid="onboarding-request"]')).toBeTruthy();
    expect(rows[2].querySelector('[data-testid="onboarding-request"]')).toBeTruthy();
    expect(rows[3].querySelector('button')).toBeNull();
    expect(rows[3].textContent).toContain('You already manage this');
  });

  it('shows Asked for an organiser with an open request', async () => {
    api.search.mockResolvedValue([org('b', 'Beta', 'other@x.example')]);
    mount({ requests: [{ requestId: 'r', organiserId: 'b', organiserName: 'Beta', status: 'open', createdAt: '2026-10-06T00:00:00Z', resolvedAt: null }] });
    search('be');
    expect(await screen.findByTestId('onboarding-requested')).toBeTruthy();
    expect(screen.getByTestId('onboarding-pending-row').textContent).toContain('Beta');
  });

  it('no match offers create with the typed name', async () => {
    api.search.mockResolvedValue([]);
    mount();
    search('Salsa Nova');
    fireEvent.click(await screen.findByTestId('onboarding-create-from-search'));
    expect((await screen.findByTestId('onboarding-create-name') as HTMLInputElement).value).toBe('Salsa Nova');
  });

  it('a failed search says so and retries', async () => {
    api.search.mockRejectedValueOnce(new Error('net'));
    mount();
    search('al');
    expect(await screen.findByTestId('onboarding-search-error')).toBeTruthy();
    api.search.mockResolvedValue([org('a', 'Alpha', 'me@x.example')]);
    fireEvent.click(screen.getByTestId('onboarding-search-error-retry'));
    expect(await screen.findAllByTestId('onboarding-result')).toHaveLength(1);
  });
});

describe('claim', () => {
  it('a proven session claims in one tap and confirms', async () => {
    api.search.mockResolvedValue([org('a', 'Alpha', 'me@x.example')]);
    api.claim.mockResolvedValue({ already_claimed: false });
    const { onChanged } = mount();
    search('al');
    fireEvent.click(await screen.findByTestId('onboarding-claim'));
    fireEvent.click(await screen.findByTestId('onboarding-claim-confirm'));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith('Alpha is yours. You can now manage it.'));
    expect(api.claim).toHaveBeenCalledWith('a');
    expect(screen.getByTestId('onboarding-done').textContent).toContain('Alpha is yours');
  });

  it('an unproven session proves the mailbox with an emailed code, then claims', async () => {
    api.search.mockResolvedValue([org('a', 'Alpha', 'me@x.example')]);
    api.otp.mockResolvedValue({ error: null });
    api.verify.mockResolvedValue({ error: null });
    api.claim.mockResolvedValue({ already_claimed: false });
    const { onChanged } = mount({ mailboxProven: false });
    search('al');
    fireEvent.click(await screen.findByTestId('onboarding-claim'));
    expect(screen.queryByTestId('onboarding-claim-confirm')).toBeNull();
    fireEvent.click(await screen.findByTestId('email-code-send'));
    const input = await screen.findByTestId('email-code-input');
    expect(api.otp.mock.calls[0][0]).toMatchObject({ email: 'me@x.example', options: { shouldCreateUser: false } });
    fireEvent.change(input, { target: { value: '12345678' } });
    fireEvent.click(screen.getByTestId('email-code-verify'));
    await waitFor(() => expect(api.claim).toHaveBeenCalledWith('a'));
    expect(api.verify).toHaveBeenCalledWith({ email: 'me@x.example', token: '12345678', type: 'email' });
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('a refused claim (email mismatch) turns into a request with the reason shown', async () => {
    api.search.mockResolvedValue([org('a', 'Alpha', 'me@x.example')]);
    api.claim.mockRejectedValue({ message: 'email_mismatch' });
    mount();
    search('al');
    fireEvent.click(await screen.findByTestId('onboarding-claim'));
    fireEvent.click(await screen.findByTestId('onboarding-claim-confirm'));
    expect(await screen.findByTestId('onboarding-request-send')).toBeTruthy();
    expect(screen.getByTestId('onboarding-sheet-error').textContent?.length).toBeGreaterThan(5);
  });
});

describe('ask to join', () => {
  it('sends the note and confirms', async () => {
    api.search.mockResolvedValue([org('b', 'Beta', 'other@x.example')]);
    api.request.mockResolvedValue({ request_id: 'r', status: 'open' });
    const { onChanged } = mount();
    search('be');
    fireEvent.click(await screen.findByTestId('onboarding-request'));
    fireEvent.change(await screen.findByTestId('onboarding-request-note'), { target: { value: 'I run it' } });
    fireEvent.click(screen.getByTestId('onboarding-request-send'));
    await waitFor(() => expect(api.request).toHaveBeenCalledWith('b', 'I run it'));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith('Request sent. The team will check and add you to Beta.'));
  });
});

describe('create', () => {
  it('needs a name and a city; the city is picked in a view of the same sheet', async () => {
    api.rpc.mockResolvedValue({ data: [{ city_id: 'c1', city_name: 'Leeds', city_slug: 'leeds', country_name: 'UK', display_name: 'Leeds, UK' }], error: null });
    api.create.mockResolvedValue({ organiserId: 'n1', slug: 'n', lifecycleStatus: 'draft' });
    const { onChanged } = mount();
    fireEvent.click(screen.getByTestId('onboarding-create'));
    const submit = await screen.findByTestId('onboarding-create-submit');
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('onboarding-create-missing').textContent).toContain('the organiser name and the city');
    fireEvent.change(screen.getByTestId('onboarding-create-name'), { target: { value: 'Nova' } });
    fireEvent.click(screen.getByTestId('onboarding-create-city'));
    fireEvent.change(await screen.findByTestId('onboarding-city-search'), { target: { value: 'Le' } });
    fireEvent.click(await screen.findByTestId('onboarding-city-option'));
    expect((await screen.findByTestId('onboarding-create-city')).textContent).toContain('Leeds, UK');
    expect((await screen.findByTestId('onboarding-create-name') as HTMLInputElement).value).toBe('Nova');
    fireEvent.click(screen.getByTestId('onboarding-create-submit'));
    await waitFor(() =>
      expect(api.create).toHaveBeenCalledWith({ name: 'Nova', cityId: 'c1', contactEmail: 'me@x.example', instagram: '', website: '' }),
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(onChanged.mock.calls[0][0]).toContain('Nova is saved as a draft');
  });
});

describe('model', () => {
  it('row actions and field checks', () => {
    expect(rowAction('email_matches', false)).toBe('claim');
    expect(rowAction('email_differs', false)).toBe('request');
    expect(rowAction('no_email', true)).toBe('requested');
    expect(rowAction('yours', true)).toBe('none');
    expect(instagramProblem('@good.name')).toBeNull();
    expect(instagramProblem('bad name')).not.toBeNull();
    expect(websiteProblem('https://x.example')).toBeNull();
    expect(websiteProblem('http://x.example')).not.toBeNull();
  });
});
