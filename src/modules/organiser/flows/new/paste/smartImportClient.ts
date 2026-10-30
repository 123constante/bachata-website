import { supabase } from '@/integrations/supabase/client';

/**
 * Typed client for the `event-smart-import` edge function, built against the
 * admin S1 lock contract (admin PR #996): a signed-in admin or organiser JWT is
 * required (401 otherwise), each account has a daily cap (429 `daily_limit`),
 * and failures otherwise come back in-band as 200 `{ ok:false, error }`.
 * NOT deployed on prod yet: the tests mock this module's one dependency.
 */

/** The slice of the function's ParsedEvent this panel reads. Every value is untrusted. */
export interface ParsedLinkEvent {
  title?: string | null;
  format?: 'one_off' | 'recurring' | 'course' | 'festival' | null;
  date_iso?: string | null;
  recurrence?: { custom_dates_iso?: string[] | null } | null;
  venue_name?: string | null;
  ticket_url?: string | null;
  description?: string | null;
}

export type LinkReadResult =
  | { ok: true; parsed: ParsedLinkEvent }
  | { ok: false; error: string; notes?: string };

export const READ_TIMEOUT_MS = 90_000;

interface InvokeError { context?: unknown }

/** HTTP errors from invoke carry the Response in `context`; read its JSON body if any. */
async function errorBody(error: InvokeError): Promise<{ error?: string; message?: string }> {
  const ctx = error.context;
  if (ctx instanceof Response) {
    try {
      return (await ctx.clone().json()) as { error?: string; message?: string };
    } catch {
      return { error: `http_${ctx.status}` };
    }
  }
  return {};
}

/**
 * Reads one event link. Never throws: aborts map to `aborted`, a timeout to
 * `timeout`, a failed call with no body to `network`. Signed out never calls
 * the function (it would send the anon key).
 */
export async function readEventLink(link: string, opts: { signal?: AbortSignal; timeoutMs?: number } = {}): Promise<LinkReadResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { ok: false, error: 'unauthenticated' };

  const controller = new AbortController();
  const onOuterAbort = () => controller.abort();
  opts.signal?.addEventListener('abort', onOuterAbort);
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, opts.timeoutMs ?? READ_TIMEOUT_MS);
  try {
    if (opts.signal?.aborted) return { ok: false, error: 'aborted' };
    const { data, error } = await supabase.functions.invoke('event-smart-import', {
      body: { event_link: link },
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    if (timedOut) return { ok: false, error: 'timeout' };
    if (opts.signal?.aborted) return { ok: false, error: 'aborted' };
    if (error) {
      const body = await errorBody(error as InvokeError);
      if (body.error) return { ok: false, error: body.error, ...(body.message ? { notes: body.message } : {}) };
      return { ok: false, error: 'network' };
    }
    if (data && typeof data === 'object' && (data as { ok?: unknown }).ok === true && (data as { parsed?: unknown }).parsed) {
      return { ok: true, parsed: (data as { parsed: ParsedLinkEvent }).parsed };
    }
    const err = data && typeof data === 'object' ? (data as { error?: unknown }).error : null;
    return { ok: false, error: typeof err === 'string' ? err : 'unreadable' };
  } catch {
    if (timedOut) return { ok: false, error: 'timeout' };
    return { ok: false, error: opts.signal?.aborted ? 'aborted' : 'network' };
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onOuterAbort);
  }
}
