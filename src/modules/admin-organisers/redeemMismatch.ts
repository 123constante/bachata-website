// email_mismatch: redeem_organiser_invite_v1 refuses when the signed-in email is not
// the one the invite was made for. Its own file because inviteModel.ts belongs to
// organiser R1; interpretRedeem there does not know this reason and would say
// "Something went wrong", so this wraps it.

import { interpretRedeem, type RedeemCopy, type RedeemOutcome } from './inviteModel';

export const EMAIL_MISMATCH_REASON = 'email_mismatch';

export function emailMismatchCopy(inviteEmail: string | null): RedeemCopy {
  return {
    title: 'Sign in with the invited email',
    body: inviteEmail
      ? `This link was sent to ${inviteEmail}. Tap Sign out below, then sign in with that email and the link is used.`
      : 'This link was sent to a different email address. Tap Sign out below, then sign in with the email the invite was sent to and the link is used.',
    action: 'home',
    // The server refuses before using the link, so it must stay in the address bar for the way back.
    terminal: false,
  };
}

/** interpretRedeem plus email_mismatch. `inviteEmail` is the invite's email when the answer carries it. */
export function interpretRedeemWithMismatch(data: unknown, error: { message?: string } | null): RedeemOutcome {
  if (!error && data && typeof data === 'object' && (data as { reason?: unknown }).reason === EMAIL_MISMATCH_REASON) {
    const e = (data as { invite_email?: unknown; email?: unknown }).invite_email ?? (data as { email?: unknown }).email;
    return { kind: 'refused', reason: EMAIL_MISMATCH_REASON, copy: emailMismatchCopy(typeof e === 'string' && e.includes('@') ? e : null) };
  }
  return interpretRedeem(data, error);
}
