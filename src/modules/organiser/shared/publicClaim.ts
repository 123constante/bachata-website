// Pure, client-free: the unit spec imports it without a Supabase client.
import { buildSignInHref } from '@/lib/authRouting';
import { claimHint } from './claimHint';

/**
 * What the PUBLIC organiser page offers about ownership (Lever 2, W7; plan
 * SS5.4, mockup 06-A). Computed from the columns the page already reads
 * (`claimed_by`, `contact_email`) and the signed-in user; claim_organiser_v1
 * decides. Everything stays behind VITE_ENABLE_ORGANISER_SELF_SERVE.
 *
 *   hidden   flag off, or no organiser: nothing about claims is rendered
 *   managed  claimed (D4 keeps every claimed_by paired with an owner member):
 *            the "Managed by the organiser" badge, no card
 *   sign_in  unclaimed, signed out: "Is this you?" offers sign-in, then back
 *   claim    unclaimed, signed in, the listing's contact email is the user's
 *   request  unclaimed, signed in, a different or missing contact email: only
 *            "request access" can succeed, so that is what is offered
 */
export type PublicClaimKind = 'hidden' | 'managed' | 'sign_in' | 'claim' | 'request';

export interface PublicClaimOrganiser {
  id: string;
  name: string;
  claimedBy: string | null;
  contactEmail: string | null;
}

export interface PublicClaimUser {
  id: string;
  email?: string | null;
}

const NO_ORGANISERS: ReadonlySet<string> = new Set();

export function publicClaimKind(
  flagOn: boolean,
  organiser: PublicClaimOrganiser | null | undefined,
  user: PublicClaimUser | null | undefined,
): PublicClaimKind {
  if (!flagOn || !organiser) return 'hidden';
  if (organiser.claimedBy) return 'managed';
  if (!user) return 'sign_in';
  const hint = claimHint(
    { id: organiser.id, claimed_by: organiser.claimedBy, contact_email: organiser.contactEmail },
    user,
    NO_ORGANISERS,
  );
  return hint === 'email_matches' ? 'claim' : 'request';
}

/** Where sign-in sends the visitor back to: the public page they were on. */
export function signInHref(returnTo: string): string {
  return buildSignInHref(returnTo);
}
