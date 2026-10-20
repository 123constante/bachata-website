// People arc PINNED file (D48): slices A-WEB1a and A-WEB1b create it byte-identical. Change it only via the orchestrator.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// my_profile_progress_v1 is not in the generated Database type yet: string-named boundary (check:rpc-typing).
type UntypedRpc = {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};
const rpc = (fn: string, args?: Record<string, unknown>) => (supabase as unknown as UntypedRpc).rpc(fn, args);

export type ProgressArea = 'dancer' | 'organiser' | 'teacher' | 'dj';
export interface ProgressStep { area: ProgressArea; field: string; required: boolean; done: boolean }
export interface ProfileProgress {
  percent: number;
  requiredLeft: number;
  publishReady: boolean;
  steps: ProgressStep[];
  declined: Array<'teacher' | 'dj'>;
}

const AREAS: ReadonlySet<string> = new Set(['dancer', 'organiser', 'teacher', 'dj']);

export function parseProfileProgress(raw: unknown): ProfileProgress {
  const o = raw as Record<string, unknown> | null;
  if (!o || typeof o !== 'object') throw new Error('progress_bad_shape');
  const { percent, required_left: requiredLeft, publish_ready: publishReady, steps, declined } = o;
  if (typeof percent !== 'number' || typeof requiredLeft !== 'number' || typeof publishReady !== 'boolean'
    || !Array.isArray(steps) || !Array.isArray(declined)) throw new Error('progress_bad_shape');
  return {
    percent,
    requiredLeft,
    publishReady,
    steps: steps.map((s) => {
      const r = (s ?? {}) as Record<string, unknown>;
      if (!AREAS.has(String(r.area)) || typeof r.field !== 'string' || typeof r.required !== 'boolean'
        || typeof r.done !== 'boolean') throw new Error('progress_bad_shape');
      return { area: r.area as ProgressArea, field: r.field, required: r.required, done: r.done };
    }),
    declined: declined.filter((d): d is 'teacher' | 'dj' => d === 'teacher' || d === 'dj'),
  };
}

/** The profile wizard route (built by A-WEB1b). `/account/o/profile` is an R1 legacy redirect: never reuse it. */
export const PROFILE_WIZARD_PATH = '/account/o/complete';

export const profileProgressQueryKey = (organiserId: string | null) => ['my-profile-progress', organiserId] as const;

export async function fetchProfileProgress(organiserId: string | null): Promise<ProfileProgress> {
  const { data, error } = await rpc('my_profile_progress_v1', { p_organiser_id: organiserId });
  if (error) throw new Error(error.message);
  return parseProfileProgress(data);
}

export function useProfileProgress(organiserId: string | null) {
  return useQuery({ queryKey: profileProgressQueryKey(organiserId), queryFn: () => fetchProfileProgress(organiserId) });
}

/** C14 edit lock. Locks only when the progress LOADED and says not ready; loading or an error never locks (the
 *  server still enforces the go-live rule). An admin is never locked. */
export function profileLock(p: ProfileProgress | undefined, isAdmin: boolean): { locked: boolean; reason: string | null } {
  if (isAdmin || !p || p.publishReady) return { locked: false, reason: null };
  return { locked: true, reason: `Finish your profiles first, ${p.requiredLeft} left` };
}
