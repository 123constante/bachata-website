// @vitest-environment jsdom
/**
 * I5: the request panel on an ownerless page names what the person is doing,
 * and Send needs a note of 3+ trimmed characters (with a visible reason).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: vi.fn(), auth: { signInWithOtp: vi.fn(), verifyOtp: vi.fn() } },
}));

import { OWNERLESS_REQUEST_HEADING, PublicClaimCard } from '../components/PublicClaimCard';
import { ownershipFacts, type OrganiserOwnership } from '../ownership';
import type { ClaimHint } from '../claimHint';

const ORG = { id: 'o1', name: 'Ritmo' };
const UNMANAGED: OrganiserOwnership = { is_managed: false, i_own_it: false, my_role: null, seat_kind: null };
const MANAGED: OrganiserOwnership = { is_managed: true, i_own_it: false, my_role: null, seat_kind: null };
const ME = { id: 'me', email: 'a@b.example' };
afterEach(cleanup);

function mount(opts: { signedIn: boolean; ownership: OrganiserOwnership; hint: ClaimHint | null }) {
  const user = opts.signedIn ? ME : null;
  const facts = ownershipFacts({ flagOn: true, signedIn: !!user, ownership: opts.ownership, hint: user ? opts.hint : null });
  render(
    <MemoryRouter>
      <PublicClaimCard facts={facts} hint={user ? opts.hint : null} organiser={ORG} user={user} mailboxProven returnTo="/x" onChanged={vi.fn()} />
    </MemoryRouter>,
  );
  return facts;
}

const KINDS = [
  { name: 'sign_in', signedIn: false, ownership: UNMANAGED, hint: null },
  { name: 'claim', signedIn: true, ownership: UNMANAGED, hint: 'email_matches' as ClaimHint },
  { name: 'request', signedIn: true, ownership: UNMANAGED, hint: 'email_differs' as ClaimHint },
  { name: 'managed', signedIn: true, ownership: MANAGED, hint: 'managed' as ClaimHint },
];
const NOTES = [
  { v: '', ok: false },
  { v: '   ', ok: false },
  { v: ' ab ', ok: false },
  { v: 'Ana', ok: true },
  { v: '  I run Tuesdays  ', ok: true },
];
const HINTS: (ClaimHint | null)[] = ['email_differs', 'no_email', null];

describe('ownerless request copy', () => {
  for (const k of KINDS) {
    it(`${k.name}: heading never shows outside the request panel`, () => {
      mount(k);
      expect(screen.queryByText(OWNERLESS_REQUEST_HEADING)).toBeNull();
      expect(screen.queryByTestId('public-request-note-required')).toBeNull();
    });
  }

  it('claim kind: opening the card shows the claim panel, not the request heading', () => {
    mount(KINDS[1]);
    fireEvent.click(screen.getByTestId('public-claim-open'));
    expect(screen.queryByText(OWNERLESS_REQUEST_HEADING)).toBeNull();
    expect(screen.getByTestId('public-claim-confirm')).toBeTruthy();
  });

  for (const hint of HINTS) {
    for (const n of NOTES) {
      it(`request, hint ${hint}, note ${JSON.stringify(n.v)}: ${n.ok ? 'enabled' : 'disabled with reason'}`, () => {
        mount({ signedIn: true, ownership: UNMANAGED, hint });
        fireEvent.click(screen.getByTestId('public-claim-open'));
        expect(screen.getByTestId('public-request-heading').textContent).toBe(OWNERLESS_REQUEST_HEADING);
        expect(screen.getByTestId('public-request-next').textContent).toMatch(/manager/);
        expect(screen.getByTestId('public-request-panel').textContent).not.toMatch(/optional/i);
        fireEvent.change(screen.getByTestId('public-request-note'), { target: { value: n.v } });
        const send = screen.getByTestId('public-request-send') as HTMLButtonElement;
        expect(send.disabled).toBe(!n.ok);
        const reason = screen.queryByTestId('public-request-note-required');
        if (n.ok) expect(reason).toBeNull();
        else expect(reason?.textContent).toMatch(/at least 3/);
      });
    }
  }
});
