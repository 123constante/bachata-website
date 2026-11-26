// Profile-match ask: "is this team-made page you?" (admin contract, built in the admin repo).
// my_profile_match_candidates_v1() -> jsonb [{id, name, city, avatar_url}] (0-3 rows)
// answer_profile_match_v1({p_target, p_answer}) -> {ok, status}
// The functions may not be applied yet -- hence rpcLoose, and a read that never throws.
import { rpcLoose } from '@/integrations/supabase/rpcLoose';

export type MatchCandidate = { id: string; name: string; city: string | null; avatar_url: string | null };
export type MatchAnswer = 'me' | 'not_me';
export type MatchAnswerStatus = 'recorded' | 'already_answered' | 'not_candidate';

const MAX_CANDIDATES = 3;

/** Errors and a missing function are [] so the home never breaks. */
export async function fetchMatchCandidates(): Promise<MatchCandidate[]> {
  try {
    const { data, error } = await rpcLoose('my_profile_match_candidates_v1');
    if (error || !Array.isArray(data)) return [];
    const out: MatchCandidate[] = [];
    for (const row of data) {
      if (!row || typeof row !== 'object') continue;
      const r = row as Record<string, unknown>;
      if (typeof r.id !== 'string' || typeof r.name !== 'string') continue;
      out.push({
        id: r.id,
        name: r.name,
        city: typeof r.city === 'string' && r.city ? r.city : null,
        avatar_url: typeof r.avatar_url === 'string' && r.avatar_url ? r.avatar_url : null,
      });
    }
    return out.slice(0, MAX_CANDIDATES);
  } catch {
    return [];
  }
}

/** Throws on a failed call so the card can show its error line. */
export async function answerMatch(target: string, answer: MatchAnswer): Promise<MatchAnswerStatus> {
  const { data, error } = await rpcLoose('answer_profile_match_v1', { p_target: target, p_answer: answer });
  const d = data as { ok?: unknown; status?: unknown } | null;
  if (error || !d || d.ok !== true) throw new Error(error?.message ?? 'answer_profile_match_v1 failed');
  return d.status as MatchAnswerStatus;
}
