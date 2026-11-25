import { supabase } from '@/integrations/supabase/client';
import { isAuthRequired, parseClaimResult, type ClaimOutcome } from './claimLinkModel';
import { parseAboutYouResult, type AboutYouOutcome } from './aboutYouModel';

// redeem_organiser_claim_link_v1 is live in prod but not yet in the generated Database type
// (a bot regenerates it; never hand-edited): string-named boundary, not `as never` on the name.
type UntypedRpc = {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};
const rpc = (fn: string, args?: Record<string, unknown>) => (supabase as unknown as UntypedRpc).rpc(fn, args);

export async function redeemClaimLink(token: string): Promise<ClaimOutcome> {
  try {
    const { data, error } = await rpc('redeem_organiser_claim_link_v1', { p_token: token });
    if (error) return isAuthRequired(error.message) ? { kind: 'signed_out' } : { kind: 'failed' };
    return parseClaimResult(data);
  } catch {
    return { kind: 'failed' };
  }
}

export async function saveAboutYou(args: Record<string, unknown>): Promise<AboutYouOutcome> {
  try {
    const { data, error } = await rpc('save_my_about_you_v1', args);
    if (error) return isAuthRequired(error.message) ? { kind: 'signed_out' } : { kind: 'failed' };
    return parseAboutYouResult(data);
  } catch {
    return { kind: 'failed' };
  }
}
