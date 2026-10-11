// @vitest-environment jsdom
/**
 * One intent (owner decision 2026-10-11): "Sign in to claim" carries ?claim=1
 * through sign-in, and the card runs the claim itself when the visitor comes
 * back signed in, matching and mailbox-proven. Every case renders under
 * StrictMode (effects run twice) and asserts how many times
 * claim_organiser_v1 was called (0 or 1), which card shows, and whether the
 * marker left the address bar. The refusal cases compare the card with the
 * one the MANUAL path (Claim this page -> Yes, claim it) leaves behind: the
 * auto path must read exactly the same.
 */
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const rpc = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => ({ signInWithOtp: vi.fn(), verifyOtp: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, auth } }));

import { PublicClaimCard } from '../components/PublicClaimCard';
import { ownershipFacts, type OrganiserOwnership } from '../ownership';
import type { ClaimHint } from '../claimHint';

const ORG = { id: 'aaaaaaaa-0000-0000-0000-000000000001', name: 'Ritmo Bachata London' };
const UNMANAGED: OrganiserOwnership = { is_managed: false, i_own_it: false, my_role: null };
const MANAGED: OrganiserOwnership = { is_managed: true, i_own_it: false, my_role: null };
const OWNER: OrganiserOwnership = { is_managed: true, i_own_it: true, my_role: 'owner' };
const ME = { id: 'me', email: 'diego@ritmo.example' };
const PAGE = '/organisers/ritmo';
const MARKED = `${PAGE}?claim=1`;
const refusal = (code: string) => ({ data: null, error: { message: code, code: 'P0001' } });
const claimCalls = () => rpc.mock.calls.filter(([fn]) => fn === 'claim_organiser_v1');

type Visitor = 'signed_out' | 'matching' | 'email_differs' | 'no_email' | 'matching_unproven';
const VISITORS: Record<Visitor, { user: typeof ME | null; hint: ClaimHint | null; mailboxProven: boolean }> = {
  signed_out: { user: null, hint: null, mailboxProven: false },
  matching: { user: ME, hint: 'email_matches', mailboxProven: true },
  email_differs: { user: ME, hint: 'email_differs', mailboxProven: true },
  no_email: { user: ME, hint: 'no_email', mailboxProven: true },
  matching_unproven: { user: ME, hint: 'email_matches', mailboxProven: false },
};

type Outcome = 'ok' | 'email_mismatch' | 'authentication_required' | 'organiser_already_claimed' | 'not_live';
const OUTCOMES: Outcome[] = ['ok', 'email_mismatch', 'authentication_required', 'organiser_already_claimed', 'not_live'];
const answer = (o: Outcome) => (o === 'ok' ? { data: { already_claimed: false, owner_seeded: true }, error: null } : refusal(o));

interface PropsIn {
  visitor: Visitor;
  ownership?: OrganiserOwnership | null;
  hint?: ClaimHint | null;
  hintLoading?: boolean;
  onChanged?: ReturnType<typeof vi.fn>;
}
const cardProps = ({ visitor, ownership = UNMANAGED, hint, hintLoading = false, onChanged = vi.fn() }: PropsIn) => {
  const v = VISITORS[visitor];
  const h = hint === undefined ? v.hint : hint;
  return {
    facts: ownershipFacts({ flagOn: true, signedIn: !!v.user, ownership, hint: h, hintLoading }),
    hint: h,
    organiser: ORG,
    user: v.user,
    mailboxProven: v.mailboxProven,
    returnTo: PAGE,
    onChanged,
  };
};
const tree = (entry: string, p: ReturnType<typeof cardProps>) => (
  <StrictMode>
    <MemoryRouter initialEntries={[entry]}>
      <PublicClaimCard {...p} />
    </MemoryRouter>
  </StrictMode>
);
/** The browser's address bar: the page arrived at `entry` (the router is a MemoryRouter, so set both). */
function arrive(entry: string) {
  window.history.replaceState(null, '', entry);
}
const addressBar = () => `${window.location.pathname}${window.location.search}`;

/** The card the MANUAL path leaves after the same RPC answer (the reference for "exactly as today"). */
async function manualCardText(outcome: Outcome): Promise<string> {
  rpc.mockResolvedValue(answer(outcome));
  arrive(PAGE);
  const view = render(tree(PAGE, cardProps({ visitor: 'matching' })));
  fireEvent.click(screen.getByTestId('public-claim-open'));
  fireEvent.click(screen.getByTestId('public-claim-confirm'));
  await waitFor(() => expect(screen.queryByTestId('public-claim-error') ?? screen.queryByTestId('public-claim-done')).toBeTruthy());
  const text = (screen.queryByTestId('public-claim-card') ?? screen.getByTestId('public-claim-done')).textContent ?? '';
  view.unmount();
  rpc.mockReset();
  return text;
}

beforeEach(() => {
  rpc.mockReset();
  auth.signInWithOtp.mockReset().mockResolvedValue({ error: null });
  auth.verifyOtp.mockReset().mockResolvedValue({ error: null });
  arrive(PAGE);
});
afterEach(cleanup);

describe('PublicClaimCard: claim intent through sign-in', () => {
  it('"Sign in to claim" carries the intent marker through sign-in and back', () => {
    render(tree(PAGE, cardProps({ visitor: 'signed_out' })));
    expect(screen.getByTestId('public-claim-signin').getAttribute('href')).toBe(
      `/auth?mode=signin&returnTo=${encodeURIComponent(MARKED)}`,
    );
  });

  const cases: Array<[boolean, Visitor, Outcome]> = [];
  for (const marker of [true, false]) {
    for (const visitor of Object.keys(VISITORS) as Visitor[]) {
      for (const outcome of OUTCOMES) cases.push([marker, visitor, outcome]);
    }
  }

  it.each(cases)('marker=%s visitor=%s rpc=%s', async (marker, visitor, outcome) => {
    const reference = marker && visitor === 'matching' ? await manualCardText(outcome) : null;
    rpc.mockResolvedValue(answer(outcome));
    const entry = marker ? MARKED : PAGE;
    arrive(entry);
    const onChanged = vi.fn();
    render(tree(entry, cardProps({ visitor, onChanged })));

    const autoClaims = marker && visitor === 'matching';
    if (autoClaims) {
      await waitFor(() => expect(screen.queryByTestId('public-claim-error') ?? screen.queryByTestId('public-claim-done')).toBeTruthy());
      expect(claimCalls()).toEqual([['claim_organiser_v1', { p_organiser_id: ORG.id }]]);
      const shown = screen.queryByTestId('public-claim-card') ?? screen.getByTestId('public-claim-done');
      expect(shown.textContent).toBe(reference);
      if (outcome === 'ok') {
        expect(screen.getByTestId('public-claim-done').textContent).toContain('This is your page');
        expect(onChanged.mock.calls).toEqual([['claimed']]);
      } else {
        expect(screen.getByTestId('public-claim-error')).toBeTruthy();
        const stale = outcome === 'organiser_already_claimed' || outcome === 'not_live';
        expect(onChanged.mock.calls).toEqual(stale ? [['stale']] : []);
      }
    } else {
      // Let any (wrong) effect run before asserting nothing happened.
      await act(async () => { await Promise.resolve(); });
      expect(claimCalls()).toEqual([]);
      expect(screen.queryByTestId('public-claim-done')).toBeNull();
      expect(screen.queryByTestId('public-claim-error')).toBeNull();
      expect(onChanged).not.toHaveBeenCalled();
      if (visitor === 'signed_out') {
        expect(screen.getByTestId('public-claim-signin').textContent).toContain('Sign in to claim');
      } else if (visitor === 'email_differs' || visitor === 'no_email') {
        expect(screen.getByTestId('public-claim-open').textContent).toContain('Ask to join');
        expect(screen.queryByTestId('public-request-panel')).toBeNull();
      } else if (marker && visitor === 'matching_unproven') {
        // The intent opens the claim panel at the email-code step; the claim waits for the proof.
        expect(screen.getByTestId('public-claim-proof')).toBeTruthy();
        expect(screen.queryByTestId('public-claim-confirm')).toBeNull();
      } else {
        // No marker: the normal button, never an automatic claim.
        expect(screen.getByTestId('public-claim-open').textContent).toContain('Claim this page');
        expect(screen.queryByTestId('public-claim-panel')).toBeNull();
      }
    }

    // The marker leaves the address bar once a signed-in visitor's card has
    // consumed it; signed out it waits (the session may still be restoring).
    expect(addressBar()).toBe(marker && visitor === 'signed_out' ? MARKED : PAGE);
  });

  it('shows a busy state while the automatic claim runs, never "Claim this page" first', async () => {
    let resolve: (v: unknown) => void = () => {};
    rpc.mockReturnValue(new Promise((r) => { resolve = r; }));
    arrive(MARKED);
    render(tree(MARKED, cardProps({ visitor: 'matching' })));
    expect(screen.queryByTestId('public-claim-open')).toBeNull();
    expect(screen.getByTestId('public-claim-auto-busy').textContent).toContain('Claiming');
    expect(screen.queryByTestId('public-claim-panel')).toBeNull();
    await act(async () => { resolve(answer('ok')); });
    await waitFor(() => expect(screen.getByTestId('public-claim-done')).toBeTruthy());
    expect(claimCalls()).toHaveLength(1);
  });

  it('waits for the hint (and the session) to load: no premature claim, no premature fallback', async () => {
    rpc.mockResolvedValue(answer('ok'));
    arrive(MARKED);
    // The session is still restoring: signed out for a moment.
    const { rerender } = render(tree(MARKED, cardProps({ visitor: 'signed_out' })));
    // Signed in, ownership not loaded yet.
    rerender(tree(MARKED, cardProps({ visitor: 'matching', ownership: null, hint: null })));
    // Ownership loaded, the hint still in flight.
    rerender(tree(MARKED, cardProps({ visitor: 'matching', hint: null, hintLoading: true })));
    await act(async () => { await Promise.resolve(); });
    expect(claimCalls()).toEqual([]);
    expect(addressBar()).toBe(MARKED);
    expect(screen.queryByTestId('public-claim-open')).toBeNull();
    // The hint arrives: the claim runs once.
    rerender(tree(MARKED, cardProps({ visitor: 'matching' })));
    await waitFor(() => expect(screen.getByTestId('public-claim-done')).toBeTruthy());
    expect(claimCalls()).toHaveLength(1);
    expect(addressBar()).toBe(PAGE);
  });

  it('fires once: re-renders and the refetch after a claim never call it again', async () => {
    rpc.mockResolvedValue(answer('ok'));
    arrive(MARKED);
    const onChanged = vi.fn();
    const { rerender } = render(tree(MARKED, cardProps({ visitor: 'matching', onChanged })));
    await waitFor(() => expect(screen.getByTestId('public-claim-done')).toBeTruthy());
    // The page refetches: first the same answer again, then the row reads as yours.
    rerender(tree(MARKED, cardProps({ visitor: 'matching', onChanged })));
    rerender(tree(MARKED, cardProps({ visitor: 'matching', ownership: OWNER, hint: 'yours', onChanged })));
    rerender(tree(MARKED, cardProps({ visitor: 'matching', ownership: MANAGED, hint: 'managed', onChanged })));
    await act(async () => { await Promise.resolve(); });
    expect(claimCalls()).toHaveLength(1);
    expect(onChanged.mock.calls).toEqual([['claimed']]);
    expect(screen.getByTestId('public-claim-done').textContent).toContain('This is your page');
  });

  it('fires once: a refusal followed by re-renders with the same facts does not retry', async () => {
    rpc.mockResolvedValue(refusal('email_mismatch'));
    arrive(MARKED);
    const { rerender } = render(tree(MARKED, cardProps({ visitor: 'matching' })));
    await waitFor(() => expect(screen.getByTestId('public-claim-error')).toBeTruthy());
    rerender(tree(MARKED, cardProps({ visitor: 'matching' })));
    rerender(tree(MARKED, cardProps({ visitor: 'matching' })));
    await act(async () => { await Promise.resolve(); });
    expect(claimCalls()).toHaveLength(1);
    expect(screen.getByTestId('public-request-panel')).toBeTruthy();
  });

  it('unproven with the marker: the emailed link keeps the intent, and a verified code claims once', async () => {
    rpc.mockResolvedValue(answer('ok'));
    arrive(MARKED);
    render(tree(MARKED, cardProps({ visitor: 'matching_unproven' })));
    expect(screen.queryByTestId('public-claim-auto-busy')).toBeNull();
    expect(screen.queryByTestId('public-claim-open')).toBeNull();
    fireEvent.click(screen.getByTestId('email-code-send'));
    const input = await screen.findByTestId('email-code-input');
    expect(auth.signInWithOtp.mock.calls[0][0].options.emailRedirectTo).toBe(
      `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(MARKED)}`,
    );
    expect(claimCalls()).toEqual([]);
    fireEvent.change(input, { target: { value: '12345678' } });
    fireEvent.click(screen.getByTestId('email-code-verify'));
    await waitFor(() => expect(screen.getByTestId('public-claim-done')).toBeTruthy());
    expect(claimCalls()).toHaveLength(1);
  });

  it('no marker: the manual email-code step keeps the plain return path', async () => {
    render(tree(PAGE, cardProps({ visitor: 'matching_unproven' })));
    fireEvent.click(screen.getByTestId('public-claim-open'));
    fireEvent.click(screen.getByTestId('email-code-send'));
    await screen.findByTestId('email-code-input');
    expect(auth.signInWithOtp.mock.calls[0][0].options.emailRedirectTo).toBe(
      `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(PAGE)}`,
    );
  });

  it('a remount after the marker was consumed does not claim again (the router may still hold ?claim=1)', async () => {
    rpc.mockResolvedValue(refusal('email_mismatch'));
    arrive(MARKED);
    const first = render(tree(MARKED, cardProps({ visitor: 'matching' })));
    await waitFor(() => expect(screen.getByTestId('public-claim-error')).toBeTruthy());
    first.unmount();
    // Same router entry (still marked), but the address bar is clean.
    render(tree(MARKED, cardProps({ visitor: 'matching' })));
    await act(async () => { await Promise.resolve(); });
    expect(claimCalls()).toHaveLength(1);
    expect(screen.getByTestId('public-claim-open').textContent).toContain('Claim this page');
  });

  it('keeps the rest of the query byte-for-byte when it drops the marker', async () => {
    rpc.mockResolvedValue(answer('ok'));
    arrive('/organisers/ritmo?q=a%20b&claim=1#events');
    render(tree(MARKED, cardProps({ visitor: 'matching' })));
    await waitFor(() => expect(screen.getByTestId('public-claim-done')).toBeTruthy());
    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe('/organisers/ritmo?q=a%20b#events');
  });

  it('a failed hint lookup (kind request, no hint) keeps the marker, and claims once the hint arrives', async () => {
    rpc.mockResolvedValue(answer('ok'));
    arrive(MARKED);
    const { rerender } = render(tree(MARKED, cardProps({ visitor: 'matching', hint: null })));
    await act(async () => { await Promise.resolve(); });
    expect(claimCalls()).toEqual([]);
    expect(addressBar()).toBe(MARKED);
    expect(screen.queryByTestId('public-claim-error')).toBeNull();
    rerender(tree(MARKED, cardProps({ visitor: 'matching' })));
    await waitFor(() => expect(screen.getByTestId('public-claim-done')).toBeTruthy());
    expect(claimCalls()).toHaveLength(1);
    expect(addressBar()).toBe(PAGE);
  });

  it('a panel the intent opens does not take focus (no keyboard on arrival); a tap still does', async () => {
    rpc.mockResolvedValue(refusal('email_mismatch'));
    arrive(MARKED);
    render(tree(MARKED, cardProps({ visitor: 'matching' })));
    await waitFor(() => expect(screen.getByTestId('public-request-panel')).toBeTruthy());
    expect(document.activeElement).not.toBe(screen.getByTestId('public-request-note'));
    // A tap afterwards is asked for: focus moves into the panel it opens.
    fireEvent.click(screen.getByText('Cancel'));
    fireEvent.click(screen.getByTestId('public-claim-open'));
    expect(document.activeElement).toBe(screen.getByTestId('public-claim-confirm'));
    cleanup();
    arrive(MARKED);
    render(tree(MARKED, cardProps({ visitor: 'matching_unproven' })));
    await act(async () => { await Promise.resolve(); });
    expect(document.activeElement).not.toBe(screen.getByTestId('email-code-send'));
  });

  it('on the intent path, the sign-in a refused claim offers keeps the intent', async () => {
    rpc.mockResolvedValue(refusal('authentication_required'));
    arrive(MARKED);
    render(tree(MARKED, cardProps({ visitor: 'matching' })));
    await waitFor(() => expect(screen.getByTestId('public-claim-error')).toBeTruthy());
    expect(screen.getByTestId('public-claim-signin').getAttribute('href')).toBe(
      `/auth?mode=signin&returnTo=${encodeURIComponent(MARKED)}`,
    );
  });

  it('a managed organiser with the marker: no card, no claim, marker consumed', async () => {
    rpc.mockResolvedValue(answer('ok'));
    arrive(MARKED);
    const { container } = render(tree(MARKED, cardProps({ visitor: 'matching', ownership: MANAGED, hint: 'managed' })));
    await act(async () => { await Promise.resolve(); });
    expect(container.innerHTML).toBe('');
    expect(claimCalls()).toEqual([]);
    expect(addressBar()).toBe(PAGE);
  });
});
