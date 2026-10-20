// email_mismatch: redeem_organiser_invite_v1 refuses when the signed-in email is not
// the one the invite was made for. Its own file because inviteModel.ts belongs to
// organiser R1; interpretRedeem there does not know this reason and would say
// "Something went wrong", so this wraps it.

import { interpretRedeem, type RedeemCopy, type RedeemOutcome } from './inviteModel';
import { safeEmailHint } from './invitePreview';

export const EMAIL_MISMATCH_REASON = 'email_mismatch';
/**
 * D56: the RIGHT email in a session that is not a proven mailbox (the server checks it
 * before email_mismatch and sends no hint). The way out is the same as a mismatch:
 * sign out, then this invite's email-link sign-in, the link still unused.
 */
export const EMAIL_UNPROVEN_REASON = 'email_unproven';
export const EMAIL_UNPROVEN_COPY: RedeemCopy = {
  title: 'Use the email link',
  body: 'Sign in with the email link to accept this invite.',
  action: 'home',
  terminal: false,
};
/** The refusals whose one control is "sign out, then sign in again for this invite". */
export const SIGN_IN_AGAIN_REASONS: readonly string[] = [EMAIL_MISMATCH_REASON, EMAIL_UNPROVEN_REASON];

/** `emailHint` is the MASKED invite address (D36), never the full one. */
export function emailMismatchCopy(emailHint: string | null): RedeemCopy {
  return {
    title: 'Sign in with the invited email',
    body: emailHint
      ? `This link was sent to ${emailHint}. Tap Sign out below, then sign in with that email and the link is used.`
      : 'This link was sent to a different email address. Tap Sign out below, then sign in with the email the invite was sent to and the link is used.',
    action: 'home',
    // The server refuses before using the link, so it must stay in the address bar for the way back.
    terminal: false,
  };
}

/**
 * interpretRedeem plus email_unproven and email_mismatch. Only `invite_email_hint` is read (D36): a full address in
 * any field is never shown, and a hint that is not masked falls back to the generic copy.
 */
export function interpretRedeemWithMismatch(data: unknown, error: { message?: string } | null): RedeemOutcome {
  if (!error && data && typeof data === 'object' && (data as { reason?: unknown }).reason === EMAIL_UNPROVEN_REASON) {
    return { kind: 'refused', reason: EMAIL_UNPROVEN_REASON, copy: EMAIL_UNPROVEN_COPY };
  }
  if (!error && data && typeof data === 'object' && (data as { reason?: unknown }).reason === EMAIL_MISMATCH_REASON) {
    const hint = safeEmailHint((data as { invite_email_hint?: unknown }).invite_email_hint);
    return { kind: 'refused', reason: EMAIL_MISMATCH_REASON, copy: emailMismatchCopy(hint) };
  }
  return interpretRedeem(data, error);
}
