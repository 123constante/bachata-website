import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { parseInvitations, parseOrganisers, type Invitation, type OrganiserRow } from './organiserModel';

/**
 * Client for the pinned co-organiser RPCs (ER-INTERFACE section 4, AS BUILT). Server NOT landed:
 * a missing function reads as `unavailable` and the screen says so.
 */
type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>;
const defaultRpc: Rpc = (fn, args) => (supabase.rpc as unknown as Rpc)(fn, args);

export type OrganiserFailure = 'unavailable' | 'rate_limited' | 'refused' | 'conflict' | 'failed';

export class OrganiserApiError extends Error {
  constructor(readonly kind: OrganiserFailure, readonly detail = '') {
    super(detail || kind);
  }
}

/** What the person reads when a call fails. */
export const FAILURE_TEXT: Record<OrganiserFailure, string> = {
  unavailable: 'Organisers are not available yet. Try again later.',
  rate_limited: 'You have sent a lot of invites today. Try again tomorrow.',
  refused: 'That was not allowed. Reload and try again.',
  conflict: 'Someone else changed this event',
  failed: 'That did not save. Try again.',
};

function toError(e: { code?: string; message?: string }): OrganiserApiError {
  const text = `${e.code ?? ''} ${e.message ?? ''}`.toLowerCase();
  if (e.code === 'PGRST202' || text.includes('could not find the function')) return new OrganiserApiError('unavailable');
  if (text.includes('version_conflict')) return new OrganiserApiError('conflict');
  if (text.includes('rate')) return new OrganiserApiError('rate_limited');
  if (text.includes('permission_denied') || text.includes('already') || text.includes('refused')) return new OrganiserApiError('refused', e.message ?? '');
  return new OrganiserApiError('failed');
}

async function call(fn: string, args: Record<string, unknown>, rpc: Rpc): Promise<unknown> {
  const { data, error } = await rpc(fn, args);
  if (error) throw toError(error);
  return data;
}

export const fetchOrganisers = async (seriesId: string, rpc: Rpc = defaultRpc): Promise<OrganiserRow[]> =>
  parseOrganisers(await call('series_organisers_v1', { p_series_id: seriesId }, rpc));

export const fetchMyInvitations = async (rpc: Rpc = defaultRpc): Promise<Invitation[]> =>
  parseInvitations(await call('my_organiser_invites_v1', {}, rpc));

export async function inviteOrganiser(seriesId: string, pageId: string, rpc: Rpc = defaultRpc): Promise<string | null> {
  const d = (await call('series_invite_organiser_v1', { p_series_id: seriesId, p_page_id: pageId }, rpc)) as { invite_id?: unknown } | null;
  return typeof d?.invite_id === 'string' ? d.invite_id : null;
}
export const cancelInvite = async (inviteId: string, rpc: Rpc = defaultRpc): Promise<void> => { await call('series_invite_cancel_v1', { p_invite_id: inviteId }, rpc); };
export const respondToInvite = async (inviteId: string, accept: boolean, rpc: Rpc = defaultRpc): Promise<void> => { await call('series_invite_respond_v1', { p_invite_id: inviteId, p_accept: accept }, rpc); };
export const leaveEvent = async (seriesId: string, pageId: string, rpc: Rpc = defaultRpc): Promise<void> => { await call('series_leave_v1', { p_series_id: seriesId, p_page_id: pageId }, rpc); };
export const removeOrganiserPage = async (seriesId: string, pageId: string, rpc: Rpc = defaultRpc): Promise<void> => { await call('series_remove_organiser_v1', { p_series_id: seriesId, p_page_id: pageId }, rpc); };

export interface SearchedPage { id: string; name: string }

/** Search ANY live organiser page by name (2+ letters). The server decides who may be invited. */
export async function searchOrganiserPages(query: string): Promise<SearchedPage[]> {
  const q = query.trim().replace(/[%_,()]/g, ' ').trim();
  if (q.length < 2) return [];
  const { data, error } = await supabase.from('organiser_profiles').select('id, name').eq('lifecycle_status', 'live').ilike('name', `%${q}%`).order('name').limit(20);
  if (error) throw new OrganiserApiError('failed');
  return (data ?? []).flatMap((r) => (r.id && r.name ? [{ id: r.id as string, name: r.name as string }] : []));
}

export const organisersQueryKey = (seriesId: string) => ['org-series-organisers', seriesId] as const;
export const invitationsQueryKey = (userId: string | undefined) => ['org-my-invitations', userId ?? 'none'] as const;

export function useSeriesOrganisers(seriesId: string) {
  return useQuery({ queryKey: organisersQueryKey(seriesId), queryFn: () => fetchOrganisers(seriesId), enabled: !!seriesId, retry: false });
}

export function useMyInvitations() {
  const { user } = useAuth();
  return useQuery({ queryKey: invitationsQueryKey(user?.id), queryFn: () => fetchMyInvitations(), enabled: !!user?.id, retry: false });
}
