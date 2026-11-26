import { supabase } from '@/integrations/supabase/client';

type Rpc = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, args) => (supabase.rpc as unknown as Rpc)(fn, args);

export interface MyTeachRequest {
  request_id: string;
  program_item_id: string | null;
  added_session_id: string | null;
  status: 'pending' | 'declined';
}
export type RequestTeachResult = { status: 'pending'; request_id: string } | { status: 'already_teaching' };

export const myTeachRequestsKey = (occurrenceId: string) => ['my-teach-requests', occurrenceId] as const;

/** The error code after "permission_denied: " (e.g. no_teacher_profile), or the raw message. */
export const codeOf = (e: unknown): string => {
  const m = e instanceof Error ? e.message : String(e ?? '');
  const i = m.indexOf('permission_denied:');
  return (i >= 0 ? m.slice(i + 'permission_denied:'.length) : m).trim();
};

/** my_teach_requests_v1: ANY error or non-array is "no rows". */
export async function myTeachRequests(occurrenceId: string): Promise<MyTeachRequest[]> {
  try {
    const r = await rpc('my_teach_requests_v1', { p_occurrence_id: occurrenceId });
    return !r.error && Array.isArray(r.data) ? (r.data as MyTeachRequest[]) : [];
  } catch { return []; }
}

export async function requestTeach(a: { occurrenceId: string; itemId: string | null; addedId: string | null }): Promise<RequestTeachResult> {
  const r = await rpc('request_teach_class_v1', {
    p_occurrence_id: a.occurrenceId, p_program_item_id: a.itemId, p_added_session_id: a.addedId,
  });
  if (r.error) throw new Error(r.error.message);
  return r.data as RequestTeachResult;
}

export async function withdrawTeach(requestId: string): Promise<void> {
  const r = await rpc('withdraw_teach_request_v1', { p_request_id: requestId });
  if (r.error) throw new Error(r.error.message);
}
