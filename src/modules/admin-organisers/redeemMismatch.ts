// email_mismatch: redeem_organiser_invite_v1 refuses when the signed-in email is not
// the one the invite was made for. Its own file because inviteModel.ts belongs to
// organiser R1; interpretRedeem there does not know this reason and would say
// "Something went wrong", so this wraps it.

import { interpretRedeem, type RedeemCopy, type RedeemOutcome } from './inviteModel';
import { safeEmailHint } from './invitePreview';

export const EMAIL_MISMATCH_REASON = 'email_mismatch';

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
 * interpretRedeem plus email_mismatch. Only `invite_email_hint` is read (D36): a full address in
 * any field is never shown, and a hint that is not masked falls back to the generic copy.
 */
export function interpretRedeemWithMismatch(data: unknown, error: { message?: string } | null): RedeemOutcome {
  if (!error && data && typeof data === 'object' && (data as { reason?: unknown }).reason === EMAIL_MISMATCH_REASON) {
    const hint = safeEmailHint((data as { invite_email_hint?: unknown }).invite_email_hint);
    return { kind: 'refused', reason: EMAIL_MISMATCH_REASON, copy: emailMismatchCopy(hint) };
  }
  return interpretRedeem(data, error);
}
