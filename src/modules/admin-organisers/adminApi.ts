import { supabase } from '@/integrations/supabase/client';
import { parseInvites, type InviteRow, type MemberRole } from './inviteModel';

// None of the invite RPCs are in the generated Database type yet (a bot
// regenerates it; never hand-edited), so they go through a string-named
// boundary rather than an `as never` on the name, which check:rpc-typing forbids.
type UntypedRpc = {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};
const rpc = (fn: string, args?: Record<string, unknown>) => (supabase as unknown as UntypedRpc).rpc(fn, args);

export const adminCheckQueryKey = (userId: string | undefined) => ['admin-check', userId] as const;
export const adminInvitesQueryKey = (organiserId: string) => ['admin-organiser-invites', organiserId] as const;
export const adminOwnershipQueryKey = (organiserId: string) => ['admin-organiser-managed', organiserId] as const;
export const ADMIN_ORGANISERS_KEY = ['admin-organisers'] as const;

/** admin_is_admin() -> is_admin(): the one definition. Never profiles.is_admin. */
export async function fetchIsAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('admin_is_admin');
  if (error) throw error;
  return data === true;
}

export interface AdminOrganiser {
  id: string;
  name: string;
  lifecycle: string;
}

/** Every organiser an admin may see (RLS: admin reads all lifecycles). One cheap read; no personal data. */
export async function fetchAdminOrganisers(): Promise<AdminOrganiser[]> {
  const { data, error } = await supabase
    .from('organiser_profiles')
    .select('id, name, lifecycle_status')
    .order('name', { ascending: true })
    .limit(1000);
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, name: r.name ?? 'Unnamed organiser', lifecycle: r.lifecycle_status ?? 'unknown' }));
}

/** organiser_ownership_v1(...).is_managed. Only live organisers can be managed. */
export async function fetchIsManaged(organiserId: string): Promise<boolean> {
  const { data, error } = await rpc('organiser_ownership_v1', { p_organiser_id: organiserId });
  if (error) throw error;
  return (data as { is_managed?: unknown } | null)?.is_managed === true;
}

/** Per organiser, lazily: never for all of them at once. */
export async function fetchOrganiserInvites(organiserId: string): Promise<InviteRow[]> {
  const { data, error } = await rpc('admin_list_organiser_invites_v1', { p_organiser_id: organiserId });
  if (error) throw error;
  return parseInvites(data);
}

export interface IssuedInvite {
  inviteId: string;
  /** Shown once, then dropped: never stored, logged or sent anywhere. */
  token: string;
  expiresAt: string | null;
  revokedPrevious: number;
}

export async function issueOrganiserInvite(organiserId: string): Promise<IssuedInvite> {
  const { data, error } = await rpc('admin_issue_organiser_invite_v1', { p_organiser_id: organiserId });
  if (error) throw error;
  const row = (data ?? {}) as Record<string, unknown>;
  if (typeof row.token !== 'string' || typeof row.invite_id !== 'string') throw new Error('malformed_invite_answer');
  return {
    inviteId: row.invite_id,
    token: row.token,
    expiresAt: typeof row.expires_at === 'string' ? row.expires_at : null,
    revokedPrevious: Array.isArray(row.revoked_previous) ? row.revoked_previous.length : 0,
  };
}

export async function revokeOrganiserInvite(organiserId: string): Promise<number> {
  const { data, error } = await rpc('admin_revoke_organiser_invite_v1', { p_organiser_id: organiserId });
  if (error) throw error;
  const n = (data as { revoked?: unknown } | null)?.revoked;
  return typeof n === 'number' ? n : 0;
}

/** Admin "Add person": by email and role. Typed (admin_add_entity_member_v1 is in the generated types). */
export async function addOrganiserPerson(organiserId: string, email: string, role: MemberRole): Promise<void> {
  const { error } = await supabase.rpc('admin_add_entity_member_v1', {
    p_entity_type: 'organiser',
    p_entity_id: organiserId,
    p_email: email.trim(),
    p_member_role: role,
    p_is_primary: false,
  });
  if (error) throw error;
}

/** The redeem call. The token goes in the argument only; it is never logged. */
export async function redeemOrganiserInvite(token: string) {
  return rpc('redeem_organiser_invite_v1', { p_token: token });
}
