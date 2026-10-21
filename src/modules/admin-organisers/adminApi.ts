import { supabase } from '@/integrations/supabase/client';
import { parseInvites, type InviteRow, type MemberRole } from './inviteModel';
import {
  parseAccessRequests,
  parseInviteRequests,
  parseIssueResult,
  parseResolveResult,
  type AccessRequest,
  type InviteRequest,
  type IssueOutcome,
  type ResolveOutcome,
} from './senderModel';

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
export const INVITE_REQUESTS_KEY = ['admin-invite-requests'] as const;
export const ACCESS_REQUESTS_KEY = ['admin-signup-access-requests'] as const;

/** admin_is_admin() -> is_admin(): the one definition. Never profiles.is_admin.
 *  Prod RAISES admin_only (42501, HTTP 403) for a non-admin: that is the ANSWER (false), not an error (D89).
 *  Any other error still throws, so a real outage keeps its "could not check" screen. */
export async function fetchIsAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('admin_is_admin');
  if (error) {
    if ((error as { code?: string }).code === '42501') return false;
    throw error;
  }
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

export interface IssueInviteArgs {
  organiserId: string;
  /** Binds the link to this address and allow-lists it for sign-up. Empty = an unbound link. */
  email?: string;
  /** Prefill for the newcomer's dancer questions; both optional. */
  firstName?: string;
  cityId?: string;
}

/**
 * admin_issue_organiser_invite_v1 (Arc 1 as-built). The three field refusals come back as
 * {ok:false, reason} for the form to show; not_authorised and friends still raise (adminErrorMessage).
 */
export async function adminIssueOrganiserInvite({ organiserId, email, firstName, cityId }: IssueInviteArgs): Promise<IssueOutcome> {
  const { data, error } = await rpc('admin_issue_organiser_invite_v1', {
    p_organiser_id: organiserId,
    p_email: email?.trim() || null,
    p_first_name: firstName?.trim() || null,
    p_city_id: cityId || null,
  });
  if (error) throw error;
  return parseIssueResult(data);
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

/**
 * organiser_invite_preview_v1(p_token) (A-DB2, D36): anon-safe, answers a valid unredeemed token
 * with {email_hint, organiser_name}, the hint already MASKED. Not on every database yet, so the
 * caller treats any error or a missing function as "no hint".
 */
export async function previewOrganiserInvite(token: string) {
  return rpc('organiser_invite_preview_v1', { p_token: token });
}

/** admin_list_invite_requests_v1: "Request a new link" taps on broken links. Never a token or hash. */
export async function fetchInviteRequests(): Promise<InviteRequest[]> {
  const { data, error } = await rpc('admin_list_invite_requests_v1');
  if (error) throw error;
  return parseInviteRequests(data);
}

export async function resolveInviteRequest(id: string): Promise<ResolveOutcome> {
  const { data, error } = await rpc('admin_resolve_invite_request_v1', { p_id: id });
  if (error) throw error;
  return parseResolveResult(data);
}

/** admin_list_signup_access_requests_v1: "Request access" from the invite-only sign-up wall. */
export async function fetchAccessRequests(): Promise<AccessRequest[]> {
  const { data, error } = await rpc('admin_list_signup_access_requests_v1');
  if (error) throw error;
  return parseAccessRequests(data);
}

/** Approve allow-lists the email (server side); dismiss only closes the request. */
export async function resolveAccessRequest(id: string, action: 'approve' | 'dismiss'): Promise<ResolveOutcome> {
  const { data, error } = await rpc('admin_resolve_signup_access_request_v1', { p_id: id, p_action: action });
  if (error) throw error;
  return parseResolveResult(data);
}
