// @vitest-environment jsdom
/**
 * Arc PR 3 (P2.3): ONE ownership mapping, pinned over every shape the database
 * can hand the public organiser page. Each row is (signed in?, organiser_ownership_v1,
 * organiser_claim_hints_v1) -> the facts every screen reads: the hero badge, the
 * "Is this you?" card, the claim button, edit access, the owner-only empty state.
 *
 * Three guarantees beyond the table:
 *  - the same fact reads the same on every screen (page badge text, card, onboarding row);
 *  - no text points at a control that is not on screen;
 *  - the 2026-10-09 shape (an owner entity_members row, an EMPTY legacy claimed_by
 *    pointer) reads as managed. Run against the pre-PR publicClaimKind it fails:
 *    that code read `claimed_by` and answered 'request'/'sign_in'.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: vi.fn(), auth: { signInWithOtp: vi.fn(), verifyOtp: vi.fn() } },
}));

import { ManagedBadge, PublicClaimCard } from '../components/PublicClaimCard';
import { MANAGED_BADGE_TEXT, ownershipFacts, parseOwnership, type OrganiserOwnership } from '../ownership';
import type { ClaimHint } from '../claimHint';
import { rowAction } from '../../home/onboarding/onboardingModel';

const O = (is_managed: boolean, i_own_it: boolean, my_role: OrganiserOwnership['my_role']): OrganiserOwnership => ({ is_managed, i_own_it, my_role });
const ME = { id: 'me', email: 'me@x.example' };

interface Shape {
  name: string;
  signedIn: boolean;
  ownership: OrganiserOwnership | null;
  hint: ClaimHint | null;
  expect: {
    kind: ReturnType<typeof ownershipFacts>['kind'];
    badge: boolean;
    card: boolean;
    button: 'none' | 'sign_in' | 'claim' | 'request';
    canEdit: boolean;
    isOwner: boolean;
  };
}

const SHAPES: Shape[] = [
  { name: 'signed out, unclaimed', signedIn: false, ownership: O(false, false, null), hint: null,
    expect: { kind: 'sign_in', badge: false, card: true, button: 'sign_in', canEdit: false, isOwner: false } },
  { name: 'signed out, managed', signedIn: false, ownership: O(true, false, null), hint: null,
    expect: { kind: 'managed', badge: true, card: false, button: 'none', canEdit: false, isOwner: false } },
  { name: 'signed in, no relation, different email', signedIn: true, ownership: O(false, false, null), hint: 'email_differs',
    expect: { kind: 'request', badge: false, card: true, button: 'request', canEdit: false, isOwner: false } },
  { name: 'owner', signedIn: true, ownership: O(true, true, 'owner'), hint: 'yours',
    expect: { kind: 'managed', badge: true, card: false, button: 'none', canEdit: true, isOwner: true } },
  { name: 'manager', signedIn: true, ownership: O(true, false, 'manager'), hint: 'yours',
    expect: { kind: 'managed', badge: true, card: false, button: 'none', canEdit: true, isOwner: false } },
  { name: 'contributor', signedIn: true, ownership: O(true, false, 'contributor'), hint: 'yours',
    expect: { kind: 'managed', badge: true, card: false, button: 'none', canEdit: false, isOwner: false } },
  { name: 'managed by someone else', signedIn: true, ownership: O(true, false, null), hint: 'managed',
    expect: { kind: 'managed', badge: true, card: false, button: 'none', canEdit: false, isOwner: false } },
  { name: 'unclaimed, claim email matches', signedIn: true, ownership: O(false, false, null), hint: 'email_matches',
    expect: { kind: 'claim', badge: false, card: true, button: 'claim', canEdit: false, isOwner: false } },
  { name: 'unclaimed, claim email differs', signedIn: true, ownership: O(false, false, null), hint: 'email_differs',
    expect: { kind: 'request', badge: false, card: true, button: 'request', canEdit: false, isOwner: false } },
  { name: 'unclaimed, no claim email', signedIn: true, ownership: O(false, false, null), hint: 'no_email',
    expect: { kind: 'request', badge: false, card: true, button: 'request', canEdit: false, isOwner: false } },
  { name: 'signed in, hint call failed (unknown hint)', signedIn: true, ownership: O(false, false, null), hint: null,
    expect: { kind: 'request', badge: false, card: true, button: 'request', canEdit: false, isOwner: false } },
  { name: 'non-live or unknown organiser, signed out ({false,false,null})', signedIn: false, ownership: O(false, false, null), hint: null,
    expect: { kind: 'sign_in', badge: false, card: true, button: 'sign_in', canEdit: false, isOwner: false } },
  { name: 'non-live or unknown organiser, signed in (hint omitted)', signedIn: true, ownership: O(false, false, null), hint: null,
    expect: { kind: 'request', badge: false, card: true, button: 'request', canEdit: false, isOwner: false } },
  { name: 'ownership RPC error (unknown), signed out', signedIn: false, ownership: null, hint: null,
    expect: { kind: 'hidden', badge: false, card: false, button: 'none', canEdit: false, isOwner: false } },
  { name: 'ownership RPC error (unknown), signed in', signedIn: true, ownership: null, hint: 'email_matches',
    expect: { kind: 'hidden', badge: false, card: false, button: 'none', canEdit: false, isOwner: false } },
  { name: '2026-10-09: owner row exists, claimed_by pointer EMPTY, signed out', signedIn: false, ownership: O(true, false, null), hint: null,
    expect: { kind: 'managed', badge: true, card: false, button: 'none', canEdit: false, isOwner: false } },
  { name: '2026-10-09: owner row exists, claimed_by pointer EMPTY, the owner', signedIn: true, ownership: O(true, true, 'owner'), hint: 'yours',
    expect: { kind: 'managed', badge: true, card: false, button: 'none', canEdit: true, isOwner: true } },
  { name: 'legacy pointer only (no owner row), someone else', signedIn: true, ownership: O(false, false, null), hint: 'managed',
    expect: { kind: 'managed', badge: true, card: false, button: 'none', canEdit: false, isOwner: false } },
  { name: 'manager on an organiser with no owner', signedIn: true, ownership: O(false, false, 'manager'), hint: 'yours',
    expect: { kind: 'member', badge: false, card: false, button: 'none', canEdit: true, isOwner: false } },
];

const facts = (s: Shape, flagOn = true) =>
  ownershipFacts({ flagOn, signedIn: s.signedIn, ownership: s.ownership, hint: s.hint });

afterEach(cleanup);

describe('ownershipFacts over every shape', () => {
  it.each(SHAPES)('$name', (shape) => {
    const f = facts(shape);
    expect({
      kind: f.kind, badge: f.showBadge, card: f.showIsThisYou, button: f.claimButton, canEdit: f.canEdit, isOwner: f.isOwner,
    }).toEqual(shape.expect);
    expect(f.badgeText).toBe(shape.expect.badge ? MANAGED_BADGE_TEXT : null);
  });

  it('flag off: no badge, no card, no claim button, whatever the shape; editing is not behind the flag', () => {
    for (const shape of SHAPES) {
      const f = facts(shape, false);
      expect([f.kind, f.showBadge, f.showIsThisYou, f.claimButton]).toEqual(['hidden', false, false, 'none']);
      expect(f.canEdit).toBe(shape.expect.canEdit);
    }
  });

  it('never offers a claim or a request on a managed organiser, and never both a badge and a card', () => {
    for (const shape of SHAPES) {
      const f = facts(shape);
      if (f.showBadge) expect([f.showIsThisYou, f.claimButton]).toEqual([false, 'none']);
      if (!f.showIsThisYou) expect(f.claimButton).toBe('none');
      expect(f.showIsThisYou).toBe(f.claimButton !== 'none');
    }
  });
});

describe('the same fact reads the same on every screen', () => {
  it.each(SHAPES)('$name: card, badge and onboarding row agree', (shape) => {
    const f = facts(shape);
    const user = shape.signedIn ? ME : null;
    const { container } = render(
      <MemoryRouter>
        <PublicClaimCard facts={f} hint={shape.hint} organiser={{ id: 'o1', name: 'Ritmo' }} user={user} mailboxProven returnTo="/organisers/ritmo" onChanged={vi.fn()} />
        {f.showBadge && <ManagedBadge size="sm" />}
        {f.showBadge && <ManagedBadge size="md" />}
      </MemoryRouter>,
    );

    // The card is on screen iff the facts say so, and its one button is the one the facts name.
    expect(!!screen.queryByTestId('public-claim-card')).toBe(f.showIsThisYou);
    expect(!!screen.queryByTestId('public-claim-signin')).toBe(f.claimButton === 'sign_in');
    const open = screen.queryByTestId('public-claim-open');
    expect(!!open).toBe(f.claimButton === 'claim' || f.claimButton === 'request');
    if (open) expect(open.textContent).toBe(f.claimButton === 'claim' ? 'Claim this page' : 'Ask to join');

    // No text points at a control that is not on screen.
    const text = container.textContent ?? '';
    if (!f.showIsThisYou) expect(text).not.toMatch(/Is this you|claim this page|Sign in to claim|Ask to join/i);
    if (f.claimButton !== 'sign_in') expect(text).not.toContain('Sign in to claim');
    if (f.claimButton !== 'claim') expect(text).not.toContain('Claim this page');

    // Both hero badges read the one shared text, and only when the facts say managed.
    const badges = screen.queryAllByTestId('managed-badge');
    expect(badges.length).toBe(f.showBadge ? 2 : 0);
    for (const b of badges) expect(b.textContent).toContain(MANAGED_BADGE_TEXT);

    // The onboarding list offers Claim only for the shapes where the page offers Claim.
    if (shape.signedIn && shape.hint && shape.ownership) {
      expect(rowAction(shape.hint, false) === 'claim').toBe(f.claimButton === 'claim');
    }
  });

  it('request panel wording follows the database hint and never claims a fact it does not have', () => {
    const wording = (hint: ClaimHint | null) => {
      const s: Shape = { ...SHAPES[2], hint };
      const f = facts(s);
      render(
        <MemoryRouter>
          <PublicClaimCard facts={f} hint={hint} organiser={{ id: 'o1', name: 'Ritmo' }} user={ME} mailboxProven returnTo="/x" onChanged={vi.fn()} />
        </MemoryRouter>,
      );
      fireEvent.click(screen.getByTestId('public-claim-open'));
      const t = screen.getByTestId('public-request-panel').textContent ?? '';
      cleanup();
      return t;
    };
    expect(wording('email_differs')).toContain('different contact email');
    expect(wording('no_email')).toContain('no contact email');
    const unknown = wording(null);
    expect(unknown).not.toContain('different contact email');
    expect(unknown).not.toContain('no contact email');
  });
});

describe('parseOwnership (organiser_ownership_v1)', () => {
  it('reads the three fields and nothing else', () => {
    expect(parseOwnership({ is_managed: true, i_own_it: false, my_role: 'manager', user_id: 'leak' })).toEqual(O(true, false, 'manager'));
    expect(parseOwnership({ is_managed: false, i_own_it: false, my_role: null })).toEqual(O(false, false, null));
  });
  it('treats an unknown role as none and a malformed answer as unknown', () => {
    expect(parseOwnership({ is_managed: true, i_own_it: false, my_role: 'admin' })?.my_role).toBeNull();
    expect(parseOwnership(null)).toBeNull();
    expect(parseOwnership({ is_managed: 'yes' })).toBeNull();
    expect(parseOwnership([])).toBeNull();
  });
});
