import { supabase } from '@/integrations/supabase/client';
import { parseOwnership, type OrganiserOwnership } from './ownership';

// Arc PR 3: the Website reads organiser ownership and contact through RPCs only.
// organiser_profiles.claimed_by / contact_email / contact_phone are never selected.

// The four RPCs below are live in prod but not yet in the generated Database type
// (a bot regenerates src/integrations/supabase/types.ts; it is never hand-edited).
// Until it does, they go through this one narrow, string-named boundary -- NOT an
// `as never` on the name, which check:rpc-typing forbids. When the types land,
// delete UntypedRpc and call supabase.rpc directly; the return parsers stay.
interface UntypedRpc {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;
}
const callRpc = (fn: string, args: Record<string, unknown>) => (supabase as unknown as UntypedRpc).rpc(fn, args);

export const organiserOwnershipQueryKey = (organiserId: string | undefined, userId: string | undefined) =>
  ['organiser-ownership', organiserId, userId ?? null] as const;
export const organiserPublicContactQueryKey = (organiserId: string | undefined) =>
  ['organiser-public-contact', organiserId] as const;
export const organiserContactSettingsQueryKey = (organiserId: string | undefined, userId: string | undefined) =>
  ['organiser-contact-settings', organiserId, userId ?? null] as const;
export const currentUserOrganiserIdsQueryKey = (userId: string | undefined) =>
  ['current-user-organiser-ids', userId ?? null] as const;

/** Unknown or non-live organiser -> {false,false,null}. An RPC error -> null (unknown), never a guess. */
export async function fetchOrganiserOwnership(organiserId: string): Promise<OrganiserOwnership | null> {
  const { data, error } = await callRpc('organiser_ownership_v1', { p_organiser_id: organiserId });
  if (error) return null;
  return parseOwnership(data);
}

export interface PublicContact {
  contact_email: string | null;
  contact_phone: string | null;
}

export const NO_PUBLIC_CONTACT: PublicContact = { contact_email: null, contact_phone: null };

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);

/** Both null unless the organiser is live AND show_contact_publicly. An error degrades to "no contact shown". */
export async function fetchPublicContact(organiserId: string): Promise<PublicContact> {
  const { data, error } = await callRpc('get_organiser_public_contact_v1', { p_organiser_id: organiserId });
  if (error || !data || typeof data !== 'object') return NO_PUBLIC_CONTACT;
  const row = data as Record<string, unknown>;
  return { contact_email: str(row.contact_email), contact_phone: str(row.contact_phone) };
}

export interface ContactSettings extends PublicContact {
  show_contact_publicly: boolean;
  claim_email: string | null;
}

/** Owner, manager or admin only; anyone else gets permission_denied (thrown). */
export async function fetchContactSettings(organiserId: string): Promise<ContactSettings> {
  const { data, error } = await callRpc('get_organiser_contact_settings_v1', { p_organiser_id: organiserId });
  if (error) throw error;
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    contact_email: str(row.contact_email),
    contact_phone: str(row.contact_phone),
    show_contact_publicly: row.show_contact_publicly === true,
    claim_email: str(row.claim_email),
  };
}

/** The organiser ids the caller is a member of (entity_members). */
export async function fetchCurrentUserOrganiserIds(): Promise<string[]> {
  const { data, error } = await supabase.rpc('get_current_user_organiser_ids');
  if (error) throw error;
  return Array.isArray(data) ? data.filter((x): x is string => typeof x === 'string') : [];
}
