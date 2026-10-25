// @vitest-environment jsdom
/**
 * W2 walk findings 6, 8 and 9 (copy and small controls): the page phone's help
 * says what really happens (it shows by default); the beta is said up front;
 * Page name has a hint and its disabled Next says why; the city is offered from
 * the sign-up city; nationality matches "Brit" and the other demonyms.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const api = vi.hoisted(() => ({ rpc: vi.fn(), create: vi.fn(), search: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: api.rpc, from: vi.fn() } }));
vi.mock('@/modules/organiser/shared/selfServeApi', async (orig) => ({
  ...(await orig<object>()),
  createOrganiserProfile: api.create,
  searchClaimableOrganisers: api.search,
}));

import { NewPageFlow, type NewPageStep } from '@/modules/organiser/flows/newpage';
import { BETA_NOTE, PAGE_NAME_HINT, PAGE_NAME_NEXT_REASON } from '@/modules/organiser/flows/newpage/cannotCreate';
import { OnboardingView } from '../onboarding/OnboardingView';
import { ORG_PHONE_HELP } from '@/modules/organiser/wizard/registry';
import { matchCountries } from '@/modules/organiser/wizard/wizardCountries';

afterEach(cleanup);
beforeEach(() => Object.values(api).forEach((f) => f.mockReset()));

const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

function newPage(step: NewPageStep, name: string, userId?: string) {
  const onStep = vi.fn();
  render(
    <QueryClientProvider client={client()}>
      <MemoryRouter>
        <NewPageFlow step={step} onStep={onStep} name={name} onName={() => {}} onCreated={() => {}} onAskToJoin={() => {}} onFindPage={() => {}} onHome={() => {}} userId={userId} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { onStep };
}

describe('finding 6: the page phone help matches the default (shown)', () => {
  it('says it shows and where to hide it', () => {
    render(<MemoryRouter>{ORG_PHONE_HELP}</MemoryRouter>);
    expect(document.body.textContent).toBe('It shows on your page so dancers can reach you. You can hide it in My page.');
    expect(document.body.textContent).not.toMatch(/only if you switch/);
    expect(screen.getByRole('link', { name: 'My page' }).getAttribute('href')).toBe('/account/o/page');
  });
});

describe('finding 8: the beta is said up front', () => {
  it('on Find your page, before any name or city', () => {
    api.search.mockResolvedValue([]);
    render(
      <QueryClientProvider client={client()}>
        <MemoryRouter>
          <OnboardingView user={{ id: 'u1', email: 'me@x.example' }} mailboxProven myOrganiserIds={new Set()} requests={[]} firstRun onChanged={() => {}} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByTestId('onboarding-beta-note').textContent).toBe(BETA_NOTE);
  });

  it('on the Page name step too', () => {
    newPage('name', '');
    expect(screen.getByTestId('onboarding-beta-note').textContent).toBe(BETA_NOTE);
  });
});

describe('finding 9: Page name, city, nationality', () => {
  it('Page name has a hint, and the disabled Next says why', () => {
    newPage('name', '');
    expect(document.body.textContent).toContain(PAGE_NAME_HINT);
    const next = screen.getByTestId('onboarding-create-next') as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    const why = next.getAttribute('aria-describedby');
    expect(why && document.getElementById(why)?.textContent).toBe(PAGE_NAME_NEXT_REASON);
  });

  it('a typed name: Next is on and no reason shows', () => {
    newPage('name', 'Ritmo');
    const next = screen.getByTestId('onboarding-create-next') as HTMLButtonElement;
    expect(next.disabled).toBe(false);
    expect(document.body.textContent).not.toContain(PAGE_NAME_NEXT_REASON);
  });

  it('the city step offers the sign-up city in one tap', async () => {
    api.rpc.mockImplementation(async (fn: string) => (fn === 'my_dancer_edit_v1'
      ? { data: { profile_id: 'p1', based_city_id: 'c-lon', city_name: 'London', other_roles: [] }, error: null }
      : { data: null, error: { message: `unexpected ${fn}` } }));
    api.create.mockResolvedValue({ organiserId: 'org-9' });
    newPage('city', 'Ritmo', 'u1');
    const use = await screen.findByTestId('onboarding-city-suggested');
    expect(use.textContent).toContain('London');
    fireEvent.click(use);
    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
    expect(api.create.mock.calls[0][0]).toMatchObject({ name: 'Ritmo', cityId: 'c-lon' });
  });

  it('no sign-up city: no suggestion, the search as before', async () => {
    api.rpc.mockResolvedValue({ data: null, error: { message: 'no_profile' } });
    newPage('city', 'Ritmo', 'u1');
    await waitFor(() => expect(api.rpc).toHaveBeenCalled());
    expect(screen.queryByTestId('onboarding-city-suggested')).toBeNull();
    expect(screen.getByTestId('onboarding-city-search')).toBeTruthy();
  });

  const LIST = [
    { code: 'GB', name: 'United Kingdom', demonym: 'British' },
    { code: 'NL', name: 'Netherlands', demonym: 'Dutch' },
    { code: 'ES', name: 'Spain', demonym: 'Spanish' },
    { code: 'DO', name: 'Dominican Republic', demonym: 'Dominican' },
  ];
  it.each([
    ['Brit', 'GB'], ['british', 'GB'], ['English', 'GB'], ['Scottish', 'GB'], ['Welsh', 'GB'], ['UK', 'GB'],
    ['Dutch', 'NL'], ['Spani', 'ES'], ['Spain', 'ES'], ['domin', 'DO'],
  ])('nationality "%s" finds %s', (q, code) => {
    expect(matchCountries(LIST, q).map((c) => c.code)).toContain(code);
  });
});
