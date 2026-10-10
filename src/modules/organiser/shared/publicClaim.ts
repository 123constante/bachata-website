// Pure, client-free: the unit spec imports it without a Supabase client.
import { buildSignInHref } from '@/lib/authRouting';

// What the PUBLIC organiser page offers about ownership is decided in ONE place:
// ownership.ts (ownershipFacts). Nothing here may re-derive it.
export { ownershipFacts, type PublicClaimKind } from './ownership';

/** Where sign-in sends the visitor back to: the public page they were on. */
export function signInHref(returnTo: string): string {
  return buildSignInHref(returnTo);
}
