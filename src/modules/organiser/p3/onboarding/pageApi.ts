// The page screens' (1-9), Review's and Live's reads and writes. Every call is an EXISTING live RPC
// (read on prod 2026-10-29, pg_get_functiondef); no new server code:
//   read  organiser_profiles (public select) name, avatar_url, website, instagram, socials, organisation_category, city_id (+ cities.name)
//   read  get_organiser_contact_settings_v1 (fetchContactSettings) -> contact_phone (owner / manager only)
//   read  organiser_onboarding_status_v1(p_organiser_id) -> person.missing + organisers[].missing / about / lifecycle, is_admin
//   write confirm_organiser_contact_v1(p_organiser_id, p_phone) -> organiser_onboarding_progress.contact_confirmed_at
//         (+ contact_phone through organiser_profile_update_p5_v1 when the number changed; E.164 or invalid_phone)
//   write organiser_profile_update_p5_v1 {socials | organisation_category | instagram | website | avatar_url | name}
//   write create_organiser_profile_v1 / claim_organiser_v1 / request_organiser_access_v1 (build 1's selfServeApi)
//   write complete_organiser_onboarding_v1(p_organiser_id) -> organiser_profiles.lifecycle_status live | pending_review (REAL_GO_LIVE)
// NOT used: contact_email (the RPC refuses it for non-admins: contact_email_admin_only), so the prototype's
// "Use an email instead" (assumption 1) is not built.
import { supabase } from '@/integrations/supabase/client';
import { fetchContactSettings } from '../../shared/ownershipApi';
import { claimOrganiser, createOrganiserProfile, fetchMyAccessRequests, requestOrganiserAccess, searchClaimableOrganisers, type ClaimableOrganiser, type MyAccessRequest } from '../../shared/selfServeApi';
import { searchCities, type CityResult } from '../../home/onboarding/citySearch';
import { GoLiveError, goLiveOutcomeFrom, goLiveRefusalOfMessage, type GoLiveOutcome, type PageCommand } from './pageModel';

type UntypedRpc = { rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }> };
const rpc = (fn: string, args?: Record<string, unknown>) => (supabase as unknown as UntypedRpc).rpc(fn, args);

const must = async <T = unknown>(p: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T> => {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
};

export interface PageReads {
  page: (id: string) => Promise<Record<string, unknown> | null>;
  phone: (id: string) => Promise<string | null>;
  status: (id: string) => Promise<unknown>;
  findPages: (q: string) => Promise<ClaimableOrganiser[]>;
  cities: (q: string) => Promise<CityResult[]>;
  /** The person's own access requests (open ones = "Waiting for an answer"). Absent = none shown. */
  requests?: () => Promise<MyAccessRequest[]>;
}

export interface PageWrites {
  run: (cmd: PageCommand, organiserId: string) => Promise<void>;
  create: (name: string, cityId: string) => Promise<string>;
  claim: (organiserId: string) => Promise<void>;
  ask: (organiserId: string) => Promise<void>;
  rename: (organiserId: string, name: string) => Promise<void>;
}

/**
 * Go live (screen 22): complete_organiser_onboarding_v1(p_organiser_id) (admin #1119; live body read on prod
 * 2026-10-29: SECURITY DEFINER, EXECUTE to authenticated only, owner-only). `complete` RESOLVES with the outcome
 * (`live`, or `pending_review` when the page's city has an ambassador) and REJECTS with a GoLiveError naming the
 * refusal (pageModel goLiveOutcomeFrom / goLiveRefusalOfMessage). A page already live / in review resolves with its
 * lifecycle (the RPC's no-op ok). GO_LIVE_NOT_DEPLOYED is the stub tests use for `deployed: false`.
 */
export interface GoLiveApi {
  deployed: boolean;
  complete: (organiserId: string) => Promise<GoLiveOutcome>;
}

export const GO_LIVE_NOT_DEPLOYED: GoLiveApi = {
  deployed: false,
  complete: async () => {
    throw new Error('go_live_not_deployed');
  },
};

export const REAL_GO_LIVE: GoLiveApi = {
  deployed: true,
  complete: async (organiserId) => {
    let answer: { data: unknown; error: { message: string; code?: string } | null };
    try {
      answer = await rpc('complete_organiser_onboarding_v1', { p_organiser_id: organiserId });
    } catch (e) {
      throw new GoLiveError(goLiveRefusalOfMessage(e instanceof Error ? e.message : String(e)));
    }
    // The code rides with the message: an expired token is PGRST301 whatever its wording.
    if (answer.error) throw new GoLiveError(goLiveRefusalOfMessage(`${answer.error.code ?? ''} ${answer.error.message}`));
    return goLiveOutcomeFrom(answer.data);
  },
};

async function fetchPage(id: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from('organiser_profiles')
    .select('id, name, avatar_url, website, instagram, socials, organisation_category, city_id')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as Record<string, unknown>;
  let city = '';
  if (typeof row.city_id === 'string') {
    const c = await supabase.from('cities').select('name').eq('id', row.city_id).maybeSingle();
    city = (c.data as { name?: string } | null)?.name ?? '';
  }
  return { ...row, city };
}

export const REAL_PAGE_READS: PageReads = {
  page: fetchPage,
  phone: async (id) => (await fetchContactSettings(id)).contact_phone,
  status: (id) => must(rpc('organiser_onboarding_status_v1', { p_organiser_id: id })),
  findPages: searchClaimableOrganisers,
  cities: searchCities,
  requests: fetchMyAccessRequests,
};

export const REAL_PAGE_WRITES: PageWrites = {
  run: async (cmd, organiserId) => {
    if (cmd.kind === 'confirm') {
      await must(rpc('confirm_organiser_contact_v1', { p_organiser_id: organiserId, ...(cmd.phone ? { p_phone: cmd.phone } : {}) }));
      return;
    }
    await must(rpc('organiser_profile_update_p5_v1', { p_organiser_id: organiserId, p_patch: cmd.patch }));
  },
  create: async (name, cityId) => {
    const r = await createOrganiserProfile({ name, cityId, contactEmail: '', instagram: '', website: '' });
    if (!r.organiserId) throw new Error('create_failed');
    return r.organiserId;
  },
  claim: async (id) => {
    await claimOrganiser(id);
  },
  ask: async (id) => {
    await requestOrganiserAccess(id, '');
  },
  rename: async (id, name) => {
    await must(rpc('organiser_profile_update_p5_v1', { p_organiser_id: id, p_patch: { name } }));
  },
};

/** The query keys a page save makes stale (the P3 / R1 home, the status, this flow's own reads). */
export const PAGE_STALE_KEYS: readonly (readonly string[])[] = [['organiser-home'], ['p3-ob-status'], ['p3-ob-page']];
