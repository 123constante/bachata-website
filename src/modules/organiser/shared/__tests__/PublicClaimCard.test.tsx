// @vitest-environment jsdom
/**
 * Lever 2 W7: the "Is this you?" card on the public organiser page (mockup
 * 06-A). The RPCs are mocked at the Supabase client; this asserts what the
 * card OFFERS in each state, what it SENDS, and how it reads each refusal.
 * The server rules are proved in the admin repo (D4) and by the envelope
 * receipts in the PR body. jsdom does no layout: nothing visual is asserted.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc, auth: { signInWithOtp: vi.fn(), verifyOtp: vi.fn() } },
}));

import { ManagedBadge, PublicClaimCard } from '../components/PublicClaimCard';
import { ownershipFacts, type OrganiserOwnership } from '../ownership';
import type { ClaimHint } from '../claimHint';

const ORG = { id: 'aaaaaaaa-0000-0000-0000-000000000001', name: 'Ritmo Bachata London' };
const UNMANAGED: OrganiserOwnership = { is_managed: false, i_own_it: false, my_role: null };
const MANAGED: OrganiserOwnership = { is_managed: true, i_own_it: false, my_role: null };
const ME = { id: 'me', email: 'diego@ritmo.example' };
const refusal = (code: string) => ({ data: null, error: { message: code, code: 'P0001' } });

// The card receives the page's ONE ownership decision (ownershipFacts) plus the hint.
type Over = Partial<Parameters<typeof PublicClaimCard>[0]> & {
  flagOn?: boolean;
  ownership?: OrganiserOwnership | null;
  hintIs?: ClaimHint | null;
};
const props = (over: Over = {}, onChanged = vi.fn()) => {
  const { flagOn = true, ownership = UNMANAGED, hintIs = 'email_matches', ...rest } = over;
  const user = 'user' in rest ? rest.user : ME;
  return {
    facts: ownershipFacts({ flagOn, signedIn: !!user, ownership, hint: user ? hintIs : null }),
    hint: user ? hintIs : null,
    organiser: ORG, user, mailboxProven: true, returnTo: '/organisers/ritmo', onChanged, ...rest,
  };
};
function mount(over: Over = {}) {
  const onChanged = vi.fn();
  const view = render(<MemoryRouter><PublicClaimCard {...props(over, onChanged)} /></MemoryRouter>);
  return { ...view, onChanged };
}

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: { already_claimed: false, owner_seeded: true }, error: null });
});
afterEach(cleanup);

describe('PublicClaimCard', () => {
  it('renders nothing when the flag is off, even for a matching signed-in user', () => {
    const { container } = mount({ flagOn: false });
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing for a claimed organiser (the badge is the only ownership signal)', () => {
    const { container } = mount({ ownership: MANAGED, hintIs: 'managed' });
    expect(container.innerHTML).toBe('');
    expect(screen.queryByTestId('public-claim-open')).toBeNull();
  });

  it('signed out: offers sign-in that returns to this page', () => {
    mount({ user: null });
    const link = screen.getByTestId('public-claim-signin');
    expect(link.getAttribute('href')).toBe('/auth?mode=signin&returnTo=%2Forganisers%2Fritmo');
    expect(screen.queryByTestId('public-claim-open')).toBeNull();
  });

  it('email matches, mailbox proven: claims through claim_organiser_v1 and confirms', async () => {
    const { onChanged } = mount();
    fireEvent.click(screen.getByTestId('public-claim-open'));
    expect(screen.getByTestId('public-claim-panel').textContent).toContain('diego@ritmo.example');
    fireEvent.click(screen.getByTestId('public-claim-confirm'));
    await waitFor(() => expect(screen.getByTestId('public-claim-done')).toBeTruthy());
    expect(rpc.mock.calls).toEqual([['claim_organiser_v1', { p_organiser_id: ORG.id }]]);
    expect(onChanged.mock.calls).toEqual([['claimed']]);
    expect(screen.getByTestId('public-claim-done').textContent).toContain('This is your page');
    expect(screen.getByText(/Go to my events/).getAttribute('href')).toBe('/account/o');
  });

  it('email matches, password session: asks for the email code before claiming', () => {
    mount({ mailboxProven: false });
    fireEvent.click(screen.getByTestId('public-claim-open'));
    expect(screen.getByTestId('public-claim-proof')).toBeTruthy();
    expect(screen.queryByTestId('public-claim-confirm')).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('a claim refused with email_mismatch shows the copy and turns into the request panel', async () => {
    rpc.mockResolvedValue(refusal('email_mismatch'));
    const { onChanged } = mount();
    fireEvent.click(screen.getByTestId('public-claim-open'));
    fireEvent.click(screen.getByTestId('public-claim-confirm'));
    await waitFor(() => expect(screen.getByTestId('public-claim-error')).toBeTruthy());
    expect(screen.getByTestId('public-claim-error').textContent).toContain('different contact email');
    expect(screen.getByTestId('public-request-panel')).toBeTruthy();
    expect(screen.queryByTestId('public-claim-done')).toBeNull();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('a claim refused with organiser_already_claimed offers request access, reports the stale row, and keeps the panel through the refetch', async () => {
    rpc.mockResolvedValue(refusal('organiser_already_claimed'));
    const onChanged = vi.fn();
    const { rerender } = render(<MemoryRouter><PublicClaimCard {...props({}, onChanged)} /></MemoryRouter>);
    fireEvent.click(screen.getByTestId('public-claim-open'));
    fireEvent.click(screen.getByTestId('public-claim-confirm'));
    await waitFor(() => expect(screen.getByTestId('public-request-panel')).toBeTruthy());
    expect(screen.getByTestId('public-claim-error').textContent).toContain('already manages this organiser');
    expect(onChanged.mock.calls).toEqual([['stale']]);
    // The page refetches: the row now reads as managed. The open request panel survives...
    rerender(<MemoryRouter><PublicClaimCard {...props({ ownership: MANAGED, hintIs: 'managed' }, onChanged)} /></MemoryRouter>);
    expect(screen.getByTestId('public-request-panel')).toBeTruthy();
    // ...and closing it leaves only the badge (the card is gone).
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByTestId('public-claim-card')).toBeNull();
  });

  it('a refusal that does not date the row (email_mismatch) is not reported as stale', async () => {
    rpc.mockResolvedValue(refusal('email_mismatch'));
    const { onChanged } = mount();
    fireEvent.click(screen.getByTestId('public-claim-open'));
    fireEvent.click(screen.getByTestId('public-claim-confirm'));
    await waitFor(() => expect(screen.getByTestId('public-request-panel')).toBeTruthy());
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('the ghost Cancel and Not me buttons are 44px tall (this card sits outside the tap-44 wrapper)', () => {
    mount({ hintIs: 'email_differs' });
    fireEvent.click(screen.getByTestId('public-claim-open'));
    expect(screen.getByText('Cancel').className).toContain('min-h-[44px]');
    cleanup();
    mount();
    fireEvent.click(screen.getByTestId('public-claim-open'));
    expect(screen.getByText('Not me').className).toContain('min-h-[44px]');
  });

  it('email differs: goes straight to request access and sends the note', async () => {
    rpc.mockResolvedValue({ data: { request_id: 'r1', status: 'open' }, error: null });
    const { onChanged } = mount({ hintIs: 'email_differs' });
    fireEvent.click(screen.getByTestId('public-claim-open'));
    expect(screen.queryByTestId('public-claim-panel')).toBeNull();
    expect(screen.getByTestId('public-request-panel').textContent).toContain('different contact email');
    fireEvent.change(screen.getByTestId('public-request-note'), { target: { value: '  I run the Tuesday class ' } });
    fireEvent.click(screen.getByTestId('public-request-send'));
    await waitFor(() => expect(screen.getByTestId('public-claim-done')).toBeTruthy());
    expect(rpc.mock.calls).toEqual([['request_organiser_access_v1', { p_organiser_id: ORG.id, p_message: 'I run the Tuesday class' }]]);
    expect(screen.getByTestId('public-claim-done').textContent).toContain('Request sent');
    expect(onChanged.mock.calls).toEqual([['requested']]);
  });

  it('a session that ends while a panel is open hides the panel and offers sign-in', () => {
    const onChanged = vi.fn();
    const { rerender } = render(<MemoryRouter><PublicClaimCard {...props({}, onChanged)} /></MemoryRouter>);
    fireEvent.click(screen.getByTestId('public-claim-open'));
    expect(screen.getByTestId('public-claim-panel')).toBeTruthy();
    rerender(<MemoryRouter><PublicClaimCard {...props({ user: null }, onChanged)} /></MemoryRouter>);
    expect(screen.queryByTestId('public-claim-panel')).toBeNull();
    expect(screen.queryByTestId('public-claim-confirm')).toBeNull();
    expect(screen.getByTestId('public-claim-signin')).toBeTruthy();
  });

  it('a claim refused with authentication_required offers sign-in back to this page', async () => {
    rpc.mockResolvedValue(refusal('authentication_required'));
    mount();
    fireEvent.click(screen.getByTestId('public-claim-open'));
    fireEvent.click(screen.getByTestId('public-claim-confirm'));
    await waitFor(() => expect(screen.getByTestId('public-claim-error')).toBeTruthy());
    expect(screen.getByTestId('public-claim-signin').getAttribute('href')).toBe('/auth?mode=signin&returnTo=%2Forganisers%2Fritmo');
  });

  it('no contact email: says so and offers request access', () => {
    mount({ hintIs: 'no_email' });
    fireEvent.click(screen.getByTestId('public-claim-open'));
    expect(screen.getByTestId('public-request-panel').textContent).toContain('no contact email');
  });

  it('a duplicate request reads as "already asked", never as raw server text', async () => {
    rpc.mockResolvedValue(refusal('request_already_open'));
    mount({ hintIs: 'no_email' });
    fireEvent.click(screen.getByTestId('public-claim-open'));
    fireEvent.click(screen.getByTestId('public-request-send'));
    await waitFor(() => expect(screen.getByTestId('public-claim-error')).toBeTruthy());
    expect(screen.getByTestId('public-claim-error').textContent).toContain('already asked for access');
    expect(screen.getByTestId('public-claim-error').textContent).not.toContain('request_already_open');
  });
});

describe('ManagedBadge', () => {
  it('names the organiser as the manager', () => {
    render(<ManagedBadge size="sm" />);
    expect(screen.getByTestId('managed-badge').textContent).toContain('Managed by the organiser');
  });
});
