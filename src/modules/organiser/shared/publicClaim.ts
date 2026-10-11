// Pure, client-free: the unit spec imports it without a Supabase client.
import { buildSignInHref } from '@/lib/authRouting';

// What the PUBLIC organiser page offers about ownership is decided in ONE place:
// ownership.ts (ownershipFacts). Nothing here may re-derive it.
export { ownershipFacts, type PublicClaimKind } from './ownership';
import type { PublicClaimKind } from './ownership';

/** Where sign-in sends the visitor back to: the public page they were on. */
export function signInHref(returnTo: string): string {
  return buildSignInHref(returnTo);
}

/**
 * The claim intent (owner decision 2026-10-11): "Sign in to claim" is ONE ask,
 * so the page it returns to carries ?claim=1 and PublicClaimCard runs the claim
 * itself once the visitor is back signed in. It rides inside returnTo, which
 * /auth, the email code and /auth/callback?returnTo=... all pass on verbatim.
 */
const CLAIM_INTENT_PARAM = 'claim';
const MARKER = `${CLAIM_INTENT_PARAM}=1`;

// String surgery, not URLSearchParams: only the marker pair is added or removed,
// so every other byte of the query (its encoding, a bare "flag") is kept as is.
const split = (url: string) => {
  const hashAt = url.indexOf('#');
  const beforeHash = hashAt < 0 ? url : url.slice(0, hashAt);
  const hash = hashAt < 0 ? '' : url.slice(hashAt);
  const queryAt = beforeHash.indexOf('?');
  const path = queryAt < 0 ? beforeHash : beforeHash.slice(0, queryAt);
  const pairs = queryAt < 0 ? [] : beforeHash.slice(queryAt + 1).split('&').filter(Boolean);
  return { path, pairs, hash };
};
const join = (path: string, pairs: string[], hash: string) => `${path}${pairs.length ? `?${pairs.join('&')}` : ''}${hash}`;

/** The same path with the claim intent (once). */
export function withClaimIntent(path: string): string {
  const { path: p, pairs, hash } = split(path);
  if (pairs.includes(MARKER)) return path;
  return join(p, [...pairs.filter((pair) => pair.split('=')[0] !== CLAIM_INTENT_PARAM), MARKER], hash);
}

/** "Sign in to claim": sign in, then back to this page with the claim intent. */
export function signInToClaimHref(returnTo: string): string {
  return buildSignInHref(withClaimIntent(returnTo));
}

/** `search` is a location's query string, e.g. "?claim=1". Read raw, exactly as the two writers above match it. */
export function hasClaimIntent(search: string): boolean {
  return split(`?${search.replace(/^\?/, '')}`).pairs.includes(MARKER);
}

/**
 * What the card does with an armed intent, decided once for both its effect and
 * its first render. It never re-derives ownership: `kind` is ownershipFacts'.
 *   none   no intent, or already spent
 *   wait   signed out (the session may still be restoring), 'hidden' (ownership or
 *          the hint still loading), or 'request' with no hint (the lookup failed:
 *          unknown, not "not yours") -- the marker stays
 *   drop   any other answer: spend the marker, show the card as it is
 *   claim  run claim() now
 *   prove  open the claim panel at the email-code step; the code runs claim()
 */
export type ClaimIntentStep = 'none' | 'wait' | 'drop' | 'claim' | 'prove';

export function claimIntentStep(input: {
  armed: boolean;
  signedIn: boolean;
  kind: PublicClaimKind;
  hintKnown: boolean;
  mailboxProven: boolean;
}): ClaimIntentStep {
  const { armed, signedIn, kind, hintKnown, mailboxProven } = input;
  if (!armed) return 'none';
  if (!signedIn || kind === 'hidden' || (kind === 'request' && !hintKnown)) return 'wait';
  if (kind !== 'claim') return 'drop';
  return mailboxProven ? 'claim' : 'prove';
}

/** The same path, query and hash with the marker gone (so a refresh or a share does not claim again). */
export function withoutClaimIntent(pathSearchHash: string): string {
  const { path, pairs, hash } = split(pathSearchHash);
  const kept = pairs.filter((pair) => pair.split('=')[0] !== CLAIM_INTENT_PARAM);
  return kept.length === pairs.length ? pathSearchHash : join(path, kept, hash);
}
