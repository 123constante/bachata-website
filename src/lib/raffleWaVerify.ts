// =============================================================================
// raffleWaVerify — client helpers for the WhatsApp entry-confirmation flow.
//
// After submit_raffle_entry succeeds, the dialog calls the
// raffle-send-confirmation edge function (sends a WhatsApp template — delivery
// proves the number has WhatsApp), then polls get_raffle_entry_wa_status_v1
// while Meta's webhook settles the verdict.
//
// TOLERANT BY CONSTRUCTION: every failure mode of infrastructure that doesn't
// exist yet / is down maps to 'unavailable' or 'skipped' — the dialog treats
// those as the legacy neutral success. Only a definitive Meta "this number has
// no WhatsApp" verdict surfaces as 'failed'.
// =============================================================================

import { getSupabase } from '@/integrations/supabase/getSupabase';
import { rpcLoose as callRpc } from '@/integrations/supabase/rpcLoose';

// callRpc resolves the client PER CALL. The old `supabase.rpc.bind(supabase)`
// here constructed the client as a side effect of importing this module -- one
// of only two sites repo-wide that structurally blocked a lazy accessor
// (supabase-defer arc, P1). Every caller already awaits, so nothing else moved.

/** Outcome of asking the edge function to send the confirmation template. */
export type SendOutcome = 'sent' | 'skipped' | 'failed' | 'unavailable';

export async function sendWaConfirmation(entryId: string, sessionId: string): Promise<SendOutcome> {
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase.functions.invoke('raffle-send-confirmation', {
      body: { entry_id: entryId, session_id: sessionId },
    });
    if (error) return 'unavailable';
    const payload = data as { ok?: boolean; wa_status?: string } | null;
    if (payload?.ok && payload.wa_status === 'sent') return 'sent';
    if (payload?.ok && payload.wa_status === 'failed') return 'failed'; // sync Meta verdict
    if (payload?.ok && payload.wa_status === 'skipped') return 'skipped';
    // not_claimable with a settled status (double-invoke, second tab): let the
    // poll resolve 'sent'/'verified'; everything else is neutral.
    if (payload && 'wa_status' in payload) {
      if (payload.wa_status === 'sent' || payload.wa_status === 'verified') return 'sent';
      if (payload.wa_status === 'failed') return 'failed';
    }
    return 'unavailable';
  } catch {
    return 'unavailable';
  }
}

/** Final verdict from polling while Meta's delivery webhook settles. */
export type VerifyOutcome = 'verified' | 'failed' | 'skipped' | 'timeout' | 'unavailable';

export interface PollOptions {
  intervalMs?: number;
  maxWaitMs?: number;
  /** Injectable sleeper for tests. */
  sleep?: (ms: number) => Promise<void>;
}

export async function pollWaVerifyStatus(
  entryId: string,
  sessionId: string,
  opts: PollOptions = {},
): Promise<VerifyOutcome> {
  const intervalMs = opts.intervalMs ?? 1500;
  const maxWaitMs = opts.maxWaitMs ?? 12000;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    try {
      const { data, error } = await callRpc('get_raffle_entry_wa_status_v1', {
        p_entry_id: entryId,
        p_session_id: sessionId,
      });
      if (error) return 'unavailable';
      const payload = data as { found?: boolean; wa_status?: string } | null;
      if (!payload?.found) return 'unavailable';
      if (payload.wa_status === 'verified') return 'verified';
      if (payload.wa_status === 'failed') return 'failed';
      if (payload.wa_status === 'skipped') return 'skipped';
      // 'pending' / 'sent' → webhook hasn't settled yet, keep polling.
    } catch {
      return 'unavailable';
    }
    await sleep(intervalMs);
  }
  return 'timeout';
}
