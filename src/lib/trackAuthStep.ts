import { supabase } from '@/integrations/supabase/client';

/**
 * Auth funnel counter (admin `record_auth_funnel_step_v1`, PR #820). The lists below are the SQL
 * allowlists; tests/fixtures/auth-funnel-contract.sql pins them and trackAuthStep.contract.test.ts
 * fails if either side drifts. The call carries only (step, outcome): no e-mail, no id.
 */
export const AUTH_FUNNEL_STEPS = [
  'auth_view',
  'code_sent',
  'code_ok',
  'code_fail',
  'callback',
  'landing',
  'onboarding_end',
  'invite_redeem',
  'claim',
  'join_redeem',
] as const;
export const AUTH_FUNNEL_OUTCOMES = ['ok', 'wrong', 'expired', 'timeout', 'fallback', 'refused', 'error'] as const;
/** A landing state id, only valid with step 'landing'. */
export const AUTH_FUNNEL_STATE_ID = /^S-[A-Z0-9-]{1,20}$/;

export type AuthFunnelStep = (typeof AUTH_FUNNEL_STEPS)[number];
export type AuthFunnelOutcome = (typeof AUTH_FUNNEL_OUTCOMES)[number];
export type AuthFunnelStateId = `S-${string}`;

export type AuthFunnelCall =
  | { step: Exclude<AuthFunnelStep, 'landing'>; outcome: AuthFunnelOutcome }
  | { step: 'landing'; outcome: AuthFunnelOutcome | AuthFunnelStateId };

/**
 * Fire-and-forget. Never throws and never returns a promise the caller must wait for: a missing RPC
 * (not on prod until #820 is applied), a rejection or an error result is swallowed.
 */
export function trackAuthStep(call: AuthFunnelCall): void {
  try {
    // Automation (Playwright build specs, Puppeteer) must not write to the live counter. Real phones never set this.
    if (typeof navigator !== 'undefined' && navigator.webdriver === true) return;
    if (call.step !== 'landing' && !(AUTH_FUNNEL_OUTCOMES as readonly string[]).includes(call.outcome)) return;
    const rpc = supabase.rpc as unknown as (fn: string, args: Record<string, string>) => PromiseLike<unknown>;
    void Promise.resolve(rpc.call(supabase, 'record_auth_funnel_step_v1', { p_step: call.step, p_outcome: call.outcome })).then(
      () => undefined,
      () => undefined,
    );
  } catch {
    /* the counter must never break sign-in */
  }
}
