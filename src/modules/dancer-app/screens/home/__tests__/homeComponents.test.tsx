// @vitest-environment jsdom
/** Component wiring: HomeMainCard per shape, ClaimYourPage per claim status (the model is tested in homeModel.test.ts). */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ outcome: { status: 'no_match', profileId: null } as { status: string; profileId: string | null } }));
vi.mock('@/lib/claimMyDancerProfile', async (orig) => ({
  ...(await orig<typeof import('@/lib/claimMyDancerProfile')>()),
  claimMyDancerProfile: async () => h.outcome,
}));
vi.mock('@/lib/myPersona', async (orig) => ({ ...(await orig<typeof import('@/lib/myPersona')>()), invalidateMyPersonaCaches: async () => undefined }));

import { ClaimYourPage } from '../ClaimYourPage';
import { HomeMainCard } from '../HomeMainCard';
import { CLAIM_COPY, claimView } from '../homeModel';

afterEach(cleanup);

const base = { first_name: null, avatar_url: null, profile_id: 'p1', bio: null, instagram: null, facebook: null, website_url: null };
const withMissing = (missing: string[]) => ({
  ...base,
  strength: { pct: 0, missing, next_step: missing[0] ?? null },
}) as never;

const renderCard = (missing: string[], nights: number | null) =>
  render(<MemoryRouter><HomeMainCard profile={withMissing(missing)} nightsWent={nights} /></MemoryRouter>);

describe('HomeMainCard shapes', () => {
  it('stub: Finish your profile, one next button, numbers line, no attended', () => {
    renderCard(['first_name', 'city', 'role', 'photo', 'started_year', 'styles', 'bio_social'], null);
    expect(screen.getByTestId('home-main').getAttribute('data-shape')).toBe('stub');
    expect(screen.getByText('Finish your profile')).toBeTruthy();
    expect(screen.getByTestId('home-next-step').textContent).toBe('Add your first name');
    expect(screen.queryByTestId('home-checklist')).toBeNull();
    expect(screen.queryByTestId('home-attended')).toBeNull();
  });
  it('unfinished: checklist once with one next', () => {
    renderCard(['role', 'photo'], 2);
    expect(screen.getAllByTestId('home-checklist')).toHaveLength(1);
    expect(screen.getByTestId('home-checklist').querySelectorAll('li')).toHaveLength(4);
  });
  it('complete with nights: number shown, no checklist, no next button', () => {
    renderCard([], 12);
    expect(screen.getByTestId('home-attended').textContent).toContain('12');
    expect(screen.queryByTestId('home-checklist')).toBeNull();
    expect(screen.queryByTestId('home-next-step')).toBeNull();
  });
  it('complete with 0 nights: empty state with one action, never a headline 0', () => {
    renderCard([], 0);
    expect(screen.queryByTestId('home-attended')).toBeNull();
    expect(screen.getByTestId('home-attended-empty').querySelectorAll('a')).toHaveLength(1);
  });
});

describe('ClaimYourPage per claim status', () => {
  it.each([
    ['no_match', 'no_match'],
    ['ambiguous', 'ambiguous'],
    ['email_unproven', 'email_unproven'],
    ['unavailable', 'unavailable'],
    ['linked', 'linked'],
  ])('%s shows its own copy', async (status, view) => {
    h.outcome = { status, profileId: status === 'linked' ? 'p9' : null };
    const onLinked = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter><ClaimYourPage onLinked={onLinked} onDismiss={() => undefined} /></MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByTestId('claim-button').textContent).toBe('Claim your page');
    fireEvent.click(screen.getByTestId('claim-button'));
    const copy = CLAIM_COPY[claimView(status as never)];
    await waitFor(() => expect(screen.getByTestId('claim-status').textContent).toBe(copy.body));
    expect(view).toBe(claimView(status as never));
    expect(onLinked).toHaveBeenCalledTimes(status === 'linked' ? 1 : 0);
    expect(screen.queryByTestId('claim-dismiss') === null).toBe(status === 'linked');
  });
  it('the one dismissal calls onDismiss', () => {
    const onDismiss = vi.fn();
    render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><ClaimYourPage onLinked={() => undefined} onDismiss={onDismiss} /></MemoryRouter></QueryClientProvider>);
    fireEvent.click(screen.getByTestId('claim-dismiss'));
    expect(onDismiss).toHaveBeenCalled();
  });
});
