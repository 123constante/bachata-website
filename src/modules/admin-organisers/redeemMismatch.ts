// email_mismatch and email_unproven: redeem_organiser_invite_v1 refuses when the signed-in email is
// not the one the invite was made for, or is not a proven mailbox. Their copy lives in the ONE map,
// REDEEM_COPY (inviteModel.ts); this file only reads the masked hint (D36) and names the reasons.

import { REDEEM_COPY, emailMismatchCopy, interpretRedeem, type RedeemCopy, type RedeemOutcome } from './inviteModel';
import { safeEmailHint } from './invitePreview';

export { emailMismatchCopy };
export const EMAIL_MISMATCH_REASON = 'email_mismatch';
/** D56: the RIGHT email in a session that is not a proven mailbox (no hint is sent). */
export const EMAIL_UNPROVEN_REASON = 'email_unproven';
export const EMAIL_UNPROVEN_COPY: RedeemCopy = REDEEM_COPY[EMAIL_UNPROVEN_REASON];
/** The refusals whose one control is "sign out, then sign in again for this invite". */
export const SIGN_IN_AGAIN_REASONS: readonly string[] = [EMAIL_MISMATCH_REASON, EMAIL_UNPROVEN_REASON];

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
