// =============================================================================
// useEventRaffleConfig — fetch raffle config for a public event page.
// Calls public get_event_raffle(event_id, session_id) which is gated on
// event.lifecycle_status='published'. Auto-refreshes entry count on tick.
//
// 2026-04-29 — surfaced cutoff_at + cutoff_offset_minutes (canonical raffle
// cutoff is now event_start - offset, default 2 hours). Type also extended
// with my_status + config_source so existing callers (RaffleBlock) typecheck.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface RaffleWinnerDisplay {
  first_name: string;
  drawn_at: string;
}

export interface RaffleAlternateEvent {
  event_id: string;
  name: string | null;
  slug: string | null;
  start_at: string | null;
  prize_text: string | null;
}

export type RaffleMyStatusCode =
  | 'none'
  | 'eligible'
  | 'admin_excluded'
  | 'already_won';

export interface RaffleMyStatus {
  entered: boolean;
  status: RaffleMyStatusCode;
  alternate_event: RaffleAlternateEvent | null;
}

export interface RaffleConfig {
  enabled: boolean;
  config_source?: 'preset' | 'custom' | 'none';
  entry_count: number;
  prize_text: string | null;
  draw_date: string | null;
  /** ISO timestamp (timezone-aware) when entries close. Source of truth for
   *  countdowns. Computed server-side as event_start - cutoff_offset_minutes. */
  cutoff_at: string | null;
  /** How many minutes before event start the raffle closes. Default 120 (2h). */
  cutoff_offset_minutes: number | null;
  /** Wall-clock close time in event timezone, e.g. "19:00". Back-compat only —
   *  prefer cutoff_at for any time math. */
  cutoff_time: string | null;
  cutoff_passed: boolean;
  consent_version: string | null;
  winner_display: RaffleWinnerDisplay | null;
  my_status: RaffleMyStatus | null;
}

export interface UseEventRaffleConfigResult {
  config: RaffleConfig | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const POLL_INTERVAL_MS = 60_000;

export function useEventRaffleConfig(
  eventId: string | null | undefined,
  sessionId?: string | null,
): UseEventRaffleConfigResult {
  const [config, setConfig] = useState<RaffleConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(eventId));
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef(false);
  const lastIdRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!eventId) return;
    if (inflight.current) return;
    inflight.current = true;
    const { data, error: rpcErr } = await supabase.rpc('get_event_raffle', {
      p_event_id: eventId,
      p_session_id: sessionId ?? null,
    });
    if (lastIdRef.current !== eventId) {
      inflight.current = false;
      return;
    }
    if (rpcErr) {
      setError(rpcErr.message || 'Failed to load raffle info');
    } else {
      setConfig((data as RaffleConfig) ?? null);
      setError(null);
    }
    setLoading(false);
    inflight.current = false;
  }, [eventId, sessionId]);

  useEffect(() => {
    lastIdRef.current = eventId ?? null;
    if (!eventId) {
      setConfig(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setConfig(null);
    void refresh();
    const id = window.setInterval(() => { void refresh(); }, POLL_INTERVAL_MS);
    return () => { window.clearInterval(id); };
  }, [eventId, refresh]);

  return { config, loading, error, refresh };
}
