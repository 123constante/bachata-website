// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { firstEventPayload, refusalView } from '../selfSignupModel';

const onboard = vi.fn();
vi.mock('../selfSignupApi', () => ({
  fetchFlagOn: async () => true,
  normaliseSocial: async () => null,
  fetchNameMatches: vi.fn(async () => [{ organiserId: 'org1', displayName: 'Salsa Club', city: 'London', claimed: false, emailMatch: false }]),
  onboardOrganiser: (...a: unknown[]) => onboard(...a),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'a@b.co' }, authStatus: 'ready' }) }));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/lib/breadcrumbs', () => ({ buildBreadcrumbs: () => [] }));
vi.mock('@/modules/organiser/shared/components/EmailCodeProof', () => ({ EmailCodeProof: () => null }));
vi.mock('@/modules/organiser/claim-link/AboutYouScreen', () => ({ default: ({ onSkip }: { onSkip: () => void }) => <button data-testid="about-skip" onClick={onSkip} /> }));
vi.mock('@/modules/organiser/home/onboarding/citySearch', () => ({ searchCities: vi.fn(async () => [{ id: 'c1', label: 'London, UK' }]) }));
vi.mock('@/pages/NotFound', () => ({ default: () => <div>not found</div> }));

describe('model', () => {
  it('payload shape', () => {
    expect(firstEventPayload({ name: ' Social ', date: '2026-12-01' })).toEqual({ name: 'Social', date: '2026-12-01' });
    expect(firstEventPayload(null)).toBeNull();
  });
  it('first_event_invalid goes back to the event step', () => {
    expect(refusalView('first_event_invalid')).toEqual({ action: 'back_to_event', message: 'Check the event name and date.' });
  });
});

describe('page', () => {
  afterEach(() => cleanup());
  beforeEach(() => {
    onboard.mockReset();
    onboard.mockResolvedValue({ kind: 'success', outcome: 'created', organiserId: 'o', slug: 'salsa-club', displayName: 'Salsa Club' });
  });

  async function toWho() {
    const { default: Page } = await import('../SelfSignupPage');
    const { MemoryRouter } = await import('react-router-dom');
    render(<MemoryRouter><Page /></MemoryRouter>);
    fireEvent.change(await screen.findByTestId('signup-name'), { target: { value: 'Salsa Club' } });
    fireEvent.change(screen.getByTestId('signup-city'), { target: { value: 'Lon' } });
    fireEvent.click(await screen.findByTestId('signup-city-option'));
    await screen.findByTestId('signup-match-card');
    fireEvent.click(screen.getByTestId('signup-no'));
  }

  it('who -> event -> Continue sends the first event once', async () => {
    await toWho();
    fireEvent.click(screen.getByTestId('signup-submit'));
    expect(screen.getByText('Your first event')).toBeTruthy();
    expect(screen.getByText('Name and date. Add the times from your page.')).toBeTruthy();
    const cont = screen.getByTestId('signup-event-continue') as HTMLButtonElement;
    expect(cont.disabled).toBe(true);
    fireEvent.change(screen.getByTestId('signup-event-name'), { target: { value: 'Friday Social' } });
    fireEvent.change(screen.getByTestId('signup-event-date'), { target: { value: '2099-01-02' } });
    fireEvent.click(cont);
    fireEvent.click(screen.getByTestId('signup-social-skip'));
    await waitFor(() => expect(onboard).toHaveBeenCalledTimes(1));
    expect(onboard).toHaveBeenCalledWith('Salsa Club', 'c1', null, { name: 'Friday Social', date: '2099-01-02' }, null);
  });

  it('Skip onboards with no first event', async () => {
    await toWho();
    fireEvent.click(screen.getByTestId('signup-submit'));
    fireEvent.click(screen.getByTestId('signup-event-skip'));
    fireEvent.click(screen.getByTestId('signup-social-skip'));
    await waitFor(() => expect(onboard).toHaveBeenCalledWith('Salsa Club', 'c1', null, null, null));
  });

  it('claim picked: no event step', async () => {
    await toWho();
    // re-open the card by changing the name back
    fireEvent.change(screen.getByTestId('signup-name'), { target: { value: 'Salsa Club ' } });
    fireEvent.click(await screen.findByTestId('signup-yes'));
    fireEvent.click(screen.getByTestId('signup-submit'));
    fireEvent.click(screen.getByTestId('signup-social-skip'));
    await waitFor(() => expect(onboard).toHaveBeenCalledWith('Salsa Club ', 'c1', 'org1', null, null));
    expect(screen.queryByText('Your first event')).toBeNull();
  });

  it('Back keeps typed values', async () => {
    await toWho();
    fireEvent.click(screen.getByTestId('signup-submit'));
    fireEvent.change(screen.getByTestId('signup-event-name'), { target: { value: 'Friday Social' } });
    fireEvent.click(screen.getByTestId('signup-event-back'));
    expect(screen.getByTestId('signup-name')).toBeTruthy();
    fireEvent.click(screen.getByTestId('signup-submit'));
    expect((screen.getByTestId('signup-event-name') as HTMLInputElement).value).toBe('Friday Social');
  });

  it('Try again after Skip resends no event, even with a typed draft', async () => {
    onboard.mockResolvedValueOnce({ kind: 'failed' });
    await toWho();
    fireEvent.click(screen.getByTestId('signup-submit'));
    fireEvent.change(screen.getByTestId('signup-event-name'), { target: { value: 'Friday Social' } });
    fireEvent.change(screen.getByTestId('signup-event-date'), { target: { value: '2099-01-02' } });
    fireEvent.click(screen.getByTestId('signup-event-back'));
    fireEvent.click(screen.getByTestId('signup-submit'));
    fireEvent.click(screen.getByTestId('signup-event-skip'));
    fireEvent.click(screen.getByTestId('signup-social-skip'));
    fireEvent.click(await screen.findByTestId('signup-retry'));
    await waitFor(() => expect(onboard).toHaveBeenCalledTimes(2));
    expect(onboard).toHaveBeenLastCalledWith('Salsa Club', 'c1', null, null, null);
  });

  it('keep-list: who, refused and result screens keep their controls', async () => {
    onboard.mockResolvedValueOnce({ kind: 'failed' });
    await toWho();
    for (const id of ['signup-name', 'signup-city-chosen', 'signup-submit', 'signup-save-later']) expect(screen.getByTestId(id)).toBeTruthy();
    expect(screen.getByTestId('signup-submit').textContent).toBe('Create my page');
    fireEvent.click(screen.getByTestId('signup-submit'));
    fireEvent.click(screen.getByTestId('signup-event-skip'));
    fireEvent.click(screen.getByTestId('signup-social-skip'));
    for (const id of ['signup-refusal', 'signup-retry', 'signup-back']) expect(await screen.findByTestId(id)).toBeTruthy();
    fireEvent.click(screen.getByTestId('signup-retry'));
    for (const id of ['signup-outcome', 'signup-continue']) expect(await screen.findByTestId(id)).toBeTruthy();
  });

  it('done screen', async () => {
    await toWho();
    fireEvent.click(screen.getByTestId('signup-submit'));
    fireEvent.click(screen.getByTestId('signup-event-skip'));
    fireEvent.click(screen.getByTestId('signup-social-skip'));
    fireEvent.click(await screen.findByTestId('signup-continue'));
    fireEvent.click(await screen.findByTestId('about-skip'));
    expect(await screen.findByTestId('signup-done-tick')).toBeTruthy();
    expect(screen.getByTestId('signup-done-line').textContent).toBe('You’re all set');
    expect(screen.queryByText('Salsa Club')).toBeNull();
    expect(screen.getByTestId('signup-done-sub').textContent).toBe('Your page is live. Welcome aboard.');
    expect(screen.getByTestId('signup-page-link').textContent).toBe('bachatacalendar.co.uk/organisers/salsa-club');
    expect(screen.getByTestId('signup-share').textContent).toBe('Share your page');
    expect(screen.getByTestId('signup-open-page').textContent).toBe('See my page');
  });
});
