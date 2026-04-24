// =============================================================================
// useEventRaffleConfig — fetch raffle config for a public event page.
// Calls public get_event_raffle(event_id) which is gated on
// event.lifecycle_status='published'. Auto-refreshes entry count on tick.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface RaffleWinnerDisplay {
  first_name: string;
  drawn_at: string;
}

export interface RaffleConfig {
  enabled: boolean;
  entry_count: number;
  prize_text: string | null;
  draw_date: string | null;
  cutoff_time: string | null;
  cutoff_passed: boolean;
  consent_version: string | null;
  winner_display: RaffleWinnerDisplay | null;
}

export interface UseEventRaffleConfigResult {
  config: RaffleConfig | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const POLL_INTERVAL_MS = 60_000;

export function useEventRaffleConfig(eventId: string | null | undefined): UseEventRaffleConfigResult {
  const [config, setConfig] = useState<RaffleConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(eventId));
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef(false);
  const lastIdRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!eventId) return;
    if (inflight.current) return;
    inflight.current = true;
    const { data, error: rpcErr } = await supabase.rpc('get_event_raffle', { p_event_id: eventId });
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
  }, [eventId]);

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
