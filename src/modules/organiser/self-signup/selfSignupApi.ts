import { supabase } from '@/integrations/supabase/client';
import { firstEventPayload, parseNameMatches, parseOnboardResult, type FirstEventInput, type NameMatch, type OnboardResult } from './selfSignupModel';

// These RPCs are not in the generated Database type (never hand-edited): string-named boundary.
type UntypedRpc = {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};
const rpc = (fn: string, args?: Record<string, unknown>) => (supabase as unknown as UntypedRpc).rpc(fn, args);

/** Fail closed: only an explicit flag_on === true opens the page. */
export const parseFlagOn = (raw: unknown): boolean =>
  !!raw && typeof raw === 'object' && (raw as Record<string, unknown>).flag_on === true;

export async function fetchFlagOn(): Promise<boolean> {
  try {
    const { data, error } = await rpc('organiser_onboarding_v2_state_v1');
    return error ? false : parseFlagOn(data);
  } catch {
    return false;
  }
}

export async function fetchNameMatches(name: string, cityId: string): Promise<NameMatch[]> {
  try {
    const { data, error } = await rpc('organiser_name_matches_v1', { p_name: name.trim(), p_city: cityId });
    return error ? [] : parseNameMatches(data);
  } catch {
    return [];
  }
}

export async function onboardOrganiser(
  name: string, cityId: string, claimOrganiserId: string | null, firstEvent: FirstEventInput | null = null,
): Promise<OnboardResult> {
  try {
    const { data, error } = await rpc('organiser_onboard_v1', {
      p_name: name.trim(), p_city: cityId, p_first_event: firstEventPayload(firstEvent), p_claim_organiser_id: claimOrganiserId,
    });
    if (error) return /not_authenticated|jwt/i.test(error.message) ? { kind: 'signed_out' } : { kind: 'failed' };
    return parseOnboardResult(data);
  } catch {
    return { kind: 'failed' };
  }
}
