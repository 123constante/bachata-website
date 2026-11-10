import { supabase } from '@/integrations/supabase/client';
import type { DuplicatePair } from './duplicatesModel';

/** One person from the admin people search, as the "Join two people" block shows it. */
export interface JoinCandidate {
  id: string;
  /** null = no name yet. */
  name: string | null;
  hasLogin: boolean;
  archived: boolean;
  roles: string[];
}

type Row = { id: string; first_name: string | null; surname: string | null; display_name: string | null; claimed_by: string | null; archived_at: string | null; roles: string[] | null };

export const toCandidate = (r: Row): JoinCandidate => ({
  id: r.id,
  name: [r.first_name, r.surname].filter(Boolean).join(' ').trim() || r.display_name?.trim() || null,
  hasLogin: !!r.claimed_by,
  archived: !!r.archived_at,
  roles: r.roles ?? [],
});

export const joinSearchKey = (q: string) => ['admin-join-people-search', q] as const;

/** admin_search_people_v1 (the search the invite flow uses), archived people included so they show as such. Two letters minimum. */
export async function searchJoinCandidates(query: string): Promise<JoinCandidate[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const { data, error } = await supabase.rpc('admin_search_people_v1', { p_query: q, p_limit: 10, p_include_archived: true });
  if (error) throw error;
  return (data ?? []).map(toCandidate);
}

/** The two chosen people as the pair the existing preview and join take. Null until two different people are chosen. */
export function pairFrom(keep: JoinCandidate | null, fold: JoinCandidate | null): DuplicatePair | null {
  if (!keep || !fold || keep.id === fold.id) return null;
  return { keepId: keep.id, keepName: keep.name, foldId: fold.id, foldName: fold.name, organiserId: null, organiserName: null, kind: 'stub' };
}
