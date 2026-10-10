// Pure, client-free: the unit spec imports it without a Supabase client.
import type { ClaimHint } from './claimHint';

/**
 * The ONE mapping from what the database says about an organiser's ownership to
 * what the public page shows (arc PR 3). organiser_ownership_v1 reads
 * entity_members only; organiser_claim_hints_v1 adds the claim evidence for a
 * signed-in visitor. Nothing else may decide the badge, the "Is this you?"
 * card, the claim button or edit access -- a second copy is how the 2026-10-09
 * bug happened (an owner row existed, the legacy claimed_by pointer was empty,
 * and the page offered a claim on a managed organiser).
 */

export type OrganiserRole = 'owner' | 'manager' | 'contributor';

/** organiser_ownership_v1's result. No user id and no email ever comes back. */
export interface OrganiserOwnership {
  is_managed: boolean;
  i_own_it: boolean;
  my_role: OrganiserRole | null;
}

/**
 * hidden   flag off, or the answer is unknown (loading, RPC error): nothing about claims
 * managed  an owner exists: the "Managed by the organiser" badge, no card
 * sign_in  unmanaged, signed out: "Is this you?" offers sign-in, then back
 * claim    unmanaged, signed in, the claim email is the user's
 * request  unmanaged, signed in, a different or missing claim email (or an unknown hint)
 * member   signed in and already on the team of an unmanaged organiser: no card
 */
export type PublicClaimKind = 'hidden' | 'managed' | 'sign_in' | 'claim' | 'request' | 'member';

export interface OwnershipInput {
  /** VITE_ENABLE_ORGANISER_SELF_SERVE. */
  flagOn: boolean;
  signedIn: boolean;
  /** null: not loaded, or the RPC failed. Never guessed. */
  ownership: OrganiserOwnership | null | undefined;
  /** null: signed out, not loaded, or the RPC failed or omitted the organiser. */
  hint: ClaimHint | null | undefined;
}

export interface OwnershipFacts {
  kind: PublicClaimKind;
  /** The badge, in the hero. */
  showBadge: boolean;
  badgeText: string | null;
  /** The "Is this you?" card. */
  showIsThisYou: boolean;
  /** What the card's one button does; 'none' when the card is not shown. */
  claimButton: 'none' | 'sign_in' | 'claim' | 'request';
  /** The pencil and the edit form: the organiser's owner or a manager. Not behind the flag. */
  canEdit: boolean;
  /** The page's owner-only empty state ("complete your profile"). */
  isOwner: boolean;
}

export const MANAGED_BADGE_TEXT = 'Managed by the organiser';

const FLAGGED_OFF: OwnershipFacts = {
  kind: 'hidden',
  showBadge: false,
  badgeText: null,
  showIsThisYou: false,
  claimButton: 'none',
  canEdit: false,
  isOwner: false,
};

export function ownershipFacts(input: OwnershipInput): OwnershipFacts {
  const { flagOn, signedIn, ownership, hint } = input;
  const canEdit = signedIn && !!ownership && (ownership.my_role === 'owner' || ownership.my_role === 'manager');
  const isOwner = signedIn && !!ownership?.i_own_it;
  const base = { ...FLAGGED_OFF, canEdit, isOwner };
  if (!flagOn || !ownership) return base;

  // 'managed' from the hint covers a legacy claimed_by pointer with no owner row.
  if (ownership.is_managed || hint === 'managed') {
    return { ...base, kind: 'managed', showBadge: true, badgeText: MANAGED_BADGE_TEXT };
  }
  if (!signedIn) return { ...base, kind: 'sign_in', showIsThisYou: true, claimButton: 'sign_in' };
  if (hint === 'yours' || ownership.my_role) return { ...base, kind: 'member' };
  if (hint === 'email_matches') return { ...base, kind: 'claim', showIsThisYou: true, claimButton: 'claim' };
  // email_differs, no_email, or no hint yet: only "request access" can be promised.
  return { ...base, kind: 'request', showIsThisYou: true, claimButton: 'request' };
}

/** Parse organiser_ownership_v1's jsonb defensively; anything off is "unknown". */
export function parseOwnership(raw: unknown): OrganiserOwnership | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.is_managed !== 'boolean' || typeof o.i_own_it !== 'boolean') return null;
  const role = o.my_role === 'owner' || o.my_role === 'manager' || o.my_role === 'contributor' ? o.my_role : null;
  return { is_managed: o.is_managed, i_own_it: o.i_own_it, my_role: role };
}
