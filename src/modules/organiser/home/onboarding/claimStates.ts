// Pure, client-free: the claim screens of Arc 1 flow 6 (6a-6e) as ONE mapping.
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
 * What the sheet says for one page, by the database's hint. The client never
 * reads the address on file, so no line names it; claim_organiser_v1 still
 * decides. 6a says "on its team", not the mockup's "its owner": the hint
 * 'yours' is any seat on the team (organiser_claim_hints_v1), not only the owner.
 */
export function claimScreen(hint: ClaimHint | null, name: string): ClaimScreen {
  const ask = { primary: 'request' as const, primaryLabel: 'Ask to join', notThisOne: true };
  switch (hint) {
    case 'yours':
      return { screen: '6a', title: `${name} is yours`, sub: 'You are already on its team.', primary: 'home', primaryLabel: 'Go to Home', notThisOne: false };
    case 'managed':
      return { screen: '6b', title: `${name} already has an owner`, sub: 'You can ask to join the team.', ...ask };
    case 'email_matches':
      return { screen: '6c', title: `Claim ${name}`, sub: 'Your email matches the one on file.', primary: 'claim', primaryLabel: 'Claim it', notThisOne: true };
    case 'email_differs':
      return { screen: '6d', title: `Is ${name} yours?`, sub: 'The email on file is not yours. Ask to join and we will check.', ...ask };
    case 'no_email':
      return { screen: '6e', title: `Is ${name} yours?`, sub: 'We have no email for this page. Ask to join and we will check.', ...ask };
    default:
      // The hint call failed (or a claim was refused): say nothing about the email on file.
      return { screen: 'unknown', title: `Is ${name} yours?`, sub: 'Ask to join and we will check.', ...ask };
  }
}
