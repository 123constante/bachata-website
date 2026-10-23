// Every word the "Possible duplicates" screens show, in one place (PLAN.md section 3 copy rule:
// plain English, and every error says what the admin can do next, never a raw code).

import type { DuplicatePair, PausedJoin } from './duplicatesModel';

export const alertTitle = (n: number) => `${n} possible duplicate${n === 1 ? '' : 's'}`;

/** The one line under the alert title, and the lead on "Same person?". */
export function pairSentence(p: DuplicatePair): string {
  const team = p.organiserName ? `the ${p.organiserName} team list` : 'a team list';
  return `${p.foldName} signed up and is on ${team} next to ${p.keepName}, a profile you made.`;
}

/** A paused join (redeem not_linked) is its own row, never a pair. */
export function pausedSentence(n: PausedJoin): string {
  const next = n.pair
    ? ` It matches the pair with ${n.pair.foldName}: review it to join them.`
    : ' Nothing can be joined yet; it shows here so you know they tried.';
  return `${n.personLabel} tried to join ${n.organiserName ?? 'a page'}; the join is paused.${next}`;
}

export const DUP_COPY = {
  review: 'Review',
  none: 'No possible duplicates right now. The check runs again each time you open this page.',
  loadFailed: 'The duplicate check did not load. Check your connection, then tap Try again.',
  retry: 'Try again',
  unavailableTitle: 'Duplicate check: available soon',
  unavailable:
    'It needs the server update that adds the duplicate check, which is not applied yet. Until then nothing here can join profiles, and nothing is changed.',
  sameTitle: 'Same person?',
  keep: 'Keep',
  fold: 'Fold in',
  keepFact: 'Made by an admin. No one has signed in to it.',
  foldFact: 'Made when they signed up.',
  sameLead: (p: DuplicatePair) => `After joining, they sign in with their own email and see one profile: ${p.keepName}, with everything on it.`,
  showChanges: 'Show what will change',
  notSame: 'Not the same person',
  notSameNote: 'This hides the pair for good. Nothing else changes.',
  dismissing: 'Hiding',
  changesTitle: 'What will change',
  changesLoading: 'Asking the server what would change. Nothing is changed yet.',
  changesEmpty: 'The server listed no changes for these two, so there is nothing to join. If they are different people, tap Not the same person.',
  joinOne: 'Join into one profile',
  confirmTitle: 'Join these two into one?',
  confirmNote: 'Logged with your name and the time.',
  confirmYes: 'Yes, join them',
  joining: 'Joining',
  cancel: 'Cancel',
  back: 'Back',
  joined: (p: DuplicatePair) => `Joined. ${p.keepName} is one profile now, owned by their login.`,
  close: 'Close',
} as const;

const GENERIC = 'Something went wrong. Nothing was changed. Try again, and if it keeps happening tell Ricky.';

/** Every refusal admin_join_duplicate_people_v1 or the dismiss call can return, in plain words. */
/** Codes are A2's exactly (admin_join_duplicate_people_v1 returns or raises them; the dismiss raises the last group). */
export const JOIN_REFUSAL_COPY: Record<string, string> = {
  keep_profile_archived: 'The profile that would stay has been archived. Nothing was changed. Close this and open the page again.',
  two_real_logins:
    'Both profiles have a login that someone has used, so these could be two real people. Ask them first: this screen never joins two used logins.',
  no_signed_in_login: 'Neither profile has a login anyone has signed in with, so there is no one to give the profile to. Nothing was changed. Ask Ricky to merge them instead.',
  anonymous_login: 'The only login used here is a guest session, not a real account. Nothing was changed. Ask them to sign up with their email first.',
  keep_claimed_by_other: 'The profile that would stay already belongs to a different login. Nothing was changed. Check with Ricky before going further.',
  login_has_other_persona: 'Their login already owns a third profile. Nothing was changed. Ask Ricky to sort that one out first.',
  already_done: 'These two are already one profile. Close this and open the page again.',
  keep_profile_not_found: 'The profile that would stay no longer exists. Close this and open the page again.',
  fold_profile_not_found: 'The duplicate profile no longer exists. Close this and open the page again.',
  profile_not_found: 'One of these profiles no longer exists. Close this and open the page again.',
  invalid_argument: 'These two are the same profile, so there is nothing to join. Close this and open the page again.',
  admin_only: 'Only an admin can do this. Check you are signed in with your admin account.',
  unavailable: 'This needs the server update that is not applied yet. Nothing was changed.',
};

export const joinRefusalText = (code: string | null): string => (code && JOIN_REFUSAL_COPY[code]) || GENERIC;
