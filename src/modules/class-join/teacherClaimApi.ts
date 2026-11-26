// Teacher claim landing page: the two database calls and their typed answers. No React.
import { rpcLoose } from '@/integrations/supabase/rpcLoose';

export type ClaimPeekStatus = 'open' | 'expired' | 'revoked' | 'linked' | 'requested' | 'invalid';
export type ClaimPeek = {
  valid: boolean;
  status: ClaimPeekStatus;
  displayName: string | null;
  eventName: string | null;
  nightDate: string | null;
};
export type ClaimRedeemStatus = 'linked' | 'requested' | 'invalid' | 'expired' | 'revoked' | 'taken';
export type ClaimRedeemed = { status: ClaimRedeemStatus; profileId: string | null };

const PEEK: ClaimPeekStatus[] = ['open', 'expired', 'revoked', 'linked', 'requested', 'invalid'];
const REDEEM: ClaimRedeemStatus[] = ['linked', 'requested', 'invalid', 'expired', 'revoked', 'taken'];

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

export async function peekTeacherClaim(token: string): Promise<ClaimPeek> {
  const { data, error } = await rpcLoose('peek_teacher_claim_link_v1', { p_token: token });
  if (error) throw new Error(error.message);
  if (!isObj(data)) throw new Error('malformed_answer');
  const s = PEEK.find((x) => x === data.status) ?? 'invalid';
  const valid = data.valid !== false;
  return {
    valid,
    status: s === 'open' && !valid ? 'invalid' : s,
    displayName: str(data.display_name),
    eventName: str(data.event_name),
    nightDate: str(data.night_date),
  };
}

/** Outcomes are RETURNED, not raised; only network / sign-in / rate problems throw. */
export async function redeemTeacherClaim(token: string): Promise<ClaimRedeemed> {
  const { data, error } = await rpcLoose('redeem_teacher_claim_link_v1', { p_token: token });
  if (error) throw new Error(error.message);
  if (!isObj(data)) throw new Error('malformed_answer');
  return {
    status: REDEEM.find((x) => x === data.status) ?? 'invalid',
    profileId: str(data.profile_id),
  };
}

export const claimReturnTo = (token: string): string => `/claim/teacher/${token}`;
export const claimAuthHref = (token: string, mode: 'signup' | 'signin'): string =>
  `/auth?mode=${mode}&returnTo=${encodeURIComponent(claimReturnTo(token))}`;
