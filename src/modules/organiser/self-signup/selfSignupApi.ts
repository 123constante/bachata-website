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
  social: string | null = null,
): Promise<OnboardResult> {
  try {
    const { data, error } = await rpc('organiser_onboard_v1', {
      p_name: name.trim(), p_city: cityId, p_first_event: firstEventPayload(firstEvent), p_claim_organiser_id: claimOrganiserId,
      p_social: social?.trim() ? social.trim() : null,
    });
    if (error) return /not_authenticated|jwt/i.test(error.message) ? { kind: 'signed_out' } : { kind: 'failed' };
    return parseOnboardResult(data);
  } catch {
    return { kind: 'failed' };
  }
}

export type SocialPreview = { kind: 'instagram' | 'website' | 'unknown'; value: string };

/** Preview only: what the server understood. A failed call returns null (no line, never blocks). */
export async function normaliseSocial(text: string): Promise<SocialPreview | null> {
  try {
    const { data, error } = await rpc('organiser_normalise_social_v1', { p_input: text });
    if (error || !data || typeof data !== 'object') return null;
    const d = data as Record<string, unknown>;
    if (d.kind === 'instagram' && typeof d.instagram === 'string' && d.instagram) return { kind: 'instagram', value: d.instagram.replace(/^@/, '') };
    if (d.kind === 'website' && typeof d.website === 'string' && d.website) return { kind: 'website', value: d.website };
    if (d.kind === 'unknown') return { kind: 'unknown', value: '' };
    return null;
  } catch {
    return null;
  }
}
