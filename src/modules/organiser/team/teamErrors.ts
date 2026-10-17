import { OWNER_ONLY_ADD, selfServeErrorCode, teamErrorMessage } from '@/modules/organiser/shared/selfServeErrors';

/** owner_only on an add: the ONE string in selfServeErrors (shared with the /page picker, A-S4). */
export { OWNER_ONLY_ADD };
/** The request card adds by the requester's user id; a refusal there is not "ask them to sign up" (REVIEW-S6 S2). */
export const REQUEST_ADD_FAILED = 'We could not add them from here. Ask the Bachata Calendar team.';

/** A refusal of organiser_team_add_member_by_profile_v1, worded for the screen that sent it. */
export function addErrorMessage(err: unknown, from: 'request' | 'wall'): string {
  const code = selfServeErrorCode(err);
  if (code === 'owner_only') return OWNER_ONLY_ADD;
  if (from === 'request' && code === 'user_not_found') return REQUEST_ADD_FAILED;
  return teamErrorMessage(err);
}

/** A refusal of organiser_transfer_ownership_v1 (C31): the shared copy says "add them", wrong here (N1). */
export function transferErrorMessage(err: unknown, firstName: string): string {
  if (selfServeErrorCode(err) === 'unconfirmed_email') return `${firstName} has not confirmed their email address yet. Ask them to confirm it, then hand the page over.`;
  return teamErrorMessage(err);
}
