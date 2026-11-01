// The door's calls. Thin: words and next steps live in doorModel. The functions are NOT applied on prod yet, so the
// RPCs are called by string name (same boundary as admin-organisers/join/joinApi). Never throws to the screen.
import { supabase } from '@/integrations/supabase/client';
import { DOOR_PATH, parseLookalikes, parseStartResult, type LookalikeState, type StartOutcome } from './doorModel';

type UntypedRpc = { rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }> };
const rpc = (fn: string, args?: Record<string, unknown>) => (supabase as unknown as UntypedRpc).rpc(fn, args);

export async function fetchLookalikes(name: string, cityId: string): Promise<LookalikeState> {
  try {
    const { data, error } = await rpc('organiser_lookalikes_v1', { p_name: name.trim(), p_city: cityId });
    return parseLookalikes(data, error);
  } catch {
    return { kind: 'error' };
  }
}

export async function startOrganiser(name: string, cityId: string, lookalikeConfirm?: string): Promise<StartOutcome> {
  try {
    const payload: Record<string, string> = { name: name.trim(), city: cityId };
    if (lookalikeConfirm) payload.lookalike_confirm = lookalikeConfirm;
    const { data, error } = await rpc('organiser_start_v1', { p_payload: payload });
    return parseStartResult(data, error);
  } catch {
    return parseStartResult(null, new Error('network'));
  }
}

/** The existing email-code sign-in (signInWithOtp). captchaToken is sent ONLY when a Turnstile token exists. */
export function sendDoorCode(email: string, captchaToken?: string | null) {
  const callbackUrl = new URL('/auth/callback', window.location.origin);
  callbackUrl.searchParams.set('returnTo', DOOR_PATH);
  return supabase.auth.signInWithOtp({
    email: email.trim(),
    options: {
      shouldCreateUser: true,
      emailRedirectTo: callbackUrl.toString(),
      ...(captchaToken ? { captchaToken } : {}),
    },
  });
}

export const verifyDoorCode = (email: string, code: string) => supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
