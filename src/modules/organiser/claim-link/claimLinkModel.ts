// Pure model for the organiser claim-link landing (/claim/:token). ONE mapping from the
// redeem_organiser_claim_link_v1 answer to a screen; the server owns every rule.

export const CLAIM_TOKEN_RE = /^[0-9a-f]{64}$/;

export type ClaimRefusal =
  | 'feature_off' | 'email_unproven' | 'rate_limited' | 'invalid' | 'used' | 'revoked' | 'expired' | 'already_owned';

const REFUSALS: readonly string[] = ['feature_off', 'email_unproven', 'rate_limited', 'invalid', 'used', 'revoked', 'expired', 'already_owned'];

export type ClaimOutcome =
  | { kind: 'success'; organiserId: string | null; aboutYouNeeded: boolean }
  | { kind: 'refused'; reason: ClaimRefusal }
  | { kind: 'signed_out' }
  | { kind: 'failed' };

/** Parse the RPC jsonb. Anything unrecognised is `failed` (a retry screen), never a guess at success. */
export function parseClaimResult(raw: unknown): ClaimOutcome {
  if (!raw || typeof raw !== 'object') return { kind: 'failed' };
  const r = raw as Record<string, unknown>;
  if (r.ok === true && (r.status === 'redeemed' || r.status === 'already_member')) {
    return {
      kind: 'success',
      organiserId: typeof r.organiser_id === 'string' ? r.organiser_id : null,
      aboutYouNeeded: r.status === 'redeemed' && r.about_you_needed === true,
    };
  }
  if (r.ok === false && typeof r.reason === 'string' && REFUSALS.includes(r.reason)) {
    return { kind: 'refused', reason: r.reason as ClaimRefusal };
  }
  return { kind: 'failed' };
}

/** The RPC raises this message when the session is gone. */
export const isAuthRequired = (message: string | undefined) => Boolean(message && message.includes('authentication_required'));

export interface RefusalScreen { heading: string; body: string; action: 'code' | 'none' | 'not_found' }

export const REFUSAL_SCREENS: Record<ClaimRefusal, RefusalScreen> = {
  email_unproven: { heading: 'One more step', body: 'We need to check this email is yours. We will send you a code.', action: 'code' },
  already_owned: { heading: 'Someone already looks after this page', body: 'If that is not right, email hello@bachatacalendar.com and we will sort it out.', action: 'none' },
  used: { heading: 'This link has been used or has run out', body: 'This link has been used or has run out. Ask for a new one.', action: 'none' },
  revoked: { heading: 'This link has been used or has run out', body: 'This link has been used or has run out. Ask for a new one.', action: 'none' },
  expired: { heading: 'This link has been used or has run out', body: 'This link has been used or has run out. Ask for a new one.', action: 'none' },
  rate_limited: { heading: 'Too many tries', body: 'Too many tries. Wait a little and try again.', action: 'none' },
  invalid: { heading: 'This link isn\u2019t right', body: 'This link isn\u2019t right. Check you copied all of it.', action: 'none' },
  feature_off: { heading: '', body: '', action: 'not_found' },
};
