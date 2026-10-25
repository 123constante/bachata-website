import { supabase } from '@/integrations/supabase/client';
import { TERMS_VERSION } from '@/lib/legalVersions';

/** D8. The one clickwrap line records kind `terms_privacy` at this document version (admin accept_terms_v1). */
export const TERMS_KIND = 'terms_privacy';
/**
 * The terms version has ONE source: src/lib/legalVersions.ts (audit L27). Re-exported, never copied, so a
 * bump there re-asks everyone (termsConsent.version.test.ts proves it).
 */
export { TERMS_VERSION };
/** Longest sign-in/sign-up waits on a consent or gate call; on timeout the person simply carries on. */
export const CONSENT_TIMEOUT_MS = 2500;
export const TERMS_PATH = '/terms';
export const PRIVACY_PATH = '/privacy';

type Rpc = (fn: string, args?: Record<string, string>) => PromiseLike<{ data: unknown; error: unknown }>;
const rpc = (fn: string, args?: Record<string, string>) => (supabase.rpc as unknown as Rpc).call(supabase, fn, args);

/** Resolves `fallback` if `work` has not settled in `ms` (or throws). Never rejects. */
const withTimeout = <T>(work: () => PromiseLike<T>, fallback: T, ms = CONSENT_TIMEOUT_MS): Promise<T> =>
  new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    try {
      Promise.resolve(work()).then(
        (v) => { clearTimeout(timer); resolve(v); },
        () => { clearTimeout(timer); resolve(fallback); },
      );
    } catch {
      clearTimeout(timer);
      resolve(fallback);
    }
  });

/** Records the acceptance. Idempotent server-side. Resolves false (never throws) when it could not. */
export function acceptTerms(): Promise<boolean> {
  return withTimeout(async () => {
    const { error } = await rpc('accept_terms_v1', { p_kind: TERMS_KIND, p_version: TERMS_VERSION });
    return !error;
  }, false);
}

/**
 * Has this signed-in person accepted the current terms? Reads their own consent stamps
 * (my_account_export_extras_v1). Anything unreadable, slow, or a dancer area that is closed for them
 * (accept_terms_v1 would refuse, so the card could never work) answers true: no wall, no dead button.
 */
export function hasAcceptedTerms(): Promise<boolean> {
  return withTimeout(async () => {
    const [gate, extras] = await Promise.all([rpc('dancer_area_gate_v1'), rpc('my_account_export_extras_v1')]);
    const g = gate.data as { allowed?: unknown } | null;
    if (gate.error || !g || g.allowed !== true) return true;
    if (extras.error) return true;
    const consents = (extras.data as { consents?: unknown } | null)?.consents;
    if (!Array.isArray(consents)) return true;
    return consents.some((c) => {
      const row = c as { kind?: string; version?: string };
      return row.kind === TERMS_KIND && row.version === TERMS_VERSION;
    });
  }, true);
}
