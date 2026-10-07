// @vitest-environment jsdom
/** Onboarding critique fixes: inline Claim/Request hint, create prefill, client-side validation, Esc. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const api = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {} } }));
vi.mock('@/components/ui/city-picker', () => ({ CityPicker: () => <div data-testid="city-picker" /> }));
vi.mock('../selfServeApi', async () => {
  const hint = await vi.importActual<typeof import('../claimHint')>('../claimHint');
  return {
    claimHint: hint.claimHint,
    searchClaimableOrganisers: api.search,
    claimOrganiser: vi.fn(),
    requestOrganiserAccess: vi.fn(),
    createOrganiserProfile: vi.fn(),
  };
});

import { OrganiserOnboarding, instagramProblem, websiteProblem } from '../components/OrganiserOnboarding';

const org = (id: string, name: string, contact_email: string | null) => ({
  id, name, slug: id, avatar_url: null, city_id: null, claimed_by: null, contact_email,
});

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <OrganiserOnboarding
        user={{ id: 'u1', email: 'me@x.example' }}
        mailboxProven
        myOrganiserIds={new Set()}
        requestedIds={new Set()}
        firstRun
        onChanged={vi.fn()}
      />
    </QueryClientProvider>,
  );
}
const search = (value: string) => fireEvent.change(screen.getByTestId('organiser-search'), { target: { value } });

beforeEach(() => api.search.mockReset());
afterEach(cleanup);

describe('result row hints (item 1)', () => {
  it('explains Claim vs Request inside each row, and no footer remains', async () => {
    api.search.mockResolvedValue([org('a', 'Alpha', 'me@x.example'), org('b', 'Beta', 'other@x.example')]);
    mount();
    search('al');
    await waitFor(() => expect(screen.getAllByTestId('organiser-result')).toHaveLength(2));
    const hints = screen.getAllByTestId('action-hint').map((n) => n.textContent);
    expect(hints).toEqual(['Yours to claim: your sign-in email matches', 'Ask to join: the team replies within a day']);
    expect(document.body.textContent).not.toMatch(/Claiming checks the email/);
    expect(document.body.textContent).not.toMatch(/social/i);
  });
});

describe('create prefill (item 4)', () => {
  it('the no-results text is a button that opens create with the typed name', async () => {
    api.search.mockResolvedValue([]);
    mount();
    search('Salsa Nova');
    fireEvent.click(await screen.findByTestId('create-from-search'));
    expect((screen.getByTestId('create-name') as HTMLInputElement).value).toBe('Salsa Nova');
  });

  it('create-open prefills only when the name is empty', async () => {
    api.search.mockResolvedValue([]);
    mount();
    search('Typed');
    fireEvent.click(screen.getByTestId('create-open'));
    const name = screen.getByTestId('create-name') as HTMLInputElement;
    expect(name.value).toBe('Typed');
    fireEvent.change(name, { target: { value: 'Edited' } });
    search('Other');
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByTestId('create-open'));
    expect((screen.getByTestId('create-name') as HTMLInputElement).value).toBe('Edited');
  });
});

describe('validation, Esc and note (item 5)', () => {
  it('validates handles and websites', () => {
    expect(instagramProblem('')).toBeNull();
    expect(instagramProblem('@ana.dance')).toBeNull();
    expect(instagramProblem('https://instagram.com/ana')).toBeNull();
    expect(instagramProblem('not a handle!')).not.toBeNull();
    expect(websiteProblem('https://ana.example')).toBeNull();
    expect(websiteProblem('ana.example')).not.toBeNull();
    expect(websiteProblem('http://ana.example')).not.toBeNull();
  });

  it('shows inline errors and blocks submit on a bad website', () => {
    api.search.mockResolvedValue([]);
    mount();
    fireEvent.click(screen.getByTestId('create-open'));
    fireEvent.change(screen.getByTestId('create-name'), { target: { value: 'Ana' } });
    const site = screen.getByTestId('create-website') as HTMLInputElement;
    expect(site.type).toBe('url');
    fireEvent.change(site, { target: { value: 'nope' } });
    fireEvent.blur(site);
    expect(screen.getByTestId('website-help').textContent).toMatch(/starting with https/);
    expect((screen.getByTestId('create-submit') as HTMLButtonElement).disabled).toBe(true);
  });

  it('Esc closes the open panel and the request note survives a close', async () => {
    api.search.mockResolvedValue([org('b', 'Beta', 'other@x.example')]);
    mount();
    search('be');
    fireEvent.click(await screen.findByTestId('request-open'));
    fireEvent.change(screen.getByTestId('request-note'), { target: { value: 'I run Tuesdays' } });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('request-note')).toBeNull();
    fireEvent.click(screen.getByTestId('request-open'));
    expect((screen.getByTestId('request-note') as HTMLTextAreaElement).value).toBe('I run Tuesdays');
  });
});

describe('failed or offline search', () => {
  it('shows a retry and never "No organiser matches" when the search fails', async () => {
    api.search.mockRejectedValueOnce(new Error('Failed to fetch'));
    mount();
    search('al');
    const box = await screen.findByTestId('organiser-search-error');
    expect(box.getAttribute('role')).toBe('alert');
    expect(screen.queryByTestId('organiser-no-match')).toBeNull();
    expect(document.body.textContent).not.toMatch(/No organiser matches/);
    api.search.mockResolvedValueOnce([org('a', 'Alpha', 'me@x.example')]);
    fireEvent.click(screen.getByTestId('organiser-search-retry'));
    await waitFor(() => expect(screen.getAllByTestId('organiser-result')).toHaveLength(1));
    expect(screen.queryByTestId('organiser-search-error')).toBeNull();
  });
});
