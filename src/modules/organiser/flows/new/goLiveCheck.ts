import { supabase } from '@/integrations/supabase/client';

/**
 * series_go_live_check_v1(p_series_id): the ONE publish rule on the server. The brief names
 * `shared/goLiveCheck.ts`, which is not on this branch (it came with #897, not merged here) and
 * the slice may touch only flows/new, so the reader lives here and moves to shared/ when the
 * orchestrator merges. The result shape is read tolerantly (a list of codes, or of {code}), so a
 * code the server adds later still shows as a reason instead of being dropped.
 */
export interface GoLiveBlocker { code: string }
export interface GoLiveCheck { ready: boolean; blockers: GoLiveBlocker[] }

export const goLiveCheckKey = (seriesId: string) => ['series-go-live-check', seriesId] as const;

export function parseGoLiveCheck(raw: unknown): GoLiveCheck {
  const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const list = Array.isArray(row.blockers) ? row.blockers : Array.isArray(row.missing) ? row.missing : [];
  const blockers: GoLiveBlocker[] = [];
  for (const entry of list) {
    const code = typeof entry === 'string' ? entry : typeof (entry as { code?: unknown })?.code === 'string' ? (entry as { code: string }).code : null;
    if (code && !blockers.some((b) => b.code === code)) blockers.push({ code });
  }
  const ready = row.ready === true || row.ok === true ? blockers.length === 0 : false;
  // An answer that says "not ready" with no named blocker must still block.
  if (!ready && blockers.length === 0) blockers.push({ code: 'not_ready' });
  return { ready, blockers };
}

type CheckRpc = (fn: 'series_go_live_check_v1', args: { p_series_id: string }) => Promise<{ data: unknown; error: { message: string } | null }>;

export async function fetchGoLiveCheck(seriesId: string): Promise<GoLiveCheck> {
  const { data, error } = await (supabase.rpc as unknown as CheckRpc)('series_go_live_check_v1', { p_series_id: seriesId });
  if (error) throw error;
  return parseGoLiveCheck(data);
}
