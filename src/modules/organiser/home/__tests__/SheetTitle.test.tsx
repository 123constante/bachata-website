// @vitest-environment jsdom
/** S-POLISH 1: every create refusal heads the sheet with ONE shared title, never the step's ("City"). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const api = vi.hoisted(() => ({ search: vi.fn(), create: vi.fn(), rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: api.rpc } }));
vi.mock('@/modules/organiser/shared/selfServeApi', () => ({
  searchClaimableOrganisers: api.search,
  claimOrganiser: vi.fn(),
  requestOrganiserAccess: vi.fn(),
  createOrganiserProfile: api.create,
}));

import { OnboardingView } from '../onboarding/OnboardingView';
import { NEW_PAGE_TITLE, newPageSheetTitle } from '../../flows/newpage/model';

const KINDS = [
  { kind: 'name_taken', code: 'organiser_name_taken' },
  { kind: 'cap', code: 'draft_limit_reached' },
  { kind: 'invite', code: 'organiser_invite_required' },
  { kind: 'other', code: 'something_odd' },
] as const;

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.search.mockResolvedValue([]);
  api.rpc.mockResolvedValue({ data: [{ city_id: 'c1', city_name: 'Leeds', city_slug: 'leeds', country_name: 'UK', display_name: 'Leeds, UK' }], error: null });
});
afterEach(cleanup);

const mount = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <OnboardingView user={{ id: 'u1', email: 'me@x.example' }} mailboxProven myOrganiserIds={new Set()} requests={[]} firstRun onChanged={vi.fn()} />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('create sheet header', () => {
  it('the step titles stay when nothing was refused', () => {
    expect(newPageSheetTitle('name', null)).toBe('New page');
    expect(newPageSheetTitle('city', null)).toBe('City');
  });

  it.each(KINDS)('$kind refusal: header is the shared title, not "City"', async ({ code }) => {
    api.create.mockRejectedValue(new Error(code));
    mount();
    fireEvent.click(screen.getByTestId('onboarding-create'));
    fireEvent.change(await screen.findByTestId('onboarding-create-name'), { target: { value: 'Nova' } });
    fireEvent.click(screen.getByTestId('onboarding-create-next'));
    expect(screen.getByTestId('onboarding-sheet-title').textContent).toBe('City');
    fireEvent.change(await screen.findByTestId('onboarding-city-search'), { target: { value: 'Le' } });
    fireEvent.click(await screen.findByTestId('onboarding-city-option'));
    await screen.findByTestId('onboarding-create-refusal');
    await waitFor(() => expect(screen.getByTestId('onboarding-sheet-title').textContent).toBe(NEW_PAGE_TITLE));
    expect(screen.getByTestId('onboarding-sheet-title').textContent).not.toBe('City');
    expect(screen.queryByTestId('onboarding-sheet-back')).toBeNull();
  });
});
