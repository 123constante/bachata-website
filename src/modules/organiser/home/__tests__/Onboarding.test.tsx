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
  return {
    searchClaimableOrganisers: api.search,
    claimOrganiser: api.claim,
    requestOrganiserAccess: api.request,
    createOrganiserProfile: api.create,
  };
});

import type { ClaimHint } from '@/modules/organiser/shared/claimHint';
import { OnboardingView } from '../onboarding/OnboardingView';
import { instagramProblem, rowAction, websiteProblem } from '../onboarding/onboardingModel';

// A search row as searchClaimableOrganisers returns it: the database's hint, no address, no pointer.
const org = (id: string, name: string, hint: ClaimHint | null) => ({
  id, name, slug: id, avatar_url: null, city_id: null, hint,
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
      org('a', 'Alpha', 'email_matches'),
      org('b', 'Beta', 'email_differs'),
      org('c', 'Gamma', 'managed'),
      org('d', 'Delta', 'yours'),
    ]);
    mount();
    search('al');
    const rows = await screen.findAllByTestId('onboarding-result');
    expect(rows).toHaveLength(4);
    expect(rows[0].querySelector('[data-testid="onboarding-claim"]')).toBeTruthy();
    expect(rows[1].querySelector('[data-testid="onboarding-request"]')).toBeTruthy();
    expect(rows[2].querySelector('[data-testid="onboarding-request"]')).toBeTruthy();
    expect(rows[3].querySelectorAll('button')).toHaveLength(1);
    expect(rows[3].querySelector('[data-testid="onboarding-home"]')).toBeTruthy();
    expect(rows[3].textContent).toContain('Yours');
  });

  it('a row without a hint (the hint call failed) offers only Ask to join, and says nothing false', async () => {
    api.search.mockResolvedValue([org('a', 'Alpha', null)]);
    mount();
    search('al');
    const row = (await screen.findAllByTestId('onboarding-result'))[0];
    expect(row.querySelector('[data-testid="onboarding-claim"]')).toBeNull();
    expect(row.querySelector('[data-testid="onboarding-request"]')).toBeTruthy();
    expect(row.textContent).not.toMatch(/contact email|already manage/i);
  });

  it('shows Asked for an organiser with an open request', async () => {
    api.search.mockResolvedValue([org('b', 'Beta', 'email_differs')]);
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
    api.search.mockResolvedValue([org('a', 'Alpha', 'email_matches')]);
    fireEvent.click(screen.getByTestId('onboarding-search-error-retry'));
    expect(await screen.findAllByTestId('onboarding-result')).toHaveLength(1);
  });
});

describe('claim', () => {
  it('a proven session claims in one tap and confirms', async () => {
    api.search.mockResolvedValue([org('a', 'Alpha', 'email_matches')]);
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
    api.search.mockResolvedValue([org('a', 'Alpha', 'email_matches')]);
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
    api.search.mockResolvedValue([org('a', 'Alpha', 'email_matches')]);
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
    api.search.mockResolvedValue([org('b', 'Beta', 'email_differs')]);
    api.request.mockResolvedValue({ request_id: 'r', status: 'open' });
    const { onChanged } = mount();
    search('be');
    fireEvent.click(await screen.findByTestId('onboarding-request'));
    fireEvent.change(await screen.findByTestId('onboarding-request-note'), { target: { value: 'I run it' } });
    fireEvent.click(screen.getByTestId('onboarding-request-send'));
    await waitFor(() => expect(api.request).toHaveBeenCalledWith('b', 'I run it'));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith('Asked to join Beta'));
  });

  it('opens with focus on the note, not on Close, so the keyboard opens on the field', async () => {
    api.search.mockResolvedValue([org('b', 'Beta', 'email_differs')]);
    mount();
    search('be');
    fireEvent.click(await screen.findByTestId('onboarding-request'));
    const note = await screen.findByTestId('onboarding-request-note');
    await waitFor(() => expect(document.activeElement).toBe(note));
  });
});

describe('create', () => {
  it('opens with focus on the organiser name, not on Close', async () => {
    mount();
    fireEvent.click(screen.getByTestId('onboarding-create'));
    const name = await screen.findByTestId('onboarding-create-name');
    await waitFor(() => expect(document.activeElement).toBe(name));
  });

  it('needs a name; the city is the second step and picking it creates', async () => {
    api.rpc.mockResolvedValue({ data: [{ city_id: 'c1', city_name: 'Leeds', city_slug: 'leeds', country_name: 'UK', display_name: 'Leeds, UK' }], error: null });
    api.create.mockResolvedValue({ organiserId: 'n1', slug: 'n', lifecycleStatus: 'live' });
    const { onChanged } = mount();
    fireEvent.click(screen.getByTestId('onboarding-create'));
    expect((await screen.findByTestId('onboarding-create-next') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByTestId('onboarding-create-name'), { target: { value: 'Nova' } });
    fireEvent.click(screen.getByTestId('onboarding-create-next'));
    fireEvent.change(await screen.findByTestId('onboarding-city-search'), { target: { value: 'Le' } });
    expect(api.create).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByTestId('onboarding-city-option'));
    await waitFor(() =>
      expect(api.create).toHaveBeenCalledWith({ name: 'Nova', cityId: 'c1', contactEmail: '', instagram: '', website: '' }),
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith('Nova created'));
  });
});

describe('model', () => {
  it('row actions and field checks', () => {
    expect(rowAction('email_matches', false)).toBe('claim');
    expect(rowAction('email_differs', false)).toBe('request');
    expect(rowAction('no_email', true)).toBe('requested');
    expect(rowAction('yours', true)).toBe('home');
    expect(instagramProblem('@good.name')).toBeNull();
    expect(instagramProblem('bad name')).not.toBeNull();
    expect(websiteProblem('https://x.example')).toBeNull();
    expect(websiteProblem('http://x.example')).not.toBeNull();
  });
});
