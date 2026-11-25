// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const onboard = vi.fn();
const normalise = vi.fn();
vi.mock('../selfSignupApi', () => ({
  fetchFlagOn: async () => true,
  fetchNameMatches: vi.fn(async () => [{ organiserId: 'org1', displayName: 'Salsa Club', city: 'London', claimed: false, emailMatch: false }]),
  onboardOrganiser: (...a: unknown[]) => onboard(...a),
  normaliseSocial: (...a: unknown[]) => normalise(...a),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'a@b.co' }, authStatus: 'ready' }) }));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/lib/breadcrumbs', () => ({ buildBreadcrumbs: () => [] }));
vi.mock('@/modules/organiser/shared/components/EmailCodeProof', () => ({ EmailCodeProof: () => null }));
vi.mock('@/modules/organiser/claim-link/AboutYouScreen', () => ({ default: () => null }));
vi.mock('@/modules/organiser/home/onboarding/citySearch', () => ({ searchCities: vi.fn(async () => [{ id: 'c1', label: 'London, UK' }]) }));
vi.mock('@/pages/NotFound', () => ({ default: () => <div>not found</div> }));

describe('social step', () => {
  afterEach(() => cleanup());
  beforeEach(() => {
    onboard.mockReset();
    normalise.mockReset();
    normalise.mockResolvedValue(null);
    onboard.mockResolvedValue({ kind: 'success', outcome: 'created', organiserId: 'o', slug: 's', displayName: 'Salsa Club' });
  });

  async function toWho() {
    const { default: Page } = await import('../SelfSignupPage');
    const { MemoryRouter } = await import('react-router-dom');
    render(<MemoryRouter><Page /></MemoryRouter>);
    fireEvent.change(await screen.findByTestId('signup-name'), { target: { value: 'Salsa Club' } });
    fireEvent.change(screen.getByTestId('signup-city'), { target: { value: 'Lon' } });
    fireEvent.click(await screen.findByTestId('signup-city-option'));
    await screen.findByTestId('signup-match-card');
  }
  async function toSocial() {
    await toWho();
    fireEvent.click(screen.getByTestId('signup-no'));
    fireEvent.click(screen.getByTestId('signup-submit'));
    fireEvent.click(screen.getByTestId('signup-event-skip'));
  }
  const type = (v: string) => fireEvent.change(screen.getByTestId('signup-social-input'), { target: { value: v } });

  it('shows heading, sub line and one input', async () => {
    await toSocial();
    expect(screen.getByText('Instagram or website')).toBeTruthy();
    expect(screen.getByText('Paste a link, a handle or a web address. Any format works.')).toBeTruthy();
    expect(document.querySelectorAll('input').length).toBe(1);
    expect(screen.getByTestId('signup-save-later')).toBeTruthy();
  });

  it('Instagram URL and bare handle preview as Instagram: @handle', async () => {
    await toSocial();
    normalise.mockResolvedValue({ kind: 'instagram', value: 'salsa_club' });
    type('https://instagram.com/salsa_club');
    expect((await screen.findByTestId('signup-social-line', {}, { timeout: 2000 })).textContent).toContain('Instagram: @salsa_club');
    type('@salsa_club');
    await waitFor(() => expect(normalise).toHaveBeenLastCalledWith('@salsa_club'));
    expect((await screen.findByTestId('signup-social-line')).textContent).toContain('Instagram: @salsa_club');
  });

  it('web address previews without https://, Change focuses and selects', async () => {
    await toSocial();
    normalise.mockResolvedValue({ kind: 'website', value: 'https://salsa.co.uk/events' });
    type('salsa.co.uk/events');
    const line = await screen.findByTestId('signup-social-line', {}, { timeout: 2000 });
    expect(line.textContent).toContain('Website: salsa.co.uk/events');
    expect(line.textContent).not.toContain('https://');
    fireEvent.click(screen.getByTestId('signup-social-change'));
    expect(document.activeElement).toBe(screen.getByTestId('signup-social-input'));
  });

  it('unknown shows the grey line and Continue still sends', async () => {
    await toSocial();
    normalise.mockResolvedValue({ kind: 'unknown', value: '' });
    type('???');
    expect((await screen.findByTestId('signup-social-unknown', {}, { timeout: 2000 })).textContent).toBe('We could not read that. Check it, or skip.');
    fireEvent.click(screen.getByTestId('signup-social-continue'));
    await waitFor(() => expect(onboard).toHaveBeenCalledWith('Salsa Club', 'c1', null, null, '???'));
  });

  it('failed preview shows no line and Continue sends the raw text', async () => {
    await toSocial();
    type(' @salsa ');
    await waitFor(() => expect(normalise).toHaveBeenCalled());
    expect(screen.queryByTestId('signup-social-line')).toBeNull();
    expect(screen.queryByTestId('signup-social-unknown')).toBeNull();
    fireEvent.click(screen.getByTestId('signup-social-continue'));
    await waitFor(() => expect(onboard).toHaveBeenCalledWith('Salsa Club', 'c1', null, null, ' @salsa '));
  });

  it('Skip sends null even with text typed', async () => {
    await toSocial();
    type('@salsa');
    fireEvent.click(screen.getByTestId('signup-social-skip'));
    await waitFor(() => expect(onboard).toHaveBeenCalledWith('Salsa Club', 'c1', null, null, null));
  });

  it('Back keeps the typed text', async () => {
    await toSocial();
    type('@salsa');
    fireEvent.click(screen.getByTestId('signup-social-back'));
    expect(screen.getByText('Your first event')).toBeTruthy();
    fireEvent.click(screen.getByTestId('signup-event-skip'));
    expect((screen.getByTestId('signup-social-input') as HTMLInputElement).value).toBe('@salsa');
  });

  it('claim path reaches social without the event step', async () => {
    await toWho();
    fireEvent.click(screen.getByTestId('signup-yes'));
    fireEvent.click(screen.getByTestId('signup-submit'));
    expect(screen.queryByText('Your first event')).toBeNull();
    expect(screen.getByText('Instagram or website')).toBeTruthy();
    fireEvent.click(screen.getByTestId('signup-social-back'));
    expect(screen.getByTestId('signup-name')).toBeTruthy();
  });
});
