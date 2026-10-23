// Every word the "Possible duplicates" screens show, in one place (PLAN.md section 3 copy rule:
// plain English, and every error says what the admin can do next, never a raw code).

import type { DuplicatePair } from './duplicatesModel';

export const alertTitle = (n: number) => `${n} possible duplicate${n === 1 ? '' : 's'}`;

/** The one line under the alert title, and the lead on "Same person?". */
export function pairSentence(p: DuplicatePair): string {
  const team = p.organiserName ? `the ${p.organiserName} team list` : 'a team list';
  return p.kind === 'not_linked'
    ? `${p.foldName} tried to join ${p.organiserName ?? 'a page'} with a login that is on a different profile from ${p.keepName}. Their join is paused until you sort it out.`
    : `${p.foldName} signed up and is on ${team} next to ${p.keepName}, a profile you made.`;
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
export const JOIN_REFUSAL_COPY: Record<string, string> = {
  both_signed_in:
    'Both profiles have a login that someone has used, so these could be two real people. Ask them first: this screen never joins two used logins.',
  already_joined: 'These two are already one profile. Close this and open the page again.',
  profile_not_found: 'One of these profiles no longer exists. Close this and open the page again.',
  not_admin: 'Only an admin can join profiles. Check you are signed in with your admin account.',
  authentication_required: 'Your sign-in has ended. Sign in again, then retry.',
  unavailable: 'This needs the server update that is not applied yet. Nothing was changed.',
};

export const joinRefusalText = (code: string | null): string => (code && JOIN_REFUSAL_COPY[code]) || GENERIC;
