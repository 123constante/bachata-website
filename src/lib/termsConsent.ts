import { supabase } from '@/integrations/supabase/client';

/** D8. The one clickwrap line records kind `terms_privacy` at this document version (admin accept_terms_v1). */
export const TERMS_KIND = 'terms_privacy';
export const TERMS_VERSION = '2026-10-15';
export const TERMS_PATH = '/terms';
export const PRIVACY_PATH = '/privacy';

type Rpc = (fn: string, args?: Record<string, string>) => PromiseLike<{ data: unknown; error: unknown }>;
const rpc = (fn: string, args?: Record<string, string>) => (supabase.rpc as unknown as Rpc).call(supabase, fn, args);

/** Records the acceptance. Idempotent server-side. Resolves false (never throws) when it could not. */
export async function acceptTerms(): Promise<boolean> {
  try {
    const { error } = await rpc('accept_terms_v1', { p_kind: TERMS_KIND, p_version: TERMS_VERSION });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Has this signed-in person accepted the current terms? Reads their own consent stamps
 * (my_account_export_extras_v1). Anything unreadable answers true: a failed check must never put a
 * wall in front of sign-in.
 */
export async function hasAcceptedTerms(): Promise<boolean> {
  try {
    const { data, error } = await rpc('my_account_export_extras_v1');
    if (error) return true;
    const consents = (data as { consents?: unknown } | null)?.consents;
    if (!Array.isArray(consents)) return true;
    return consents.some((c) => {
      const row = c as { kind?: string; version?: string };
      return row.kind === TERMS_KIND && row.version === TERMS_VERSION;
    });
  } catch {
    return true;
  }
}
