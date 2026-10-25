import { supabase } from '@/integrations/supabase/client';
import { parseOpenRequest, openRequestNote, type OpenRequestResult } from './cannotCreate';

// Not in the generated Database type yet (Arc 1 PR 1, admin 20261129960000), so the call goes
// through a string-named boundary, as selfServeApi does for organiser_claim_hints_v1.
type UntypedRpc = { rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }> };

/**
 * "Ask us to open it": the same request the invite-only wall sends (request_signup_access_v1),
 * so it lands in the admin's access-request list with the page name as the note. Never throws.
 */
export async function requestOpenAccess(email: string, pageName: string): Promise<OpenRequestResult> {
  try {
    const { data, error } = await (supabase as unknown as UntypedRpc).rpc('request_signup_access_v1', {
      p_email: email,
      p_note: openRequestNote(pageName),
    });
    return error ? 'failed' : parseOpenRequest(data);
  } catch {
    return 'failed';
  }
}
