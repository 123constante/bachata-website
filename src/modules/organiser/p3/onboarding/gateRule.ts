// F-12: will the onboarding gate refuse a write to this event? Read from organiser_onboarding_status_v1 (the
// read Home's banner, You and the gate sheet share), so a screen can hold a write the server would refuse
// instead of sending it (Repeat's dry-run preview: every refused send writes a failed-change audit row).
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { fetchOnboardingStatus, onboardingStatusKey } from './statusQuery';

export type GateAnswer =
  /** The server would let the write through (flag off, an admin, not a member of any target page, or one member page finished). */
  | { s: 'pass' }
  /** The server would refuse: `organiserId` is the first of the event's pages the person is on (all unfinished). */
  | { s: 'refuse'; organiserId: string }
  /** The status read is still loading. */
  | { s: 'checking' }
  /** No answer (no read, a failed read, an unknown shape): the screen sends as before and the server decides. */
  | { s: 'unknown' };

type RawOrg = { id?: unknown; complete?: unknown };

/**
 * Mirrors _require_onboarding_complete_v1 (read on prod 2026-11-01): passes when the gate flag is off, the caller is
 * an admin, or the caller is a member of none of the target pages; otherwise passes only when ONE target page the
 * caller is a member of is complete. `organisers` in the status read is every page the caller is on, each with
 * `complete` (= nothing missing for the person and that page, the same `_onboarding_missing_v1`).
 */
export function gateAnswerFrom(raw: unknown, targets: readonly string[]): GateAnswer {
  if (!raw || typeof raw !== 'object') return { s: 'unknown' };
  const r = raw as { gate_on?: unknown; is_admin?: unknown; organisers?: unknown };
  if (typeof r.gate_on !== 'boolean' || !Array.isArray(r.organisers)) return { s: 'unknown' };
  if (!r.gate_on || r.is_admin === true) return { s: 'pass' };
  const mine = (r.organisers as RawOrg[]).filter((o) => typeof o?.id === 'string' && targets.includes(o.id as string));
  if (mine.length === 0 || mine.some((o) => o.complete === true)) return { s: 'pass' };
  return { s: 'refuse', organiserId: mine[0].id as string };
}

/** The refusal the server would send, so the held write opens the gate through the ONE mapping (useGatedCopy). */
export const heldRefusal = (organiserId: string | null) => ({
  message: 'onboarding_incomplete',
  details: JSON.stringify({ missing: [], organiser_id: organiserId }),
});

/** gateAnswerFrom over the shared status read; `enabled` false = no read (unknown). */
export function useGateAnswer(targets: readonly string[], enabled = true): { answer: GateAnswer; recheck: () => void } {
  const { user } = useAuth();
  const on = enabled && !!user?.id;
  const q = useQuery({ queryKey: onboardingStatusKey(user?.id), queryFn: fetchOnboardingStatus, enabled: on, staleTime: 60_000, retry: false });
  const answer: GateAnswer = !on || q.isError ? { s: 'unknown' } : q.isPending ? { s: 'checking' } : gateAnswerFrom(q.data, targets);
  return { answer, recheck: () => { if (on) void q.refetch(); } };
}
