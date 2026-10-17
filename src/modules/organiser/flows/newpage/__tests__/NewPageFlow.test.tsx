// @vitest-environment jsdom
/** S9 C40/C40b: name, then city = ONE create_organiser_profile_v1 call; the refusals each leave ONE action. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { useState } from 'react';
import { smallControls } from './tapTargets';

const api = vi.hoisted(() => ({ create: vi.fn(), search: vi.fn(), rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: api.rpc } }));
vi.mock('@/modules/organiser/shared/selfServeApi', () => ({
  createOrganiserProfile: api.create,
  searchClaimableOrganisers: api.search,
}));

import { NewPageFlow } from '../NewPageFlow';

const cb = { onCreated: vi.fn(), onAskToJoin: vi.fn(), onFindPage: vi.fn(), onHome: vi.fn() };

function Harness({ initial = '' }: { initial?: string }) {
  const [step, setStep] = useState<'name' | 'city'>('name');
  const [name, setName] = useState(initial);
  return <NewPageFlow step={step} onStep={setStep} name={name} onName={setName} {...cb} />;
}
const mount = (initial?: string) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Harness initial={initial} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};
const LEEDS = { data: [{ city_id: 'c1', city_name: 'Leeds', city_slug: 'leeds', country_name: 'UK', display_name: 'Leeds, UK' }], error: null };

async function toCity(name = 'Nova') {
  fireEvent.change(screen.getByTestId('onboarding-create-name'), { target: { value: name } });
  fireEvent.click(screen.getByTestId('onboarding-create-next'));
  fireEvent.change(await screen.findByTestId('onboarding-city-search'), { target: { value: 'Le' } });
  return screen.findByTestId('onboarding-city-option');
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-20T10:00:00Z'));
  Object.values(api).forEach((f) => f.mockReset());
  Object.values(cb).forEach((f) => f.mockReset());
  api.rpc.mockResolvedValue(LEEDS);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('C40 name, C40b city', () => {
  it('name first: Next is off until there is a name, and nothing is sent yet', () => {
    mount();
    expect((screen.getByTestId('onboarding-create-next') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByTestId('onboarding-create-name'), { target: { value: 'Nova' } });
    expect((screen.getByTestId('onboarding-create-next') as HTMLButtonElement).disabled).toBe(false);
    expect(api.create).not.toHaveBeenCalled();
  });

  it('picking the city IS the create: exactly ONE create_organiser_profile_v1 call, then onCreated', async () => {
    api.create.mockResolvedValue({ organiserId: 'n1', slug: 'nova', lifecycleStatus: 'live' });
    mount();
    fireEvent.click(await toCity('  Nova  '));
    await waitFor(() => expect(cb.onCreated).toHaveBeenCalledWith({ name: 'Nova', organiserId: 'n1' }));
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.create).toHaveBeenCalledWith({ name: '  Nova  ', cityId: 'c1', contactEmail: '', instagram: '', website: '' });
  });

  it('a second tap while the call is out sends nothing more', async () => {
    let resolve!: (v: unknown) => void;
    api.create.mockReturnValue(new Promise((r) => (resolve = r)));
    mount();
    const option = await toCity();
    fireEvent.click(option);
    fireEvent.click(option);
    expect(api.create).toHaveBeenCalledTimes(1);
    resolve({ organiserId: 'n1', slug: null, lifecycleStatus: 'live' });
    await waitFor(() => expect(cb.onCreated).toHaveBeenCalledTimes(1));
  });

  it('no copy about a draft, a review or the team approving: the page is live on creation', async () => {
    mount();
    expect(document.body.textContent).not.toMatch(/draft|review|approve|checks new/i);
    await toCity();
    expect(document.body.textContent).not.toMatch(/draft|review|approve|checks new/i);
  });

  it('every control is at least 44px', async () => {
    const { container } = mount();
    expect(smallControls(container)).toEqual([]);
    await toCity();
    expect(smallControls(container)).toEqual([]);
  });
});

describe('refusals leave exactly one action', () => {
  it('organiser_name_taken names the page and offers ONE action, Ask to join <page>', async () => {
    api.create.mockRejectedValue({ message: 'organiser_name_taken' });
    api.search.mockResolvedValue([{ id: 'o7', name: 'Nova Bachata', slug: 'nova', avatar_url: null, city_id: 'c1', hint: 'no_email' }]);
    mount();
    fireEvent.click(await toCity('nova  bachata'));
    const refusal = await screen.findByTestId('onboarding-create-refusal');
    expect(refusal.textContent).toContain('Nova Bachata');
    const actions = within(refusal).getAllByRole('button');
    expect(actions).toHaveLength(1);
    expect(actions[0].textContent).toBe('Ask to join Nova Bachata');
    fireEvent.click(actions[0]);
    expect(cb.onAskToJoin).toHaveBeenCalledWith(expect.objectContaining({ id: 'o7', name: 'Nova Bachata' }));
    expect(api.create).toHaveBeenCalledTimes(1);
  });

  it('organiser_name_taken with no page found by that name leads to Find your page, still one action', async () => {
    api.create.mockRejectedValue({ message: 'organiser_name_taken' });
    api.search.mockResolvedValue([]);
    mount();
    fireEvent.click(await toCity('Nova'));
    const refusal = await screen.findByTestId('onboarding-create-refusal');
    const actions = within(refusal).getAllByRole('button');
    expect(actions).toHaveLength(1);
    fireEvent.click(actions[0]);
    expect(cb.onFindPage).toHaveBeenCalledWith('Nova');
  });

  it('the 24 h cap shows the reason with ONE action: Home', async () => {
    api.create.mockRejectedValue({ message: 'draft_limit_reached' });
    mount();
    fireEvent.click(await toCity());
    const refusal = await screen.findByTestId('onboarding-create-refusal');
    expect(refusal.textContent).toMatch(/24 hours/);
    const actions = within(refusal).getAllByRole('button');
    expect(actions).toHaveLength(1);
    expect(actions[0].textContent).toBe('Back to Home');
    fireEvent.click(actions[0]);
    expect(cb.onHome).toHaveBeenCalled();
  });
});
