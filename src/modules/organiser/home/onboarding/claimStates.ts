// Pure, client-free: the ONE hint-to-words map of Arc 1 flow 6 (6a-6e). The
// search row's words and the claim screen it opens both read it, so the two
// can never say different things about the same page.
import type { ClaimHint } from '@/modules/organiser/shared/claimHint';

/** Every hint organiser_claim_hints_v1 returns (the test proves the mapping covers each). */
export const CLAIM_HINTS: readonly ClaimHint[] = ['yours', 'managed', 'email_matches', 'email_differs', 'no_email'];

export type ClaimPrimary = 'home' | 'claim' | 'request';

export interface ClaimScreen {
  /** The mockup id; 'unknown' when the hint call failed. */
  screen: '6a' | '6b' | '6c' | '6d' | '6e' | 'unknown';
  title: string;
  sub: string;
  primary: ClaimPrimary;
  primaryLabel: string;
  /** "Not this one" goes back to the search; your own page has nothing to go back from. */
  notThisOne: boolean;
}

export const NOT_THIS_ONE = 'Not this one';

/**
 * R3-5 / D63, verbatim: a page with no email on file has no claim step; the row
 * leads straight to Ask to join.
 */
export const NO_EMAIL_COPY = 'This page has no email on file yet. Ask to join and Ricky approves it, usually the same day.';

interface ClaimCopy {
  screen: ClaimScreen['screen'];
  /** The search row's words (D28: words, not sentences, except D63's line). */
  row: string;
  title: (name: string) => string;
  sub: string;
  primary: ClaimPrimary;
}

const PRIMARY_LABEL: Record<ClaimPrimary, string> = { home: 'Go to Home', claim: 'Claim it', request: 'Ask to join' };

/**
 * By the database's hint; 'unknown' = the hint call failed (or a claim was
 * refused): say nothing about the email on file. The client never reads the
 * address on file, so no line names it; claim_organiser_v1 still decides.
 */
const CLAIM_COPY: Record<ClaimHint | 'unknown', ClaimCopy> = {
  yours: { screen: '6a', row: 'Yours', title: (n) => `${n} is yours`, sub: 'You are already its owner.', primary: 'home' },
  managed: { screen: '6b', row: 'Has a team', title: (n) => `${n} already has an owner`, sub: 'You can ask to join the team.', primary: 'request' },
  email_matches: { screen: '6c', row: 'Email on file is yours', title: (n) => `Claim ${n}`, sub: 'Your email matches the one on file.', primary: 'claim' },
  // Names only that an email exists, never the address.
  email_differs: { screen: '6d', row: 'Has an email on file', title: (n) => `Is ${n} yours?`, sub: 'The email on file is not yours. Ask to join and we will check.', primary: 'request' },
  no_email: { screen: '6e', row: NO_EMAIL_COPY, title: (n) => `Is ${n} yours?`, sub: 'We have no email for this page. Ask to join and we will check.', primary: 'request' },
  unknown: { screen: 'unknown', row: 'Ask to join', title: (n) => `Is ${n} yours?`, sub: 'Ask to join and we will check.', primary: 'request' },
};

const copyFor = (hint: ClaimHint | null) => CLAIM_COPY[hint ?? 'unknown'];

/** What a search result row says about the organiser. */
export const hintRowText = (hint: ClaimHint | null) => copyFor(hint).row;

/** The one thing a page's row and screen lead to: claim only when it can succeed; Home for your own. */
export const claimPrimary = (hint: ClaimHint | null) => copyFor(hint).primary;

/** What the sheet says for one page. */
export function claimScreen(hint: ClaimHint | null, name: string): ClaimScreen {
  const c = copyFor(hint);
  return { screen: c.screen, title: c.title(name), sub: c.sub, primary: c.primary, primaryLabel: PRIMARY_LABEL[c.primary], notThisOne: c.primary !== 'home' };
}
